/*
 * Gemini AI Service Layer
 * Responsible ONLY for communicating with the Gemini API.
 *
 * Uses @google/genai SDK (NOT @google/generative-ai) with googleSearch tool.
 * The old SDK + googleSearchRetrieval + responseMimeType combination was INCOMPATIBLE
 * and caused silent 400 errors misclassified as rate limits.
 */
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../../types";

export class AnalysisError extends Error {
  constructor(public message: string, public type: 'AUTH' | 'SAFETY' | 'RATE_LIMIT' | 'UNKNOWN') {
    super(message);
    this.name = 'AnalysisError';
  }
}

const extractJson = (text: string) => {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.substring(start, end + 1));
    }
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Neural output parsing failed. Invalid JSON structure.");
  }
};

/**
 * Direct call to Gemini to generate text embeddings.
 */
export const embedText = async (text: string): Promise<number[] | null> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  
  if (!apiKey) {
    console.warn("[Gemini Service] API Key missing, skipping embedding.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const MODEL = "embedding-001"; // "text-embedding-004" may not be fully supported by this v1beta SDK yet

  try {
    const response = await ai.models.embedContent({
      model: MODEL,
      contents: text,
    });

    if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
      console.warn("[Gemini Service] Empty embedding received.");
      return null;
    }

    console.log(`[Embedding] Generated successfully (${MODEL})`);
    return response.embeddings[0].values;
  } catch (error: any) {
    console.error(`[Gemini Service] ❌ Embedding generation failed, skipping vector search. Error: ${error.message}`);
    // Return null instead of throwing so the pipeline continues
    return null;
  }
};

/**
 * Direct call to Gemini. Should be wrapped in retry logic by the caller.
 */
export const callGeminiAPI = async (newsText: string): Promise<AnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  
  if (!apiKey) {
    console.error('[Gemini Service] FATAL: process.env.GEMINI_API_KEY is missing during execution.');
    throw new AnalysisError("API Key not configured on server.", 'AUTH');
  }

  console.log(`[Gemini Service] API Key loaded: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)} (length: ${apiKey.length})`);

  const prompt = `Fact-check this claim using Search Grounding. Return ONLY valid JSON matching this schema:
  {"verdict":"REAL"|"FAKE"|"MISLEADING"|"UNVERIFIED","confidence":<0-100>,"explanation":"<brief_explanation_english>","explanation_te":"<brief_explanation_in_telugu_script>","keyPoints":["<fact1_english>","<fact2_english>"],"keyPoints_te":["<fact1_telugu>","<fact2_telugu>"],"bias":<0-100>,"sensationalism":<0-100>,"logicalConsistency":<0-100>,"sourceVerification":[{"uri":"<url>","verified":<boolean>}]}
  
  CLAIM: "${newsText}"`;

  let response: any = null;
  let lastError: any = null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const CANDIDATE_MODELS = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.0-flash-lite-preview-02-05"
    ];

    for (const model of CANDIDATE_MODELS) {
      try {
        console.log(`[Gemini Service] >>> Attempting model ${model}...`);
        const startTime = Date.now();
        
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1, 
          },
        });

        const latency = Date.now() - startTime;
        console.log(`[Gemini Service] <<< ${model} SUCCESS in ${latency}ms`);
        break;
      } catch (err: any) {
        lastError = err;
        const msg = (err.message || "").toLowerCase();
        if (err.status === 404 || msg.includes('not found') || msg.includes('404')) {
          console.warn(`[Gemini Service] ⚠️ Model ${model} returned 404, trying next...`);
          continue;
        }
        if (err.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
          console.warn(`[Gemini Service] ⚠️ Model ${model} quota/rate limit hit, trying next...`);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      const lastMsg = (lastError?.message || "").toLowerCase();
      if (lastError?.status === 429 || lastMsg.includes('429') || lastMsg.includes('quota') || lastMsg.includes('resource_exhausted')) {
        throw new AnalysisError(
          `Gemini API quota/rate limit exceeded for all configured models. Tried: ${CANDIDATE_MODELS.join(', ')}. Last error: ${lastError?.message || 'unknown'}`,
          'RATE_LIMIT'
        );
      }

      throw new AnalysisError(
        `No configured Gemini model is available for this API key. Tried: ${CANDIDATE_MODELS.join(', ')}. Last error: ${lastError?.message || 'unknown'}`,
        'AUTH'
      );
    }

    // response.text is a getter in @google/genai SDK that may return undefined/empty on blocked responses.
    // Coerce to string safely before using.
    const responseText: string = response.text ?? '';
    console.log(`[Gemini Service] <<< Response text preview: ${responseText.substring(0, 200) || '(empty)'}`);

    if (!responseText || typeof responseText !== 'string') {
      throw new AnalysisError("Safety block triggered or empty response.", 'SAFETY');
    }

    const data = extractJson(responseText);

    if (!data || typeof data !== 'object') {
      throw new AnalysisError("Gemini returned unparseable JSON.", 'UNKNOWN');
    }

    const grounded = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Map grounded sources — also merge title from sourceVerification if available
    const sourceVerification: any[] = Array.isArray(data.sourceVerification) ? data.sourceVerification : [];
    const sources = grounded.map((chunk: any) => {
      const webUri = chunk.web?.uri || "#";
      const svMatch = sourceVerification.find((v: any) => v?.uri === webUri);
      return {
        title: chunk.web?.title || svMatch?.title || "Verification Node",
        uri: webUri,
        verified: svMatch?.verified ?? true,
      };
    }).filter((s: any) => s.uri !== "#");

    console.log(`[Gemini Service] Grounding sources extracted:`, sources.length > 0 ? sources : "None");
    console.log(`[Gemini Service] Parsed verdict:`, data.verdict, '| confidence:', data.confidence);

    // Safe field extraction with explicit defaults
    const VALID_VERDICTS = ['REAL', 'FAKE', 'MISLEADING', 'UNVERIFIED'];
    const verdict = VALID_VERDICTS.includes(data.verdict) ? data.verdict : 'UNVERIFIED';
    const confidence = typeof data.confidence === 'number' && isFinite(data.confidence)
      ? Math.max(0, Math.min(100, data.confidence))
      : 0;

    return {
      verdict,
      confidence,
      explanation: typeof data.explanation === 'string' && data.explanation.trim()
        ? data.explanation.trim()
        : "No clarification available.",
      explanation_te: typeof data.explanation_te === 'string' && data.explanation_te.trim()
        ? data.explanation_te.trim()
        : undefined,
      keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints.filter((p: any) => typeof p === 'string') : [],
      keyPoints_te: Array.isArray(data.keyPoints_te) ? data.keyPoints_te.filter((p: any) => typeof p === 'string') : undefined,
      sources,
      categories: {
        bias: typeof data.bias === 'number' ? Math.max(0, Math.min(100, data.bias)) : 0,
        sensationalism: typeof data.sensationalism === 'number' ? Math.max(0, Math.min(100, data.sensationalism)) : 0,
        logicalConsistency: typeof data.logicalConsistency === 'number' ? Math.max(0, Math.min(100, data.logicalConsistency)) : 0,
      },
    };
  } catch (error: any) {
    // Always log the REAL error — never swallow it
    console.error(`[Gemini Service] ❌ FULL ERROR DUMP:`);
    console.error(`[Gemini Service]   error.message: ${error.message}`);
    console.error(`[Gemini Service]   error.status:  ${error.status}`);
    console.error(`[Gemini Service]   error.code:    ${error.code}`);
    console.error(`[Gemini Service]   error.name:    ${error.name}`);
    if (error.response) {
      console.error(`[Gemini Service]   error.response.status: ${error.response.status}`);
      console.error(`[Gemini Service]   error.response.data:`, JSON.stringify(error.response.data || error.response.body || '(none)'));
    }
    if (error.details) {
      console.error(`[Gemini Service]   error.details:`, JSON.stringify(error.details));
    }
    console.error(`[Gemini Service]   FULL ERROR:`, error);
    
    // Re-throw AnalysisErrors as-is (e.g. SAFETY from above)
    if (error instanceof AnalysisError) {
      throw error;
    }

    const errorMsg = (error.message || "").toLowerCase();

    // Auth & Invalid API Key checks (check FIRST)
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 403 ||
      errorMsg.includes('api_key_invalid') ||
      errorMsg.includes('api key not valid') ||
      errorMsg.includes('invalid_argument') ||
      errorMsg.includes('permission denied')
    ) {
      throw new AnalysisError(
        `API Key Error: Please check that your GEMINI_API_KEY in .env / Vercel is valid. (${error.message})`, 
        'AUTH'
      );
    }

    // Rate limit check
    if (error.status === 429 || errorMsg.includes('429') || errorMsg.includes('resource_exhausted') || errorMsg.includes('quota')) {
      throw new AnalysisError(
        `Gemini API Quota / Rate Limit Exceeded. (${error.message})`, 
        'RATE_LIMIT'
      );
    }

    // Everything else — pass real error
    throw new AnalysisError(
      `Gemini API Error: ${error.message || 'Unknown error'}`, 
      'UNKNOWN'
    );
  }
};

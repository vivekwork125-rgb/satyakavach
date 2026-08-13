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
  const MODEL = "gemini-embedding-001";

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
 * Helper to fetch real-time news articles & headlines via Google News RSS
 */
const fetchLiveNews = async (query: string): Promise<Array<{ title: string; uri: string; sourceName: string }>> => {
  try {
    const encoded = encodeURIComponent(query.substring(0, 150));
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const xml = await res.text();
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    return itemMatches.slice(0, 5).map(item => {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/) || item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
      const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      
      const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
      const uri = linkMatch ? linkMatch[1].trim() : '';
      const sourceName = sourceMatch ? sourceMatch[1].trim() : '';
      
      return {
        title: rawTitle,
        uri: uri || '#',
        sourceName,
      };
    }).filter(i => i.title);
  } catch (e) {
    console.warn('[Gemini Service] Live news fetch skipped or timed out.');
    return [];
  }
};

const LANG_MAP: Record<string, { name: string; native: string }> = {
  'hi-IN': { name: 'Hindi', native: 'हिन्दी' },
  'hi': { name: 'Hindi', native: 'हिन्दी' },
  'te-IN': { name: 'Telugu', native: 'తెలుగు' },
  'te': { name: 'Telugu', native: 'తెలుగు' },
  'ta-IN': { name: 'Tamil', native: 'தமிழ்' },
  'ta': { name: 'Tamil', native: 'தமிழ்' },
  'kn-IN': { name: 'Kannada', native: 'ಕನ್ನಡ' },
  'kn': { name: 'Kannada', native: 'ಕನ್ನಡ' },
  'ml-IN': { name: 'Malayalam', native: 'മലയാളം' },
  'ml': { name: 'Malayalam', native: 'മലയാളം' },
  'mr-IN': { name: 'Marathi', native: 'మరాఠీ' },
  'mr': { name: 'Marathi', native: 'మరాఠీ' },
  'bn-IN': { name: 'Bengali', native: 'বাংলা' },
  'bn': { name: 'Bengali', native: 'বাংলা' },
  'es-ES': { name: 'Spanish', native: 'Español' },
  'es': { name: 'Spanish', native: 'Español' },
  'fr-FR': { name: 'French', native: 'Français' },
  'fr': { name: 'French', native: 'Français' },
  'de-DE': { name: 'German', native: 'Deutsch' },
  'de': { name: 'German', native: 'Deutsch' },
  'zh-CN': { name: 'Chinese', native: '中文' },
  'zh': { name: 'Chinese', native: '中文' },
  'ar-SA': { name: 'Arabic', native: 'العربية' },
  'ar': { name: 'Arabic', native: 'العربية' },
  'ru-RU': { name: 'Russian', native: 'Русский' },
  'ru': { name: 'Russian', native: 'Русский' },
  'ja-JP': { name: 'Japanese', native: '日本語' },
  'ja': { name: 'Japanese', native: '日本語' },
};

/**
 * Direct call to Gemini. Should be wrapped in retry logic by the caller.
 */
export const callGeminiAPI = async (newsText: string, langCode: string = 'en-US'): Promise<AnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  
  if (!apiKey) {
    console.error('[Gemini Service] FATAL: process.env.GEMINI_API_KEY is missing during execution.');
    throw new AnalysisError("API Key not configured on server.", 'AUTH');
  }

  console.log(`[Gemini Service] API Key loaded: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)} (length: ${apiKey.length}), langCode: ${langCode}`);

  const targetLang = (langCode && !langCode.toLowerCase().startsWith('en'))
    ? (LANG_MAP[langCode] || { name: 'Hindi', native: 'हिन्दी' })
    : null;

  // Fetch real-time news headlines to ensure zero latency real-time accuracy (e.g. recent 2026 events)
  const liveNews = await fetchLiveNews(newsText);
  console.log(`[Gemini Service] Live news items retrieved: ${liveNews.length}`);

  const liveNewsText = liveNews.length > 0
    ? `REAL-TIME NEWS SEARCH CONTEXT (Retrieved live):\n` + liveNews.map(n => `- ${n.title} (${n.sourceName || 'News'}) | Link: ${n.uri}`).join('\n')
    : `(No live news context retrieved)`;

  const langInstruction = targetLang
    ? `In "explanation_regional", translate the short, detailed 1-sentence explanation into ${targetLang.name} (${targetLang.native} script). In "keyPoints_regional", provide 2 short, detailed key points translated into ${targetLang.name} (${targetLang.native} script).`
    : `(English output only required)`;

  const prompt = `You are an expert fact-checker. Evaluate the accuracy of the user CLAIM below.

${liveNewsText}

CRITICAL VERDICT RULES:
- Set "verdict" to "REAL" if the live news context or facts confirm the user's CLAIM is true.
- Set "verdict" to "FAKE" if the user's CLAIM is false, incorrect, a rumor, or fake news.
- Set "verdict" to "MISLEADING" if the CLAIM is exaggerated or taken out of context.
- Set "verdict" to "UNVERIFIED" if the CLAIM cannot be confirmed with evidence.

EXPLANATION FORMAT:
- In "explanation", write a SHORT yet DETAILED 1-sentence explanation (under 25 words) stating the exact key facts, named entities, dates, or outlets confirming why the claim is true or false.
${langInstruction}
- In "keyPoints", provide 2 short, detailed bullet points (under 15 words each) giving specific supporting facts.
- In "sourceVerification", list major credible news outlets from the real-time context or verified portals.

Return ONLY valid JSON matching this schema:
  {"verdict":"REAL"|"FAKE"|"MISLEADING"|"UNVERIFIED","confidence":<0-100>,"explanation":"<short_detailed_explanation_english>","explanation_regional":"<short_detailed_explanation_target_language>","keyPoints":["<fact1_english>","<fact2_english>"],"keyPoints_regional":["<fact1_target_language>","<fact2_target_language>"],"bias":<0-100>,"sensationalism":<0-100>,"logicalConsistency":<0-100>,"sourceVerification":[{"title":"<outlet_name>","uri":"<url>","verified":<boolean>}]}
  
  CLAIM: "${newsText}"`;

  let response: any = null;
  let lastError: any = null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const CANDIDATE_MODELS = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.6-flash"
    ];

    for (const model of CANDIDATE_MODELS) {
      // Attempt 1: Try with googleSearch grounding tool
      try {
        console.log(`[Gemini Service] >>> Attempting model ${model} WITH googleSearch...`);
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
        console.log(`[Gemini Service] <<< ${model} (with googleSearch) SUCCESS in ${latency}ms`);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Service] ⚠️ ${model} with googleSearch failed (${err.status || 'unknown'}: ${err.message})`);

        // If googleSearch failed (e.g. 429 quota, tool unavailable), fallback to calling WITHOUT googleSearch using responseMimeType JSON
        try {
          console.log(`[Gemini Service] >>> Fallback: Attempting model ${model} WITHOUT googleSearch (JSON mode)...`);
          const startTime = Date.now();

          response = await ai.models.generateContent({
            model,
            contents: `You are an expert fact-checker. Evaluate this user CLAIM: "${newsText}".

${liveNewsText}

CRITICAL VERDICT RULES:
- Set "verdict" to "REAL" if the live news context or facts confirm the user's CLAIM is true.
- Set "verdict" to "FAKE" if the user's CLAIM is false, incorrect, a rumor, or fake news.
- Set "verdict" to "MISLEADING" if the CLAIM is exaggerated or taken out of context.
- Set "verdict" to "UNVERIFIED" if the CLAIM cannot be confirmed with evidence.

EXPLANATION FORMAT:
- In "explanation", write a SHORT yet DETAILED 1-sentence explanation (under 25 words) stating the exact key facts, named entities, dates, or outlets confirming why the claim is true or false.
${langInstruction}
- In "keyPoints", provide 2 short, detailed bullet points (under 15 words each) giving specific supporting facts.
- In "sourceVerification", list major credible news outlets from the real-time context or verified portals.`,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT' as any,
                properties: {
                  verdict: { type: 'STRING' as any, enum: ['REAL', 'FAKE', 'MISLEADING', 'UNVERIFIED'] },
                  confidence: { type: 'NUMBER' as any },
                  explanation: { type: 'STRING' as any },
                  explanation_regional: { type: 'STRING' as any },
                  keyPoints: { type: 'ARRAY' as any, items: { type: 'STRING' as any } },
                  keyPoints_regional: { type: 'ARRAY' as any, items: { type: 'STRING' as any } },
                  bias: { type: 'NUMBER' as any },
                  sensationalism: { type: 'NUMBER' as any },
                  logicalConsistency: { type: 'NUMBER' as any },
                  sourceVerification: {
                    type: 'ARRAY' as any,
                    items: {
                      type: 'OBJECT' as any,
                      properties: {
                        title: { type: 'STRING' as any },
                        uri: { type: 'STRING' as any },
                        verified: { type: 'BOOLEAN' as any }
                      },
                      required: ['title', 'uri']
                    }
                  }
                },
                required: ['verdict', 'confidence', 'explanation', 'keyPoints', 'bias', 'sensationalism', 'logicalConsistency', 'sourceVerification']
              }
            },
          });

          const latency = Date.now() - startTime;
          console.log(`[Gemini Service] <<< ${model} (standard fallback) SUCCESS in ${latency}ms`);
          break;
        } catch (fallbackErr: any) {
          lastError = fallbackErr;
          console.warn(`[Gemini Service] ⚠️ ${model} standard fallback failed (${fallbackErr.status || 'unknown'}: ${fallbackErr.message})`);
        }
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

    // Extract response text safely from SDK response or candidate parts
    const partsText = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    const directText = (typeof response.text === 'string' && response.text.trim()) ? response.text.trim() : '';
    const responseText: string = directText || partsText;
    console.log(`[Gemini Service] <<< Response text preview (${responseText.length} chars): ${responseText.substring(0, 200) || '(empty)'}`);

    if (!responseText || typeof responseText !== 'string') {
      throw new AnalysisError("Safety block triggered or empty response.", 'SAFETY');
    }

    const data = extractJson(responseText);

    if (!data || typeof data !== 'object') {
      throw new AnalysisError("Gemini returned unparseable JSON.", 'UNKNOWN');
    }

    const grounded = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sourceVerification: any[] = Array.isArray(data.sourceVerification) ? data.sourceVerification : [];
    
    // Map grounded sources or fall back to sourceVerification from AI model
    let sources = grounded.map((chunk: any) => {
      const webUri = chunk.web?.uri || "#";
      const svMatch = sourceVerification.find((v: any) => v?.uri === webUri);
      return {
        title: chunk.web?.title || svMatch?.title || "Verification Node",
        uri: webUri,
        verified: svMatch?.verified ?? true,
      };
    }).filter((s: any) => s.uri !== "#");

    if (sources.length === 0 && sourceVerification.length > 0) {
      sources = sourceVerification
        .filter((s: any) => s && typeof s.uri === 'string' && (s.uri.startsWith('http://') || s.uri.startsWith('https://')))
        .map((s: any) => ({
          title: (typeof s.title === 'string' && s.title.trim()) ? s.title.trim() : 'Verification Source',
          uri: s.uri.trim(),
          verified: typeof s.verified === 'boolean' ? s.verified : true,
        }));
    }

    if (sources.length === 0 && liveNews.length > 0) {
      sources = liveNews.map(n => ({
        title: n.title,
        uri: n.uri,
        verified: true,
      }));
    }

    // Prioritize highly credible news & fact-checking outlets first at the top of the sources list
    const CREDIBLE_DOMAINS = [
      'reuters.com', 'bbc.com', 'bbc.co.uk', 'apnews.com', 'pib.gov.in',
      'factcheck.org', 'altnews.in', 'snopes.com', 'thehindu.com',
      'timesofindia.indiatimes.com', 'indianexpress.com', 'bloomberg.com',
      'afp.com', 'ndtv.com'
    ];

    sources.sort((a: any, b: any) => {
      const getScore = (item: any) => {
        let score = item.verified ? 10 : 0;
        try {
          const host = new URL(item.uri).hostname.toLowerCase();
          const idx = CREDIBLE_DOMAINS.findIndex(d => host.includes(d));
          if (idx !== -1) {
            score += (100 - idx);
          } else if (host.includes('.gov') || host.includes('.edu') || host.includes('org')) {
            score += 50;
          }
        } catch {}
        return score;
      };
      return getScore(b) - getScore(a);
    });

    console.log(`[Gemini Service] Grounding sources extracted (${sources.length}):`, sources.length > 0 ? sources : "None");
    console.log(`[Gemini Service] Parsed verdict:`, data.verdict, '| confidence:', data.confidence);

    // Safe field extraction with explicit defaults & 0-1 to 0-100 scaling fix
    const VALID_VERDICTS = ['REAL', 'FAKE', 'MISLEADING', 'UNVERIFIED'];
    const verdict = VALID_VERDICTS.includes(data.verdict) ? data.verdict : 'UNVERIFIED';
    
    let rawConf = typeof data.confidence === 'number' && isFinite(data.confidence) ? data.confidence : 0;
    if (rawConf > 0 && rawConf <= 1) {
      rawConf = rawConf * 100;
    }
    const confidence = Math.max(0, Math.min(100, Math.round(rawConf)));

    let explanation = typeof data.explanation === 'string' && data.explanation.trim()
      ? data.explanation.trim()
      : "No clarification available.";

    // Ensure explanation stays short and simple (max 1 to 2 sentences)
    if (explanation.length > 250) {
      const sentenceMatch = explanation.match(/^.*?[.!?](?:\s+.*?[.!?])?/);
      if (sentenceMatch && sentenceMatch[0].length < 250) {
        explanation = sentenceMatch[0];
      }
    }

    const explanationRegional = (typeof data.explanation_regional === 'string' && data.explanation_regional.trim())
      ? data.explanation_regional.trim()
      : (typeof data.explanation_te === 'string' && data.explanation_te.trim() ? data.explanation_te.trim() : undefined);

    const keyPointsRegional = Array.isArray(data.keyPoints_regional)
      ? data.keyPoints_regional.filter((p: any) => typeof p === 'string')
      : (Array.isArray(data.keyPoints_te) ? data.keyPoints_te.filter((p: any) => typeof p === 'string') : undefined);

    return {
      verdict,
      confidence,
      explanation,
      explanation_te: explanationRegional,
      explanation_regional: explanationRegional,
      keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints.filter((p: any) => typeof p === 'string') : [],
      keyPoints_te: keyPointsRegional,
      keyPoints_regional: keyPointsRegional,
      targetLangCode: langCode,
      targetLangName: targetLang?.name,
      targetLangNative: targetLang?.native,
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

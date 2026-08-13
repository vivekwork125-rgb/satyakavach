/*
 * Temporary Debug Endpoint: GET /api/debug/gemini
 * Performs a minimal Gemini API test and returns the raw result or error.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    apiKeyPresent: !!apiKey,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}` : null,
    apiKeyLength: apiKey?.length || 0,
    nodeVersion: process.version,
    envVarsWithAPI: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API_KEY')),
  };

  if (!apiKey) {
    diagnostics.error = 'GEMINI_API_KEY is not set in environment';
    console.error('[Debug /api/debug/gemini]', diagnostics);
    return res.status(500).json(diagnostics);
  }

  // Test 1: Basic generateContent call
  try {
    console.log('[Debug /api/debug/gemini] Starting Gemini test...');
    const startTime = Date.now();
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Respond with exactly: GEMINI_OK",
      config: { temperature: 0 },
    });

    const partsText = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    const directText = (typeof response.text === 'string' && response.text.trim()) ? response.text.trim() : '';

    diagnostics.test1_basic = {
      status: 'SUCCESS',
      latencyMs: Date.now() - startTime,
      response: (directText || partsText).substring(0, 200),
    };
    console.log('[Debug /api/debug/gemini] Test 1 (basic): SUCCESS');
  } catch (error: any) {
    diagnostics.test1_basic = {
      status: 'FAILED',
      errorMessage: error.message,
      errorStatus: error.status,
      errorCode: error.code,
      errorName: error.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2).substring(0, 1000),
    };
    console.error('[Debug /api/debug/gemini] Test 1 (basic): FAILED -', error.message);
  }

  // Test 2: With Google Search grounding
  try {
    console.log('[Debug /api/debug/gemini] Starting grounding test...');
    const startTime = Date.now();
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Is the Earth round? Respond with one word.",
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const partsText = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    const directText = (typeof response.text === 'string' && response.text.trim()) ? response.text.trim() : '';

    diagnostics.test2_grounding = {
      status: 'SUCCESS',
      latencyMs: Date.now() - startTime,
      response: (directText || partsText).substring(0, 200),
      hasGroundingMetadata: !!response.candidates?.[0]?.groundingMetadata,
    };
    console.log('[Debug /api/debug/gemini] Test 2 (grounding): SUCCESS');
  } catch (error: any) {
    diagnostics.test2_grounding = {
      status: 'QUOTA_OR_UNAVAILABLE',
      errorMessage: error.message,
      errorStatus: error.status,
      errorCode: error.code,
      note: 'Search grounding tool requires billing/tier. System safely falls back to standard generation.',
    };
    console.warn('[Debug /api/debug/gemini] Test 2 (grounding): QUOTA/UNAVAILABLE -', error.message);
  }

  const basicPassed = diagnostics.test1_basic?.status === 'SUCCESS';
  diagnostics.overallStatus = basicPassed ? 'SYSTEM_OPERATIONAL' : 'SYSTEM_ERROR';

  console.log('[Debug /api/debug/gemini] Full diagnostics:', JSON.stringify(diagnostics, null, 2));
  return res.status(basicPassed ? 200 : 500).json(diagnostics);
}

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function test() {
  console.log("=== GEMINI API TEST ===");
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Key loaded:", apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : "MISSING KEY");

  if (!apiKey) {
    console.error("No API key in .env");
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    console.log("Listing available models from Google AI API...");
    const modelsResponse = await ai.models.list();
    console.log("Available models:");
    for await (const m of modelsResponse) {
      const supportedGenerationMethods = (m as any).supportedGenerationMethods;
      if (supportedGenerationMethods?.includes('generateContent')) {
        console.log(` - ${m.name}`);
      }
    }
  } catch (error: any) {
    console.error("\n❌ FAILED - Server responded with:");
    if (error.status) console.error("HTTP Status:", error.status);
    console.error("Message:", error.message);
    if (error.response?.data) console.error("Details:", JSON.stringify(error.response.data));
  }
}

test();

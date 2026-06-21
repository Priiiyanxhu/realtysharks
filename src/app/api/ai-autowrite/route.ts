import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const systemPrompt = `
      You are an elite real estate assistant.
      Write a highly personalized, accurate, and unique summary based strictly on the user's provided details.
      Do not hallucinate, do not add fake features, and do not use generic placeholders like [Location] or [Price].
      Use only the facts provided. Be specific, correct, and suitable for high-net-worth institutional brokers.
      Keep it professional, concise, and focused. Return only the description text.
      
      User Details:
      ${prompt}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
    });

    return NextResponse.json({ description: response.text });
  } catch (error: unknown) {
    console.error("AI Auto-write Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
  }
}

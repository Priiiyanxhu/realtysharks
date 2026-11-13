import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createSupabaseServerClient, getVerifiedUserId } from '@/utils/supabase/server';
import { interpretQuotaResult } from '@/utils/aiQuota';

const MAX_PROMPT_LENGTH = 4000;

export async function POST(req: Request) {
  // Defense in depth: don't rely on src/proxy.ts alone to gate paid API usage.
  const userId = await getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let prompt: unknown;
  try {
    ({ prompt } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: 'Prompt is too long' }, { status: 413 });
  }

  // Spend a unit of quota only for a request that is otherwise valid, and before
  // the paid call. Identity comes from the caller's own session (auth.uid() in the
  // database), so there is nothing to forge and no service-role key is needed.
  // Fails closed: if the quota cannot be checked, Gemini is not called.
  const supabase = await createSupabaseServerClient();
  const { data: quotaData, error: quotaError } = await supabase.rpc('consume_ai_quota');
  const quota = interpretQuotaResult(quotaData, quotaError);

  if (quota.kind === 'unavailable') {
    console.error('AI quota check failed.', { code: quotaError?.code });
    return NextResponse.json({ error: quota.message }, { status: quota.status });
  }
  if (quota.kind === 'limited') {
    return NextResponse.json(
      { error: quota.message, retryAfterSeconds: quota.retryAfterSeconds },
      { status: quota.status, headers: { 'Retry-After': String(quota.retryAfterSeconds) } }
    );
  }

  try {
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
  } catch (error) {
    console.error("AI Auto-write Error:", error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
  }
}

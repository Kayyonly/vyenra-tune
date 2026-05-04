import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT =
  'You are a music assistant. Help users with song recommendations, lyrics meaning, mood-based playlists, and artist info. Keep answers concise, helpful, and friendly in Indonesian when possible.';

export async function POST(request: Request) {
  try {
    const { message } = (await request.json()) as { message?: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 500 });
    }

    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${message.trim()}` }],
        },
      ],
    });

    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json({ reply: 'Maaf, aku belum bisa menjawab sekarang. Coba pertanyaan lain ya.' });
    }

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('Ai Music API error:', error);
    return NextResponse.json({ error: 'AI sedang sibuk, coba lagi' }, { status: 500 });
  }
}

import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT =
  'You are a music assistant. Help users with song recommendations, lyrics meaning, mood-based playlists, and artist info. Keep answers concise, helpful, and friendly in Indonesian when possible.';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Ai Music API error: GEMINI_API_KEY is missing');
      return NextResponse.json({ error: 'Konfigurasi AI belum aktif. Hubungi admin.' }, { status: 500 });
    }

    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
      },
      contents: message,
    });

    const reply = response.text?.trim();
    if (!reply) {
      return NextResponse.json({ error: 'Respons AI kosong, coba lagi.' }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Ai Music API error detail:', detail);
    return NextResponse.json({ error: 'Terjadi error, coba lagi', details: detail }, { status: 500 });
  }
}

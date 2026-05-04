import { NextResponse } from 'next/server';

type RateLimitEntry = { count: number; resetAt: number };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  rateLimitMap.set(key, current);
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak request. Coba lagi sebentar.' },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ success: false, error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }

    if (message.length > 1500) {
      return NextResponse.json({ success: false, error: 'Pesan terlalu panjang.' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const upstream = await fetch('https://daunsloveelaina.daunscode.com/v1/ai/deepai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: message }),
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timeout));

    const rawText = await upstream.text();
    let payload: Record<string, unknown> | null = null;

    try {
      payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      console.error('Ai Music upstream error:', {
        status: upstream.status,
        statusText: upstream.statusText,
        body: rawText,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Layanan AI sedang bermasalah. Coba lagi nanti.',
        },
        { status: 502 },
      );
    }

    const replyCandidate =
      (typeof payload?.reply === 'string' && payload.reply) ||
      (typeof payload?.result === 'string' && payload.result) ||
      (typeof payload?.response === 'string' && payload.response) ||
      (typeof payload?.message === 'string' && payload.message) ||
      '';

    const reply = replyCandidate.trim();

    if (!reply) {
      return NextResponse.json(
        {
          success: false,
          error: 'Respons AI kosong. Coba pertanyaan lain.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Ai Music API internal error:', detail);

    return NextResponse.json(
      {
        success: false,
        error: 'Terjadi error, coba lagi',
      },
      { status: 500 },
    );
  }
}
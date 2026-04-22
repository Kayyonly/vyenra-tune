import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { sendOtpEmail } from '@/lib/email';
import { canSendOtp, markOtpSent, upsertOtp } from '@/lib/otp-store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateOtp = (): string => randomInt(100000, 1000000).toString();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid.' },
        { status: 400 },
      );
    }

    const rateLimit = canSendOtp(email);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Terlalu banyak permintaan OTP. Coba lagi nanti.',
          retryAfterMs: rateLimit.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimit.retryAfterMs / 1000).toString(),
          },
        },
      );
    }

    const code = generateOtp();
    const otpRecord = upsertOtp(email, code);

    await sendOtpEmail({ email, code });
    markOtpSent(email);

    return NextResponse.json({
      success: true,
      expiresAt: otpRecord.expiresAt,
      message: 'Kode OTP berhasil dikirim ke email.',
    });
  } catch (error) {
    console.error('send-code error', error);
    return NextResponse.json(
      { error: 'Gagal mengirim OTP. Silakan coba lagi.' },
      { status: 500 },
    );
  }
}

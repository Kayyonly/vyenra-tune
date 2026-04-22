import { NextResponse } from 'next/server';
import { sendOtpEmail } from '@/lib/email';
import { canSendOtp, generateOtpCode, saveOtp } from '@/lib/otp';
import { stageRegistration, verifyLoginPassword } from '@/lib/user-account-store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const mode = String(body?.mode ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();
    const name = String(body?.name ?? '').trim();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, message: 'Email tidak valid' }, { status: 400 });
    }

    if (mode === 'register') {
      if (!name || password.length < 6) {
        return NextResponse.json(
          { success: false, message: 'Nama dan password minimal 6 karakter wajib diisi.' },
          { status: 400 },
        );
      }
      await stageRegistration(email, name, password);
    }

    if (mode === 'login') {
      if (!password) {
        return NextResponse.json({ success: false, message: 'Password wajib diisi.' }, { status: 400 });
      }

      const loginCheck = await verifyLoginPassword(email, password);
      if (!loginCheck.success) {
        const status = loginCheck.message === 'Email tidak terdaftar' ? 404 : 401;
        return NextResponse.json({ success: false, message: loginCheck.message }, { status });
      }
    }

    const rateLimit = await canSendOtp(email);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Terlalu cepat meminta OTP. Coba lagi.',
          retryAfterMs: rateLimit.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          },
        },
      );
    }

    const otp = generateOtpCode();
    const otpRecord = await saveOtp(email, otp);
    const emailResult = await sendOtpEmail({ email, code: otp });

    if (!emailResult.success) {
      return NextResponse.json({ success: false, message: 'Gagal mengirim OTP ke email.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      expiresAt: otpRecord.expiresAt,
      expiresInMs: otpRecord.expiresAt - Date.now(),
    });
  } catch (error) {
    console.error('[SEND_OTP_ROUTE_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Gagal kirim OTP' }, { status: 500 });
  }
}
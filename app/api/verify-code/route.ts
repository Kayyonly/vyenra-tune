import { NextResponse } from 'next/server';
import { getOtpByEmail, removeOtp } from '@/lib/otp-store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const code = String(body?.code ?? '').trim();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid.' },
        { status: 400 },
      );
    }

    if (!CODE_REGEX.test(code)) {
      return NextResponse.json(
        { error: 'Kode OTP harus 6 digit angka.' },
        { status: 400 },
      );
    }

    const record = getOtpByEmail(email);

    if (!record) {
      return NextResponse.json(
        { error: 'Kode OTP sudah expired. Silakan kirim ulang.' },
        { status: 400 },
      );
    }

    if (record.code !== code) {
      return NextResponse.json({ error: 'Kode OTP salah.' }, { status: 400 });
    }

    removeOtp(email);

    return NextResponse.json({
      success: true,
      message: 'Verifikasi OTP berhasil. Login sukses.',
    });
  } catch (error) {
    console.error('verify-code error', error);
    return NextResponse.json(
      { error: 'Gagal memverifikasi OTP.' },
      { status: 500 },
    );
  }
}

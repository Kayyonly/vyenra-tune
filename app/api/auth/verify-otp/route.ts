import { cookies as getCookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';
import { createAuthSession } from '@/lib/auth-session';
import { verifyOtp } from '@/lib/otp';
import { finalizeRegistration, getUserAccount } from '@/lib/user-account-store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const inputOtp = String(body?.otp ?? body?.code ?? '').trim();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, message: 'Email tidak valid' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(inputOtp)) {
      return NextResponse.json({ success: false, message: 'OTP salah' }, { status: 400 });
    }

    const verification = await verifyOtp(email, inputOtp);
    if (!verification.success) {
      return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }

    await finalizeRegistration(email);

    const { id, maxAgeSeconds } = createAuthSession(email);
    const cookieStore = await getCookies();
    cookieStore.set(AUTH_COOKIE_NAME, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    const account = await getUserAccount(email);

    return NextResponse.json({ success: true, user: account });
  } catch (error) {
    console.error('[VERIFY_OTP_ROUTE_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Gagal verifikasi OTP' }, { status: 500 });
  }
}
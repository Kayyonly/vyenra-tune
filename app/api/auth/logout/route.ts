import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';
import { clearSession } from '@/lib/auth-session';

export async function POST() {
  const cookieStore = await cookies();
  clearSession();
  cookieStore.delete(AUTH_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from './auth-constants'
import { getSessionById } from './auth-session';

export async function requireAuthEmail() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = getSessionById(sessionId);
  return session?.email ?? null;
}
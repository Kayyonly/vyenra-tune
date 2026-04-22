import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomePageClient from '@/components/HomePageClient';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';
import { getSessionById } from '@/lib/auth-session';

export default async function Page() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = getSessionById(sessionId);

  if (!session) {
    redirect('/auth');
  }

  return <HomePageClient />;
}
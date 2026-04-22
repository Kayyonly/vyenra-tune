import { NextResponse } from 'next/server';
import { requireAuthEmail } from '@/lib/auth-user';
import { getUserAccount } from '@/lib/user-account-store';

export async function GET() {
  const email = await requireAuthEmail();

  if (!email) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserAccount(email);
  return NextResponse.json({ success: true, user });
}

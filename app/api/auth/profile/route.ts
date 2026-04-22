import { NextResponse } from 'next/server';
import { requireAuthEmail } from '@/lib/auth-user';
import { updateUserProfile } from '@/lib/user-account-store';

export async function POST(req: Request) {
  const email = await requireAuthEmail();

  if (!email) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body?.name ?? '').trim();
  const avatarUrl = String(body?.avatarUrl ?? '').trim();

  if (!name) {
    return NextResponse.json({ success: false, message: 'Nama wajib diisi.' }, { status: 400 });
  }

  const user = await updateUserProfile(email, { name, avatarUrl: avatarUrl || undefined });
  return NextResponse.json({ success: true, user });
}

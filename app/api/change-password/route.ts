import { NextResponse } from 'next/server';
import { requireAuthEmail } from '@/lib/auth-user';
import { changePassword } from '@/lib/user-account-store';

export async function POST(req: Request) {
  const email = await requireAuthEmail();

  if (!email) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const oldPassword = String(body?.oldPassword ?? '');
  const newPassword = String(body?.newPassword ?? '');
  const confirmPassword = String(body?.confirmPassword ?? '');

  if (!oldPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ success: false, message: 'Semua field password wajib diisi.' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ success: false, message: 'Password baru minimal 6 karakter.' }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ success: false, message: 'Konfirmasi password tidak sama.' }, { status: 400 });
  }

  const result = await changePassword(email, oldPassword, newPassword);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
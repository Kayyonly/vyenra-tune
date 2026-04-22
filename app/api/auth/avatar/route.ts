import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireAuthEmail } from '@/lib/auth-user';
import { getUserAccount, updateUserProfile } from '@/lib/user-account-store';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function normalizeFileName(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function parseBase64Image(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const buffer = Buffer.from(match[3], 'base64');
  return { buffer, ext };
}

export async function POST(req: Request) {
  try {
    const email = await requireAuthEmail();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const imageData = String(body?.imageData ?? '').trim();

    if (!imageData) {
      return NextResponse.json({ success: false, message: 'Foto wajib diisi.' }, { status: 400 });
    }

    const parsed = parseBase64Image(imageData);

    if (!parsed) {
      return NextResponse.json({ success: false, message: 'Format gambar harus JPG/PNG.' }, { status: 400 });
    }

    if (parsed.buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ success: false, message: 'Ukuran gambar maksimal 5MB.' }, { status: 400 });
    }

    const avatarDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(avatarDir, { recursive: true });

    const fileName = `${normalizeFileName(email)}-${Date.now()}.${parsed.ext}`;
    const filePath = path.join(avatarDir, fileName);
    await writeFile(filePath, parsed.buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;
    const currentUser = await getUserAccount(email);
    const user = await updateUserProfile(email, { name: currentUser.name, avatarUrl });

    return NextResponse.json({ success: true, avatarUrl, user });
  } catch (error) {
    console.error('[UPLOAD_AVATAR_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Gagal upload avatar.' }, { status: 500 });
  }
}
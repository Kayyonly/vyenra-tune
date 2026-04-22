'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AvatarImage } from '@/components/AvatarImage';

const DEFAULT_AVATAR = '/default-avatar.png';

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(DEFAULT_AVATAR);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setAvatarPreview(user.avatarUrl || DEFAULT_AVATAR);
  }, [user]);

  const previewLabel = useMemo(() => {
    if (isUploading) return 'Mengunggah foto...';
    return 'Ganti Foto';
  }, [isUploading]);

  const uploadAvatar = async (file: File) => {
    const reader = new FileReader();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Gagal membaca file.'));
      };
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: dataUrl }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message ?? 'Gagal upload foto.');
    }

    setAvatarPreview(payload.avatarUrl || DEFAULT_AVATAR);
    setUser(payload.user);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setMessage('');

    const isAllowedType = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isAllowedType) {
      setError('File harus JPG atau PNG.');
      return;
    }

    try {
      setIsUploading(true);
      await uploadAvatar(file);
      setMessage('Foto profile berhasil diunggah.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Gagal upload foto.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), avatarUrl: avatarPreview }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message ?? 'Gagal menyimpan profile.');
        return;
      }

      setUser(payload.user);
      setMessage('Profile berhasil disimpan.');
    } catch {
      setError('Terjadi gangguan jaringan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-900/80 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-zinc-400">Kelola data profile akun Vynra Tune kamu.</p>

        <form onSubmit={onSave} className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/10">
              <AvatarImage src={avatarPreview} alt="Avatar preview" fill sizes="80px" className="object-cover" />
            </div>
            <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              {previewLabel}
              <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={onFileChange} disabled={isUploading} />
            </label>
          </div>

          <label className="block text-sm text-zinc-300">
            Nama
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            />
          </label>

          <label className="block text-sm text-zinc-300">
            Email
            <input
              type="email"
              value={email}
              readOnly
              className="mt-2 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400"
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Profile'}
          </button>
        </form>
      </div>
    </main>
  );
}

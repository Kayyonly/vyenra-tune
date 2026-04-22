'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { savePendingEmail } from '@/lib/auth-client-storage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REQUEST_TIMEOUT_MS = 15000;
const SEND_OTP_ENDPOINT = '/api/auth/send-otp';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('[REGISTER] Submit triggered');
    const normalizedEmail = form.email.trim().toLowerCase();

    if (!form.name.trim() || !normalizedEmail || !form.password || !form.confirmPassword) {
      setError('Semua field wajib diisi.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Format email tidak valid.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Password dan konfirmasi password harus sama.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OTP_REQUEST_TIMEOUT_MS);
      const res = await (async () => {
        try {
          return await fetch(SEND_OTP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: normalizedEmail,
              password: form.password,
              name: form.name.trim(),
              mode: 'register',
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      })();

      const responseText = await res.text();
      console.log('[REGISTER] send-otp raw response:', {
        status: res.status,
        ok: res.ok,
        body: responseText,
      });
      let data: { message?: string; success?: boolean } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('[REGISTER] Failed to parse send-otp response JSON:', parseError);
      }

      if (!res.ok) {
        console.error('OTP ERROR:', data);
        throw new Error(data?.message || 'Gagal kirim OTP');
      }

      console.log('OTP SUCCESS:', data);
      savePendingEmail(normalizedEmail);
      router.push('/verify');
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === 'AbortError') {
        console.error('[REGISTER] OTP request timeout');
        setError('Permintaan OTP timeout. Coba lagi.');
        return;
      }

      console.error('[REGISTER] OTP request failed:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Terjadi gangguan jaringan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Register" description="Buat akun baru untuk memulai pengalaman musik terbaikmu.">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm text-zinc-300">
          Nama
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="Nama kamu"
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="email@domain.com"
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="Minimal 8 karakter"
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Konfirmasi Password
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="Ketik ulang password"
          />
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Mengirim OTP...' : 'Lanjutkan'}
        </button>

        <p className="text-center text-sm text-zinc-400">
          Sudah punya akun?{' '}
          <Link href="/auth/login" className="font-medium text-white underline underline-offset-4">
            Login
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

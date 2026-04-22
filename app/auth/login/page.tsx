'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { savePendingEmail } from '@/lib/auth-client-storage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Email tidak valid.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, mode: 'login' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? 'Gagal melanjutkan login.');
        return;
      }

      savePendingEmail(normalizedEmail);
      if (rememberMe) {
        localStorage.setItem('vynra_remember_me', 'true');
      } else {
        localStorage.removeItem('vynra_remember_me');
      }

      router.push('/verify');
    } catch (requestError) {
      console.error(requestError);
      setError('Terjadi gangguan jaringan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Login" description="Masuk ke Vynra Tune dan lanjutkan playlist favoritmu.">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm text-zinc-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="email@domain.com"
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="Password"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-transparent accent-blue-500"
          />
          Ingat Saya
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <p className="text-right text-sm">
          <Link href="/auth/forgot-password" className="text-zinc-300 underline underline-offset-4 hover:text-white">
            Lupa Password?
          </Link>
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Memproses...' : 'Lanjutkan'}
        </button>

        <p className="text-center text-sm text-zinc-400">
          Belum punya akun?{' '}
          <Link href="/auth/register" className="font-medium text-white underline underline-offset-4">
            Register
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
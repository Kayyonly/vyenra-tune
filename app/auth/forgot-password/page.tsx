'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { OTPInput } from '@/components/auth/OTPInput';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Masukkan email yang valid.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, mode: 'reset' }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message ?? 'Gagal mengirim OTP.');
        return;
      }

      setEmail(normalizedEmail);
      setStep('verify');
      setMessage('OTP berhasil dikirim ke email kamu.');
    } catch {
      setError('Terjadi gangguan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword, confirmPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message ?? 'Gagal reset password.');
        return;
      }

      setMessage('Password berhasil diubah. Silakan kembali ke halaman login.');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Terjadi gangguan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Forgot Password" description="Reset password dengan OTP email.">
      {step === 'request' ? (
        <form onSubmit={sendOtp} className="space-y-4">
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

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
          >
            {loading ? 'Mengirim OTP...' : 'Kirim OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4">
          <OTPInput value={otp} onChange={setOtp} disabled={loading} />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="Password baru"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
            placeholder="Konfirmasi password baru"
          />

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
          >
            {loading ? 'Memproses...' : 'Reset Password'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-zinc-400">
        Kembali ke{' '}
        <Link href="/auth/login" className="text-white underline underline-offset-4">
          Login
        </Link>
      </p>
    </AuthFrame>
  );
}

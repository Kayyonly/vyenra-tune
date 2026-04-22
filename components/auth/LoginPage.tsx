'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { OTPInput } from '@/components/auth/OTPInput';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

type LoginPageProps = {
  mode?: 'login' | 'register';
};

export function LoginPage({ mode = 'login' }: LoginPageProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [success, setSuccess] = useState('');
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  const otpRemainingSeconds = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.ceil((expiresAt - now) / 1000);
  }, [expiresAt, now]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const startResendCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Format email tidak valid.');
      return;
    }

    setLoadingSend(true);

    try {
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? 'Gagal mengirim kode OTP.');
        return;
      }

      setEmail(normalizedEmail);
      setExpiresAt(Number(data.expiresAt));
      setOtp('');
      setStep('otp');
      setSuccess('Kode verifikasi sudah dikirim ke email kamu.');
      startResendCooldown();
    } catch (requestError) {
      console.error(requestError);
      setError('Gagal mengirim kode. Periksa koneksi internet kamu.');
    } finally {
      setLoadingSend(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (!/^\d{6}$/.test(otp)) {
      setError('Kode salah atau expired');
      return;
    }

    setLoadingVerify(true);

    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? 'Kode salah atau expired');
        return;
      }

      setSuccess('Login berhasil. Selamat datang di Vynra Tune.');
    } catch (requestError) {
      console.error(requestError);
      setError('Terjadi gangguan jaringan. Coba lagi.');
    } finally {
      setLoadingVerify(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;

    clearMessages();
    setLoadingResend(true);

    try {
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? 'Gagal kirim ulang kode.');
        return;
      }

      setExpiresAt(Number(data.expiresAt));
      setOtp('');
      setSuccess('Kode OTP baru sudah dikirim.');
      startResendCooldown();
    } catch (requestError) {
      console.error(requestError);
      setError('Gagal kirim ulang kode. Coba sebentar lagi.');
    } finally {
      setLoadingResend(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-zinc-900 to-black px-6 font-[system-ui]">
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.section
              key="email-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30 backdrop-blur-xl"
            >
              <h1 className="text-2xl font-semibold text-white">{mode === 'login' ? 'Login ke Vynra Tune' : 'Register Vynra Tune'}</h1>
              <p className="mt-2 text-sm text-gray-400">{mode === 'login' ? 'Masuk cepat pakai verifikasi email.' : 'Buat akun baru pakai verifikasi email.'}</p>

              <form onSubmit={sendCode} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm text-gray-300">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition-all duration-300 placeholder:text-gray-500 focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

                <button
                  type="submit"
                  disabled={loadingSend}
                  className="w-full rounded-xl bg-red-500 py-3 text-white font-medium transition-all duration-300 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loadingSend ? 'Mengirim...' : 'Kirim Kode'}
                </button>
              </form>
            </motion.section>
          ) : (
            <motion.section
              key="otp-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30 backdrop-blur-xl"
            >
              <button
                type="button"
                className="mb-4 inline-flex items-center text-gray-400 transition-all duration-300 hover:text-white"
                onClick={() => {
                  clearMessages();
                  setStep('email');
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
              </button>

              <h2 className="text-2xl font-semibold text-white">Masukkan Kode OTP</h2>
              <p className="mt-2 text-sm text-gray-400">Kami mengirim kode ke {email}</p>
              <p className="mt-1 text-xs text-gray-500">Berlaku: {formatSeconds(otpRemainingSeconds)}</p>

              <form onSubmit={verifyCode} className="mt-6 space-y-4">
                <OTPInput value={otp} onChange={setOtp} disabled={loadingVerify} />

                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

                <button
                  type="submit"
                  disabled={loadingVerify}
                  className="w-full rounded-xl bg-red-500 py-3 text-white font-medium transition-all duration-300 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loadingVerify ? 'Memverifikasi...' : 'Verifikasi'}
                </button>
              </form>

              <button
                type="button"
                disabled={loadingResend || resendCooldown > 0}
                onClick={resendCode}
                className="mt-4 text-sm text-gray-400 transition-all duration-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingResend
                  ? 'Mengirim ulang...'
                  : resendCooldown > 0
                    ? `Kirim ulang kode (${resendCooldown}s)`
                    : 'Kirim ulang kode'}
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
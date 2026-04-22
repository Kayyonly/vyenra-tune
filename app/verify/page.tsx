'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { OTPInput } from '@/components/auth/OTPInput';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { useAuthStore } from '@/store/authStore';
import {
  clearPendingEmail,
  clearPendingNextPath,
  getPendingEmail,
  getPendingNextPath,
} from '@/lib/auth-client-storage';

const RESEND_COOLDOWN = 30;
const RESEND_UNTIL_KEY = 'vynra_resend_until';

export default function VerifyPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const isResendDisabled = useMemo(() => cooldown > 0 || resending, [cooldown, resending]);

  const startCooldown = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    setCooldown(safeSeconds);
    sessionStorage.setItem(RESEND_UNTIL_KEY, String(Date.now() + safeSeconds * 1000));
  };

  useEffect(() => {
    console.log('LOGIN STATE:', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    const savedEmail = getPendingEmail();
    if (!savedEmail) {
      router.replace('/auth');
      return;
    }

    setEmail(savedEmail);

    const resendUntil = Number(sessionStorage.getItem(RESEND_UNTIL_KEY) ?? 0);
    const remaining = Math.ceil((resendUntil - Date.now()) / 1000);
    setCooldown(Math.max(0, remaining || RESEND_COOLDOWN));
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) {

      sessionStorage.removeItem(RESEND_UNTIL_KEY);
      return;
    }

    const timer = setInterval(() => {
      setCooldown((value) => {
        const next = value <= 1 ? 0 : value - 1;
        if (next === 0) {
          sessionStorage.removeItem(RESEND_UNTIL_KEY);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    if (loading || otp.length !== 6) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? 'Verifikasi gagal. Pastikan kode OTP benar.');
        return;
      }

      setUser(data?.user ?? email);
      const nextPath = getPendingNextPath();
      clearPendingEmail();
      clearPendingNextPath();
      router.replace(nextPath || '/');
      router.refresh();
    } catch (requestError) {
      console.error(requestError);
      setError('Terjadi gangguan jaringan, coba lagi');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!email || cooldown > 0 || resending) return;

    setError('');
    setResending(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (typeof data?.retryAfterSeconds === 'number') {
          startCooldown(data.retryAfterSeconds);
        }
        setError(data?.message ?? 'Gagal kirim ulang OTP');
        return;
      }

      startCooldown(RESEND_COOLDOWN);
      setOtp('');
    } catch (requestError) {
      console.error(requestError);
      setError('Gagal kirim ulang OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthFrame title="Enter OTP" description={email ? `Kode dikirim ke ${email}` : 'Kode dikirim ke email kamu'}>
      <form onSubmit={verifyOtp} className="space-y-5">
        <OTPInput value={otp} onChange={setOtp} disabled={loading} />

        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Memverifikasi...' : 'Verify & Continue'}
        </button>
      </form>

      <button
        onClick={resendOtp}
        disabled={isResendDisabled}
        className="mt-4 w-full text-sm text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cooldown > 0 ? `Kirim ulang OTP dalam ${cooldown}s` : 'Kirim ulang OTP'}
      </button>
    </AuthFrame>
  );
}

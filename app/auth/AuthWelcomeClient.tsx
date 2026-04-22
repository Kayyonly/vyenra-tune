'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { savePendingNextPath } from '@/lib/auth-client-storage';

type AuthWelcomeClientProps = {
  nextPath?: string;
};

export default function AuthWelcomeClient({ nextPath }: AuthWelcomeClientProps) {
  useEffect(() => {
    if (nextPath) {
      savePendingNextPath(nextPath);
    }
  }, [nextPath]);

  return (
    <AuthFrame
      title="Welcome to Vynra Tune"
      description="Streaming musik favoritmu dengan pengalaman yang bersih, modern, dan fokus ke kamu."
    >
      <div className="space-y-4">
        <Link
          href="/auth/register"
          className="block rounded-2xl bg-blue-500 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-blue-400"
        >
          Register
        </Link>
        <Link
          href="/auth/login"
          className="block rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-white/10"
        >
          Login
        </Link>
      </div>
    </AuthFrame>
  );
}

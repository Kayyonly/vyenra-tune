'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Disc3 } from 'lucide-react';

export function AuthGatePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-black via-zinc-900 to-black px-6 text-center font-[system-ui]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 shadow-lg shadow-black/30 backdrop-blur-xl">
          <Disc3 className="h-6 w-6" />
        </div>

        <h1 className="text-3xl font-bold text-white">Vynra Tune</h1>
        <p className="mt-2 text-sm text-gray-400">Your music, your vibe.</p>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="w-full rounded-xl bg-white py-3 text-center font-medium text-black transition-all duration-300 hover:bg-zinc-100"
          >
            Login
          </Link>

          <Link
            href="/auth/register"
            className="w-full rounded-xl border border-white/20 py-3 text-center font-medium text-white transition-all duration-300 hover:bg-white/10"
          >
            Register
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

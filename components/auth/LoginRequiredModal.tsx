'use client';

import { useRouter } from 'next/navigation';
import { useLoginModalStore } from '@/store/loginModalStore';

export function LoginRequiredModal() {
  const router = useRouter();
  const isOpen = useLoginModalStore((state) => state.isOpen);
  const close = useLoginModalStore((state) => state.close);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-required-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171b] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="login-required-title" className="text-xl font-semibold text-white">
          Login Diperlukan
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Login untuk menyimpan lagu dan membuat playlist
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              close();
              router.push('/auth');
            }}
            className="flex-1 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            Login / Register
          </button>
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            Nanti saja
          </button>
        </div>
      </div>
    </div>
  );
}

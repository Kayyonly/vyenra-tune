'use client';

import { Dispatch, SetStateAction } from 'react';
import { LogOut, LockKeyhole, UserCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AvatarImage } from '../AvatarImage';

type HomeSidebarProps = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

export function HomeSidebar({ open, setOpen }: HomeSidebarProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const onLogout = async () => {
    await logout();
    setOpen(false);
    router.replace('/auth');
  };

  return (
    <>
      <button
        aria-label="Close sidebar backdrop"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[82%] max-w-xs border-r border-white/10 bg-[#101114]/95 p-5 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Vynra Tune</p>
          <button onClick={() => setOpen(false)} className="rounded-full p-2 text-zinc-300 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-full">
            <AvatarImage src={user?.avatarUrl} alt="User avatar" fill sizes="56px" className="object-cover" />
          </div>
          <p className="mt-3 text-base font-semibold text-white">{user?.name || 'Vynra User'}</p>
          <p className="text-xs text-zinc-400">{user?.email || '-'}</p>
        </div>

        <nav className="mt-6 space-y-2">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 text-sm text-white transition hover:bg-white/10"
          >
            <UserCircle2 className="h-4 w-4" />
            Profile
          </Link>

          <Link
            href="/change-password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 text-sm text-white transition hover:bg-white/10"
          >
            <LockKeyhole className="h-4 w-4" />
            Ganti Password
          </Link>

          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-sm text-red-200 transition hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </aside>
    </>
  );
}

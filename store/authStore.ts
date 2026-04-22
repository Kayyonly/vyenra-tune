'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthUser = {
  email: string;
  name: string;
  avatarUrl: string;
};

type AuthState = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  setUser: (user: AuthUser) => void;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
};

function buildUserFromEmail(emailValue: string): AuthUser {
  const normalizedEmail = emailValue.trim().toLowerCase();
  const atIndex = normalizedEmail.indexOf('@');
  const fallbackName = atIndex > 0 ? normalizedEmail.slice(0, atIndex) : 'Vynra User';

  return {
    email: normalizedEmail,
    name: fallbackName,
    avatarUrl: '/deafult-avatar.png',
  };
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      setUser: (nextUser) => {
        if (typeof nextUser === 'string') {
          const parsedUser = buildUserFromEmail(nextUser);
          set({ user: parsedUser, isLoggedIn: true });
          return;
        }

        set({ user: nextUser, isLoggedIn: true });
      },
      fetchUser: async () => {
        try {
          const response = await fetch('/api/auth/me');
          const payload = await response.json();

          if (!response.ok) {
            set({ user: null, isLoggedIn: false });
            return;
          }

          set({ user: payload.user, isLoggedIn: true });
        } catch {
          set({ user: null, isLoggedIn: false });
        }
      },
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('logout failed', error);
        }
        set({ user: null, isLoggedIn: false });
      },
    }),
    {
      name: 'vynra-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

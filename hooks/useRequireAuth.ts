'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLoginModalStore } from '@/store/loginModalStore';

type AuthAction = () => void | Promise<void>;

export function useRequireAuth() {
  const user = useAuthStore((state) => state.user);
  const openLoginModal = useLoginModalStore((state) => state.open);

  return useCallback(
    (action: AuthAction) => {
      if (!user) {
        openLoginModal();
        return false;
      }

      void action();
      return true;
    },
    [user, openLoginModal],
  );
}

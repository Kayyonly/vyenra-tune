'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function usePWAInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');

    const syncPlatformState = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      const iOS = /iphone|ipad|ipod/.test(ua);
      const nav = window.navigator as NavigatorWithStandalone;
      const standalone = standaloneQuery.matches || Boolean(nav.standalone);

      setIsIOS(iOS);
      setIsStandalone(standalone);

      if (standalone) {
        deferredPromptRef.current = null;
        setHasPrompt(false);
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setHasPrompt(true);
      syncPlatformState();
    };

    syncPlatformState();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    standaloneQuery.addEventListener('change', syncPlatformState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      standaloneQuery.removeEventListener('change', syncPlatformState);
    };
  }, []);

  useEffect(() => {
    console.log({
      hasPrompt,
      isIOS,
      isStandalone,
    });
  }, [hasPrompt, isIOS, isStandalone]);

  const installPWA = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt || isStandalone) {
      return { status: 'manual' as const };
    }

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      deferredPromptRef.current = null;
      setHasPrompt(false);
      return { status: 'accepted' as const };
    }

  return { status: 'dismissed' as const };
  }, [isStandalone]);

  const showInstallButton = !isStandalone;
  const requiresManualInstructions = showInstallButton && (!hasPrompt || isIOS);

  return useMemo(
    () => ({
      canInstall: hasPrompt && showInstallButton,
      hasPrompt,
      isIOS,
      isStandalone,
      showInstallButton,
      requiresManualInstructions,
      installPWA,
    }),
    [hasPrompt, installPWA, isIOS, isStandalone, requiresManualInstructions, showInstallButton],
  );
}
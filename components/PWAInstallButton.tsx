  'use client';

  import { useCallback, useEffect, useMemo, useState } from 'react';
  import { Download, Share2, X } from 'lucide-react';
  import { AnimatePresence, motion } from 'motion/react';
  import { usePWAInstall } from '@/hooks/usePWAInstall';
  import { usePlayerStore } from '@/lib/store';

  const DISMISS_KEY = 'pwa-dismissed';
  const DISMISS_TIME_KEY = 'pwa-dismissed-time';
  const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
  const POPUP_DELAY_MS = 7000;

  export function PWAInstallButton() {
    const currentTrack = usePlayerStore((state) => state.currentTrack);
    const {
      hasPrompt,
      isIOS,
      isStandalone,
      showInstallButton,
      requiresManualInstructions,
      installPWA,
    } = usePWAInstall();

    const [showSheet, setShowSheet] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    const bottomClassName = currentTrack ? 'bottom-[152px]' : 'bottom-[88px]';

    const helperText = useMemo(() => {
      if (isIOS) return 'Tap Share → Add to Home Screen';
      if (hasPrompt) return 'Install app for faster access';
      return 'Install not ready? Open browser menu and choose Install App';
    }, [hasPrompt, isIOS]);

    useEffect(() => {
      if (!showInstallButton || isStandalone) {
        return;
      }

      const dismissedAtRaw = localStorage.getItem(DISMISS_TIME_KEY);
      const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
      const hasDismissFlag = localStorage.getItem(DISMISS_KEY) === 'true';
      const stillInCooldown = hasDismissFlag && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;

      if (stillInCooldown) {
        return;
      }

      const timer = window.setTimeout(() => {
        setShowSheet(true);
      }, POPUP_DELAY_MS);

      return () => {
        window.clearTimeout(timer);
      };
    }, [isStandalone, showInstallButton]);

    const dismissPopup = useCallback(() => {
      localStorage.setItem(DISMISS_KEY, 'true');
      localStorage.setItem(DISMISS_TIME_KEY, String(Date.now()));
      setShowInstructions(false);
      setShowSheet(false);
    }, []);

    useEffect(() => {
      if (!showSheet && !showInstructions) {
        return;
      }

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          dismissPopup();
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => {
        window.removeEventListener('keydown', handleEscape);
      };
    }, [dismissPopup, showInstructions, showSheet]);

    const onInstallClick = async () => {
      if (hasPrompt) {
        await installPWA();
        setShowSheet(false);
        return;
      }

      setShowInstructions(true);
    };

    const canUseInstallUI = showInstallButton && !isStandalone;

    if (!canUseInstallUI) {
      return null;
    }

    return (
      <>
        {!showSheet && (
          <button
            onClick={() => setShowSheet(true)}
            className={`fixed ${bottomClassName} right-4 z-30 rounded-full border border-white/15 bg-[#121214]/90 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-xl hover:bg-[#1b1b1f] transition`}
          >
            Install App
          </button>
        )}

        <AnimatePresence>
          {showSheet && (
            <div className="fixed inset-0 z-40" onClick={dismissPopup}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
              />

              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 28 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`absolute ${bottomClassName} left-4 right-4 pointer-events-auto`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#121214]/95 p-4 backdrop-blur-xl shadow-2xl">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/90">Install Music App</h3>
                    <button
                      onClick={dismissPopup}
                      aria-label="Tutup popup install"
                      className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mb-4 text-sm text-white/70">{helperText}</p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        void onInstallClick();
                      }}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold transition hover:bg-white/90 active:scale-[0.99]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Install</span>
                    </button>
                    <button
                      onClick={dismissPopup}
                      className="h-11 rounded-xl border border-white/20 px-4 text-sm font-medium text-white/80 transition hover:bg-white/10"
                    >
                      Nanti saja
                    </button>
                  </div>

                  {requiresManualInstructions && (
                    <button
                      onClick={() => setShowInstructions((prev) => !prev)}
                      className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10"
                    >
                      How to install
                    </button>
                  )}

                  <AnimatePresence>
                    {showInstructions && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        {isIOS ? (
                          <ol className="space-y-2 text-xs text-white/80">
                            <li className="flex items-start gap-2"><span>1.</span><span>Tap tombol <Share2 className="inline h-3.5 w-3.5" /> Share di Safari.</span></li>
                            <li className="flex items-start gap-2"><span>2.</span><span>Pilih <strong>Add to Home Screen</strong>.</span></li>
                            <li className="flex items-start gap-2"><span>3.</span><span>Tap <strong>Add</strong> untuk selesai.</span></li>
                          </ol>
                        ) : (
                          <ol className="space-y-2 text-xs text-white/80">
                            <li className="flex items-start gap-2"><span>1.</span><span>Buka menu browser (⋮ / ⋯).</span></li>
                            <li className="flex items-start gap-2"><span>2.</span><span>Pilih <strong>Install app</strong> atau <strong>Add to Home screen</strong>.</span></li>
                            <li className="flex items-start gap-2"><span>3.</span><span>Konfirmasi instalasi.</span></li>
                          </ol>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

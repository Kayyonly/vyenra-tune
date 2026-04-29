'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import LyricsClient from '@/components/LyricsClient';
import { usePlayerStore } from '@/lib/store';
import { db } from '@/lib/db';
import YouTube from 'react-youtube';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Heart, ChevronDown, ListMusic, Mic2, Shuffle, Repeat, MoreVertical, Cast, ListPlus, User, X, AlertTriangle } from 'lucide-react';
import { cn, getHighResImage } from '@/lib/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMediaSession } from '@/hooks/useMediaSession';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export function Player() {
  const router = useRouter();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isExpanded = usePlayerStore((state) => state.isExpanded);
  const progress = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const setExpanded = usePlayerStore((state) => state.setExpanded);
  const setProgress = usePlayerStore((state) => state.setProgress);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const playNext = usePlayerStore((state) => state.playNext);
  const playPrev = usePlayerStore((state) => state.playPrev);
  const setTrackToAdd = usePlayerStore((state) => state.setTrackToAdd);
  const dominantColor = usePlayerStore((state) => state.dominantColor);
  const requireAuth = useRequireAuth();

  const [isLiked, setIsLiked] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  type AudioStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'error';
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [audioErrorCode, setAudioErrorCode] = useState<number | null>(null);
  const playerRef = useRef<any>(null);
  const pauseRequestedRef = useRef(false);
  const progressRafRef = useRef<number | null>(null);
  const durationRetryRef = useRef<number | null>(null);
  const autoSkipTimerRef = useRef<number | null>(null);

  const isValidVideoId = (id: string | undefined | null): id is string =>
    typeof id === 'string' && /^[A-Za-z0-9_-]{6,}$/.test(id);
  const hasValidVideoId = isValidVideoId(currentTrack?.videoId);


  useEffect(() => {
    if (currentTrack) {
      db.isLiked(currentTrack.videoId).then(setIsLiked);
    }
  }, [currentTrack]);

  const handleLike = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    requireAuth(async () => {
      if (!currentTrack) return;
      if (isLiked) {
        await db.removeLikedSong(currentTrack.videoId);
        setIsLiked(false);
      } else {
        await db.addLikedSong(currentTrack);
        setIsLiked(true);
      }
    });
  }, [currentTrack, isLiked, requireAuth]);

  const clearDurationRetry = () => {
    if (durationRetryRef.current !== null) {
      window.clearInterval(durationRetryRef.current);
      durationRetryRef.current = null;
    }
  };

  const clearAutoSkipTimer = () => {
    if (autoSkipTimerRef.current !== null) {
      window.clearTimeout(autoSkipTimerRef.current);
      autoSkipTimerRef.current = null;
    }
  };

  const tryRefreshDuration = useCallback(async (player: any) => {
    if (!player || typeof player.getDuration !== 'function') return;
    const d = await player.getDuration();
    if (d && d > 0) {
      setDuration(d);
      clearDurationRetry();
    }
  }, [setDuration]);

  const onReady = useCallback(async (event: any) => {
    playerRef.current = event.target;
    setAudioErrorCode(null);
    setAudioStatus('ready');
    clearAutoSkipTimer();

    const initialDuration = await event.target.getDuration();
    setDuration(initialDuration || 0);

    // Equivalent to audio.readyState / networkState diagnostics
    if (process.env.NEXT_PUBLIC_AUDIO_DEBUG === 'true') {
      console.log('[audio] onReady', {
        videoId: currentTrack?.videoId,
        videoUrl: typeof event.target.getVideoUrl === 'function' ? event.target.getVideoUrl() : undefined,
        playerState: typeof event.target.getPlayerState === 'function' ? event.target.getPlayerState() : undefined,
        duration: initialDuration,
      });
    }

    // Retry duration up to ~5s if YT returns 0 on first poll (root cause of 0:00 bug)
    if (!initialDuration || initialDuration <= 0) {
      clearDurationRetry();
      let attempts = 0;
      durationRetryRef.current = window.setInterval(() => {
        attempts += 1;
        if (attempts > 10) {
          clearDurationRetry();
          return;
        }
        void tryRefreshDuration(event.target);
      }, 500);
    }

    // Only start playback once player has signalled it's ready (canplay-equivalent)
    if (usePlayerStore.getState().isPlaying) {
      event.target.playVideo();
    }
  }, [setDuration, tryRefreshDuration, currentTrack?.videoId]);

  const onStateChange = useCallback(async (event: any) => {
    const state = event.data;

    if (process.env.NEXT_PUBLIC_AUDIO_DEBUG === 'true') {
      console.log('[audio] onStateChange', {
        videoId: currentTrack?.videoId,
        playerState: state,
      });
    }

    if (state === YouTube.PlayerState.PLAYING) {
      setAudioStatus('playing');
      setAudioErrorCode(null);
      setPlaying(true);
      const d = await event.target.getDuration();
      if (d && d > 0) {
        setDuration(d);
        clearDurationRetry();
      } else {
        // Still 0 — keep retrying to clear 0:00 stuck-state
        await tryRefreshDuration(event.target);
      }
    } else if (state === YouTube.PlayerState.PAUSED) {
      setAudioStatus('paused');
      const shouldBePlaying = usePlayerStore.getState().isPlaying;
      if (!pauseRequestedRef.current && shouldBePlaying) {
        event.target.playVideo();
      } else {
        setPlaying(false);
      }
      pauseRequestedRef.current = false;
      setPlaying(false);
    } else if (state === YouTube.PlayerState.BUFFERING) {
      setAudioStatus('buffering');
      // Late-arriving metadata: re-query duration if still 0
      const d = usePlayerStore.getState().duration;
      if (!d || d <= 0) await tryRefreshDuration(event.target);
    } else if (state === YouTube.PlayerState.ENDED) {
      playNext();
    }
  }, [setPlaying, setDuration, playNext, tryRefreshDuration, currentTrack?.videoId]);

  const onError = useCallback((event: any) => {
    const code: number = typeof event?.data === 'number' ? event.data : -1;
    // YT error codes: 2 invalid id, 5 html5 error, 100 not found / private, 101 & 150 embed disabled
    console.error('[audio] YouTube player error', {
      videoId: currentTrack?.videoId,
      errorCode: code,
      message: ({
        2: 'Invalid videoId',
        5: 'HTML5 player error',
        100: 'Video not found or private',
        101: 'Embed disabled by owner',
        150: 'Embed disabled by owner',
      } as Record<number, string>)[code] ?? 'Unknown error',
    });
    setAudioErrorCode(code);
    setAudioStatus('error');
    setPlaying(false);
    clearDurationRetry();

    // Auto-skip to next track for unrecoverable errors
    if (code === 100 || code === 101 || code === 150 || code === 2) {
      clearAutoSkipTimer();
      autoSkipTimerRef.current = window.setTimeout(() => {
        void playNext();
      }, 1500);
    }
  }, [currentTrack?.videoId, setPlaying, playNext]);

  const handleMediaPlay = useCallback(() => {
    pauseRequestedRef.current = false;
    setPlaying(true);
    playerRef.current?.playVideo?.();
  }, [setPlaying]);
  const handleMediaPause = useCallback(() => {
    pauseRequestedRef.current = true;
    setPlaying(false);
    playerRef.current?.pauseVideo?.();
  }, [setPlaying]);

  useMediaSession({
    track: currentTrack,
    isPlaying,
    onPlay: handleMediaPlay,
    onPause: handleMediaPause,
    onPrev: playPrev,
    onNext: () => {
      void playNext();
    },
  });

  useEffect(() => {
    if (!isPlaying) {
      if (progressRafRef.current) {
        cancelAnimationFrame(progressRafRef.current);
      }
      return;
    }

    let cancelled = false;

    const updateProgress = async () => {
      if (cancelled) {
        return;
      }

      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = await playerRef.current.getCurrentTime();
        if (!cancelled) {
          setProgress(time || 0);
        }
      }

      progressRafRef.current = requestAnimationFrame(updateProgress);
    };

    progressRafRef.current = requestAnimationFrame(updateProgress);

    return () => {
      cancelled = true;
      if (progressRafRef.current) {
        cancelAnimationFrame(progressRafRef.current);
      }
    };
  }, [isPlaying, setProgress]);

  // Reset progress + audio status whenever the track changes. Done during render
  // (React's recommended pattern) instead of an effect to avoid cascading renders.
  const [lastTrackedVideoId, setLastTrackedVideoId] = useState<string | null>(
    currentTrack?.videoId ?? null,
  );
  if (lastTrackedVideoId !== (currentTrack?.videoId ?? null)) {
    setLastTrackedVideoId(currentTrack?.videoId ?? null);
    setProgress(0);
    setAudioStatus(currentTrack?.videoId ? 'loading' : 'idle');
    setAudioErrorCode(null);
  }

  // Side-effect: clear pending timers when the videoId changes or component unmounts.
  useEffect(() => {
    return () => {
      clearDurationRetry();
      clearAutoSkipTimer();
    };
  }, [currentTrack?.videoId]);

  useEffect(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && usePlayerStore.getState().isPlaying && playerRef.current) {
        playerRef.current.playVideo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
          const osc = audioCtxRef.current.createOscillator();
          const gainNode = audioCtxRef.current.createGain();
          gainNode.gain.value = 0.0001; // Almost silent
          osc.connect(gainNode);
          gainNode.connect(audioCtxRef.current.destination);
          osc.start();
          oscillatorRef.current = osc;

          if (!usePlayerStore.getState().isPlaying) {
            audioCtxRef.current.suspend();
          }
        }
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (audioCtxRef.current) {
      if (isPlaying) {
        audioCtxRef.current.resume().catch(() => {});
      } else {
        audioCtxRef.current.suspend().catch(() => {});
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isLyricsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLyricsOpen(false);
      }
    };

    const onPopState = () => {
      setIsLyricsOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);
    window.history.pushState({ lyricsOpen: true }, '', window.location.href);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isLyricsOpen]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setProgress(newTime);
    if (playerRef.current) {
      playerRef.current.seekTo(newTime, true);
    }
  };

  const handleTogglePlay = () => {
    if (audioStatus === 'error' || !hasValidVideoId) return;
    pauseRequestedRef.current = isPlaying;
    togglePlay();
  };

  const isAudioUnavailable = audioStatus === 'error' || !hasValidVideoId;

  if (!currentTrack) return null;

  const thumbnail = getHighResImage(currentTrack.thumbnails?.[currentTrack.thumbnails.length - 1]?.url, 800);
  const artistName = Array.isArray(currentTrack.artist) ? currentTrack.artist.map(a => a.name).join(', ') : currentTrack.artist?.name || 'Unknown Artist';

  return (
    <>
      {/* Hidden YouTube Player — only mount when we have a valid videoId */}
      {hasValidVideoId && (
        <div className="fixed top-[-1000px] left-[-1000px] w-[1px] h-[1px] opacity-0 pointer-events-none">
          <YouTube
            key={currentTrack.videoId}
            videoId={currentTrack.videoId}
            opts={{
              height: '1',
              width: '1',
              playerVars: {
                autoplay: 1,
                controls: 0,
                playsinline: 1,
              },
            }}
            onReady={onReady}
            onStateChange={onStateChange}
            onError={onError}
          />
        </div>
      )}

      {/* Mini Player */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[80px] left-4 right-4 z-50 bg-[#1C1C1E]/95 backdrop-blur-md rounded-full flex items-center p-2 pr-4 cursor-pointer shadow-2xl border border-white/10"
            onClick={() => setExpanded(true)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTrack.videoId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center flex-1 min-w-0"
              >
                {/* Circular Album Art with Progress */}
                <div className="relative w-12 h-12 shrink-0 mr-3">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                    <circle 
                      cx="50" cy="50" r="46" fill="none" stroke="#A78BFA" strokeWidth="4" 
                      strokeDasharray={`${2 * Math.PI * 46}`}
                      strokeDashoffset={`${2 * Math.PI * 46 * (1 - (duration > 0 ? progress / duration : 0))}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-1 rounded-full overflow-hidden">
                    <Image src={thumbnail} alt={currentTrack.name} fill sizes="(max-width: 640px) 100vw, 500px" className="object-cover" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="text-white text-sm font-semibold truncate">{currentTrack.name}</div>
                  <div className="text-white/60 text-xs truncate flex items-center gap-1">
                    {currentTrack.isExplicit && <span className="bg-white/20 text-[8px] px-1 rounded-sm text-white">E</span>}
                    {artistName}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePlay();
                }}
                disabled={isAudioUnavailable}
                aria-label={isAudioUnavailable ? 'Audio tidak tersedia' : isPlaying ? 'Jeda' : 'Putar'}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAudioUnavailable
                  ? <AlertTriangle className="w-5 h-5" />
                  : isPlaying
                    ? <Pause className="w-5 h-5 fill-current" />
                    : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <button
                onClick={handleLike}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-[#FA243C] text-[#FA243C]' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Player */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] flex flex-col"
            style={{
              background: dominantColor 
                ? `linear-gradient(to bottom, color-mix(in srgb, ${dominantColor} 40%, #121212) 0%, #121212 100%)`
                : '#121212'
            }}
          >
            <div className="relative z-10 flex flex-col h-full p-6 pb-8">
              {/* Header */}
              <div className="flex justify-between items-center mb-8">
                <button onClick={() => setExpanded(false)} className="p-2 -ml-2 text-white">
                  <ChevronDown className="w-8 h-8" />
                </button>
                <div className="flex gap-4">
                  <button className="p-2 text-white">
                    <Cast className="w-6 h-6" />
                  </button>
                  <button className="p-2 -mr-2 text-white">
                    <MoreVertical className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex flex-col justify-center min-h-0 relative">
                {isLyricsOpen && (
                  <div className="absolute inset-[-50px] -z-10 overflow-hidden opacity-40 pointer-events-none">
                    <Image src={thumbnail} alt="Background" fill className="object-cover blur-[80px] scale-110" />
                  </div>
                )}
                {isLyricsOpen ? (
                  <div className="flex-1 pb-8 z-10 pointer-events-none" />
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentTrack.videoId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: isPlaying ? 1 : 0.95 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                      className="w-full aspect-square rounded-xl overflow-hidden shadow-2xl mx-auto max-w-[360px] relative"
                    >
                      <Image src={thumbnail} alt={currentTrack.name} width={500} height={500} className={cn('w-full h-full object-cover', isAudioUnavailable && 'opacity-40')} />
                      {isAudioUnavailable && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 gap-3 bg-black/40">
                          <AlertTriangle className="w-10 h-10 text-yellow-400" />
                          <div className="text-white font-semibold">Audio tidak tersedia</div>
                          <div className="text-white/70 text-xs max-w-[260px]">
                            {audioErrorCode === 100 && 'Video tidak ditemukan atau telah dihapus.'}
                            {(audioErrorCode === 101 || audioErrorCode === 150) && 'Pemilik video melarang pemutaran di luar YouTube.'}
                            {audioErrorCode === 2 && 'ID video tidak valid.'}
                            {audioErrorCode === 5 && 'Pemutar mengalami error internal.'}
                            {!hasValidVideoId && 'Lagu ini tidak punya sumber audio yang valid.'}
                          </div>
                          <button
                            type="button"
                            onClick={() => { void playNext(); }}
                            className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-full bg-white text-black font-semibold hover:bg-white/90"
                          >
                            Lewati ke lagu berikutnya
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Controls Area */}
              <div className="mt-8">
                <div className="flex justify-between items-center mb-6">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={currentTrack.videoId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="min-w-0 flex-1 pr-4"
                    >
                      <h2 className="text-2xl font-bold text-white truncate">{currentTrack.name}</h2>
                      <p className="text-lg text-white/60 truncate">{artistName}</p>
                    </motion.div>
                  </AnimatePresence>
                  <div className="flex items-center gap-4">
                    <button onClick={() => requireAuth(() => setTrackToAdd(currentTrack))} className="p-2 text-white/80 hover:text-white transition">
                      <ListPlus className="w-7 h-7" />
                    </button>
                    <button onClick={handleLike} className="p-2 text-white transition">
                      <Heart className={cn("w-7 h-7", isLiked && "fill-white")} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={progress || 0}
                    onChange={handleSeek}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <div className="flex justify-between text-xs text-white/50 mt-2 font-mono">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex justify-between items-center mb-8 px-2">
                  <button className="text-white/80 hover:text-white transition">
                    <Shuffle className="w-6 h-6" />
                  </button>
                  <button onClick={playPrev} className="text-white hover:text-white transition">
                    <SkipBack className="w-10 h-10 fill-current" />
                  </button>
                  <button
                    onClick={handleTogglePlay}
                    disabled={isAudioUnavailable}
                    aria-label={isAudioUnavailable ? 'Audio tidak tersedia' : isPlaying ? 'Jeda' : 'Putar'}
                    className="w-20 h-20 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isAudioUnavailable
                      ? <AlertTriangle className="w-10 h-10" />
                      : isPlaying
                        ? <Pause className="w-10 h-10 fill-current" />
                        : <Play className="w-10 h-10 fill-current ml-1" />}
                  </button>
                  <button onClick={playNext} className="text-white hover:text-white transition">
                    <SkipForward className="w-10 h-10 fill-current" />
                  </button>
                  <button className="text-white/80 hover:text-white transition">
                    <Repeat className="w-6 h-6" />
                  </button>
                </div>

                {/* Bottom Actions */}
                <div className="flex justify-between items-center px-6 py-4 bg-white/5 rounded-2xl">
                  <button className="text-white/80 hover:text-white transition flex flex-col items-center gap-1">
                    <ListMusic className="w-5 h-5" />
                    <span className="text-[10px] uppercase tracking-wider">Up Next</span>
                  </button>
                  <button
                    onClick={() => setIsLyricsOpen(true)}
                    className={cn("transition flex flex-col items-center gap-1", isLyricsOpen ? "text-white" : "text-white/80 hover:text-white")}
                  >
                    <Mic2 className="w-5 h-5" />
                    <span className="text-[10px] uppercase tracking-wider">Lyrics</span>
                  </button>
                  <button 
                    onClick={() => {
                      const artistId = Array.isArray(currentTrack.artist) 
                        ? currentTrack.artist[0]?.artistId 
                        : currentTrack.artist?.artistId;
                      if (artistId) {
                        setExpanded(false);
                        router.push(`/artist/${artistId}`);
                      }
                    }}
                    className="text-white/80 hover:text-white transition flex flex-col items-center gap-1"
                  >
                    <User className="w-5 h-5" />
                    <span className="text-[10px] uppercase tracking-wider">Lihat Artis</span>
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isLyricsOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[120] bg-black/60 backdrop-blur-[10px]"
                  onClick={() => setIsLyricsOpen(false)}
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isLyricsOpen && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                  className="absolute left-0 right-0 bottom-0 z-[130] rounded-t-3xl border border-white/10 bg-[#17171A]/95 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h3 className="text-white font-semibold">Lyrics</h3>
                    <button
                      onClick={() => setIsLyricsOpen(false)}
                      className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition"
                      aria-label="Close lyrics"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
                    <LyricsClient onClose={() => setIsLyricsOpen(false)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

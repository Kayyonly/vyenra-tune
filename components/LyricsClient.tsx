'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore, type Track } from '@/lib/store';
import { findActiveLyricIndex, parseLrc, type LyricLine } from '@/lib/lrc';

type LyricsSource = 'lrclib' | 'ytmusic' | null;

interface LyricsApiResponse {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: LyricsSource;
}

type LyricsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'plain'; text: string; source: LyricsSource }
  | { kind: 'synced'; lines: LyricLine[]; source: LyricsSource };

const DEFAULT_OFFSET = 0.2;
const MIN_OFFSET = -3;
const MAX_OFFSET = 3;
const OFFSET_STEP = 0.1;

const DEBUG_ENABLED =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LYRICS_DEBUG === 'true';

function getArtistString(track: Track | null): string {
  if (!track) return '';
  if (Array.isArray(track.artist)) {
    return track.artist.map((a) => a.name).filter(Boolean).join(', ');
  }
  return track.artist?.name ?? '';
}

function getPrimaryArtist(track: Track | null): string {
  if (!track) return '';
  if (Array.isArray(track.artist)) {
    return track.artist[0]?.name ?? '';
  }
  return track.artist?.name ?? '';
}

async function fetchLyrics(track: Track): Promise<LyricsApiResponse> {
  const params = new URLSearchParams({ id: track.videoId });
  if (track.name) params.set('name', track.name);
  const artist = getPrimaryArtist(track);
  if (artist) params.set('artist', artist);
  if (track.duration && track.duration > 0) {
    params.set('duration', String(track.duration));
  }

  const res = await fetch(`/api/lyrics?${params.toString()}`);
  if (!res.ok) {
    return { syncedLyrics: null, plainLyrics: null, source: null };
  }
  return (await res.json()) as LyricsApiResponse;
}

export default function LyricsClient() {
  const track = usePlayerStore((state) => state.currentTrack);
  const currentTime = usePlayerStore((state) => state.progress);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const [state, setState] = useState<LyricsState>({ kind: 'idle' });
  const [offset, setOffset] = useState(DEFAULT_OFFSET);
  const [showDebug, setShowDebug] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const lastScrolledIndex = useRef<number>(-1);

  /* ------------------------------------------------------------------ */
  /* Fetch lyrics when the track changes (edge case: song changes).      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    lineRefs.current = [];
    lastScrolledIndex.current = -1;

    // Reset scroll on song change.
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }

    const load = async () => {
      if (!track?.videoId) {
        if (!cancelled) setState({ kind: 'idle' });
        return;
      }

      setState({ kind: 'loading' });

      try {
        const payload = await fetchLyrics(track);
        if (cancelled) return;

        if (payload.syncedLyrics) {
          const parsed = parseLrc(payload.syncedLyrics);
          if (parsed.lines.length > 0) {
            setState({ kind: 'synced', lines: parsed.lines, source: payload.source });
            return;
          }
        }

        if (payload.plainLyrics && payload.plainLyrics.trim()) {
          // No timestamps — show as static text (never fake timing).
          setState({ kind: 'plain', text: payload.plainLyrics.trim(), source: payload.source });
          return;
        }

        setState({ kind: 'empty' });
      } catch {
        if (!cancelled) setState({ kind: 'empty' });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // We intentionally depend on the videoId only — other track fields don't
    // warrant a refetch and would cause unnecessary network churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.videoId]);

  /* ------------------------------------------------------------------ */
  /* Derive adjusted playback time and the active index.                 */
  /* ------------------------------------------------------------------ */
  const lines = state.kind === 'synced' ? state.lines : null;
  const firstLyricTime = lines?.[0]?.time ?? 0;
  const adjustedTime = Math.max(0, currentTime - offset);

  const activeIndex = useMemo(() => {
    if (!lines) return -1;
    if (adjustedTime < firstLyricTime) return -1; // Intro guard.
    return findActiveLyricIndex(lines, adjustedTime);
  }, [lines, adjustedTime, firstLyricTime]);

  /* ------------------------------------------------------------------ */
  /* Smooth auto-scroll the active line into view (centered).            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (activeIndex < 0) return;
    if (activeIndex === lastScrolledIndex.current) return;

    const container = containerRef.current;
    const element = lineRefs.current[activeIndex];
    if (!container || !element) return;

    // Use container-relative scrolling to avoid hijacking the page scroll.
    const elementOffset = element.offsetTop - container.offsetTop;
    const target = elementOffset - container.clientHeight / 2 + element.clientHeight / 2;

    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    lastScrolledIndex.current = activeIndex;
  }, [activeIndex]);

  /* ------------------------------------------------------------------ */
  /* Debug logging (only when NEXT_PUBLIC_LYRICS_DEBUG=true).            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!DEBUG_ENABLED || state.kind !== 'synced') return;
    const lyricTime = activeIndex >= 0 ? state.lines[activeIndex]?.time ?? 0 : 0;
    console.log('[lyrics-sync]', {
      currentTime: Number(currentTime.toFixed(3)),
      adjustedTime: Number(adjustedTime.toFixed(3)),
      lyricTime: Number(lyricTime.toFixed(3)),
      index: activeIndex,
      offset,
      isPlaying,
    });
  }, [currentTime, adjustedTime, activeIndex, offset, isPlaying, state]);

  /* ------------------------------------------------------------------ */
  /* Offset controls (adjustable fine-tuning slider).                    */
  /* ------------------------------------------------------------------ */
  const adjustOffset = useCallback((delta: number) => {
    setOffset((prev) => {
      const next = Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, Number((prev + delta).toFixed(2))));
      return next;
    });
  }, []);

  const resetOffset = useCallback(() => setOffset(DEFAULT_OFFSET), []);

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={track?.videoId || 'empty-lyrics'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex h-full flex-col rounded-xl bg-white/5"
      >
        {/* Fine-tune / debug toolbar */}
        {state.kind === 'synced' && (
          <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2 text-xs text-white/60">
            <div className="flex items-center gap-2">
              <span className="font-medium">Sync</span>
              <button
                type="button"
                onClick={() => adjustOffset(-OFFSET_STEP)}
                className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20"
                aria-label="Lirik lebih cepat"
              >
                −
              </button>
              <span className="tabular-nums text-white/80">{offset.toFixed(2)}s</span>
              <button
                type="button"
                onClick={() => adjustOffset(OFFSET_STEP)}
                className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20"
                aria-label="Lirik lebih lambat"
              >
                +
              </button>
              <button
                type="button"
                onClick={resetOffset}
                className="rounded-md px-2 py-1 text-white/50 hover:text-white"
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="text-white/40 hover:text-white/80"
            >
              {showDebug ? 'Hide debug' : 'Debug'}
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          className="no-scrollbar relative flex-1 overflow-y-auto scroll-smooth p-4"
        >
          {renderBody(state, activeIndex, lineRefs)}
        </div>

        {showDebug && state.kind === 'synced' && (
          <pre className="border-t border-white/5 bg-black/40 px-4 py-2 text-[10px] leading-4 text-white/70">
            {JSON.stringify(
              {
                currentTime: Number(currentTime.toFixed(3)),
                adjustedTime: Number(adjustedTime.toFixed(3)),
                activeIndex,
                activeLyricTime: activeIndex >= 0 ? state.lines[activeIndex]?.time : null,
                offset,
                totalLines: state.lines.length,
                source: state.source,
                artist: getArtistString(track),
              },
              null,
              2,
            )}
          </pre>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function renderBody(
  state: LyricsState,
  activeIndex: number,
  lineRefs: React.MutableRefObject<Array<HTMLParagraphElement | null>>,
) {
  switch (state.kind) {
    case 'idle':
      return <div className="text-sm text-white/50">Pilih lagu untuk melihat lirik.</div>;

    case 'loading':
      return <div className="text-sm text-white/60">Memuat lirik...</div>;

    case 'empty':
      return <div className="text-sm text-white/50">Lirik tidak tersedia</div>;

    case 'plain':
      return (
        <div className="whitespace-pre-wrap text-base leading-7 text-white/70">
          <p className="mb-3 text-xs uppercase tracking-wide text-white/40">
            Tidak ada timing — ditampilkan tanpa sinkronisasi
          </p>
          {state.text}
        </div>
      );

    case 'synced':
      return (
        <div className="space-y-3 text-base leading-7">
          {state.lines.map((line, index) => {
            const isActive = index === activeIndex;
            const isPast = index < activeIndex;
            return (
              <p
                key={`${line.time.toFixed(3)}-${index}`}
                ref={(element) => {
                  lineRefs.current[index] = element;
                }}
                className={[
                  'origin-left transition-all duration-300 ease-out will-change-transform',
                  isActive
                    ? 'scale-[1.04] font-semibold text-white opacity-100'
                    : isPast
                      ? 'scale-100 text-white/40 opacity-70'
                      : 'scale-100 text-white/60 opacity-80',
                ].join(' ')}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      );
  }
}

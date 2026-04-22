'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '@/lib/store';

interface LyricsTrack {
  videoId: string;
}

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsClientProps {
  track: LyricsTrack | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const FALLBACK_LYRICS = 'Lirik tidak tersedia';
const LRC_TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
const INTRO_GUARD_SECONDS = 0.3;
const MAX_ADAPTIVE_OFFSET = 0.35;
const OFFSET_SMOOTHING_FACTOR = 0.08;

async function fetchLyrics(videoId: string): Promise<string> {
  if (!videoId) {
    return FALLBACK_LYRICS;
  }

  try {
    const response = await fetch(`/api/lyrics?id=${encodeURIComponent(videoId)}`);

    if (!response.ok) {
      return FALLBACK_LYRICS;
    }

    const payload = (await response.json()) as { lyrics?: string | null };
    const lyrics = payload.lyrics?.trim();

    return lyrics || FALLBACK_LYRICS;
  } catch {
    return FALLBACK_LYRICS;
  }
}

function parseTimestampedLyrics(rawLyrics: string, duration: number): LyricLine[] {
  const lines = rawLyrics
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const timestamped = lines
    .flatMap((line) => {
      const matches = Array.from(line.matchAll(LRC_TIMESTAMP_REGEX));

      if (matches.length === 0) {
        return [];
      }

      const text = line.replace(LRC_TIMESTAMP_REGEX, '').trim();
      if (!text) {
        return [];
      }

      return matches
        .map((match) => {
          const minutes = Number(match[1] ?? 0);
          const seconds = Number(match[2] ?? 0);
          const fractionRaw = match[3] ?? '0';
          const fraction = Number(`0.${fractionRaw}`);
          const time = minutes * 60 + seconds + fraction;

          return {
            time,
            text,
          };
        })
        .filter((lineItem) => Number.isFinite(lineItem.time));
    })
    .sort((a, b) => a.time - b.time);

  if (timestamped.length > 0) {
    return timestamped;
  }

  const plainLines = lines.filter((line) => line !== FALLBACK_LYRICS);
  if (plainLines.length === 0) {
    return [{ time: 0, text: FALLBACK_LYRICS }];
  }

  const totalDuration = duration > 0 ? duration : plainLines.length * 4;
  const gap = Math.max(totalDuration / Math.max(plainLines.length, 1), 2);

  return plainLines.map((text, index) => ({
    time: Number((index * gap).toFixed(2)),
    text,
  }));
}

function findCurrentLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (!lyrics.length) {
    return -1;
  }

  const firstLyricTime = lyrics[0]?.time ?? 0;
  if (currentTime < firstLyricTime - INTRO_GUARD_SECONDS) {
    return -1;
  }

  let low = 0;
  let high = lyrics.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lyrics[mid].time <= currentTime) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

export default function LyricsClient() {
  const track = usePlayerStore((state) => state.currentTrack);
  const currentTime = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const [lyrics, setLyrics] = useState(FALLBACK_LYRICS);
  const [isLoading, setIsLoading] = useState(false);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  useEffect(() => {
    let isMounted = true;

    const loadLyrics = async () => {
      if (!track?.videoId) {
        setLyrics(FALLBACK_LYRICS);
        return;
      }

      setIsLoading(true);
      lineRefs.current = [];

      const nextLyrics = await fetchLyrics(track.videoId);

      if (isMounted) {
        setLyrics(nextLyrics);
        setIsLoading(false);
      }
    };

    loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [track?.videoId]);

  const parsedLyrics = useMemo(() => parseTimestampedLyrics(lyrics, duration), [lyrics, duration]);
  const displayTime = currentTime;
  const adaptiveOffset = useMemo(() => {
    const nearestIndex = findCurrentLyricIndex(parsedLyrics, displayTime);
    if (nearestIndex < 0) {
      return 0;
    }
    const delta = displayTime - parsedLyrics[nearestIndex].time;
    const targetOffset = Math.max(Math.min(-delta * 0.15, MAX_ADAPTIVE_OFFSET), -MAX_ADAPTIVE_OFFSET);
    return targetOffset * (1 - OFFSET_SMOOTHING_FACTOR);
  }, [displayTime, parsedLyrics]);

  const syncedTime = displayTime + adaptiveOffset;
  const currentLyricIndex = useMemo(() => findCurrentLyricIndex(parsedLyrics, syncedTime), [parsedLyrics, syncedTime]);

  useEffect(() => {
    if (currentLyricIndex < 0) {
      return;
    }

    const activeLineRef = lineRefs.current[currentLyricIndex];

    if (!activeLineRef) {
      return;
    }

    activeLineRef.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [currentLyricIndex]);

  useEffect(() => {
    const lyricTime = currentLyricIndex >= 0 ? parsedLyrics[currentLyricIndex]?.time ?? 0 : 0;
    const delta = currentLyricIndex >= 0 ? syncedTime - lyricTime : 0;
    const roundedDelta = Number(delta.toFixed(3));

    const payload = {
      currentTime: Number(displayTime.toFixed(3)),
      lyricTime: Number(lyricTime.toFixed(3)),
      delta: roundedDelta,
      currentLyricIndex,
      isPlaying,
    };

    if (Math.abs(roundedDelta) > 0.3) {
      console.warn('[lyrics-sync:drift]', payload);
      return;
    }

    console.log('[lyrics-sync]', payload);
  }, [displayTime, currentLyricIndex, isPlaying, parsedLyrics, syncedTime]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={track?.videoId || 'empty-lyrics'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="h-64 overflow-y-auto rounded-xl bg-white/5 p-4 no-scrollbar"
      >
        {isLoading ? (
          <div className="text-sm text-white/60">Memuat lirik...</div>
        ) : (
          <div className="space-y-3 text-base leading-7 whitespace-pre-wrap">
            {parsedLyrics.map((line, index) => (
              <p
                key={`${line.time}-${index}`}
                ref={(element) => {
                  lineRefs.current[index] = element;
                }}
                className={`origin-center transition-all duration-300 ${
                  index === currentLyricIndex
                    ? 'text-white font-bold scale-105 opacity-100'
                    : 'text-gray-400 scale-100 opacity-70'
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
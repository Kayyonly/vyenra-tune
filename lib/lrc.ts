/**
 * Lightweight LRC (Lyrics) parser for Vynra-Tune.
 *
 * Supports:
 *   - [mm:ss.xx]  / [mm:ss.xxx] / [mm:ss]
 *   - Multi-timestamp lines: [00:12.00][01:05.50] text
 *   - LRC metadata tags ([ar:], [ti:], [offset:], …)
 *
 * Returns lines sorted ascending by time in *seconds* (float).
 */

export interface LyricLine {
  time: number;
  text: string;
}

const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/g;
const METADATA_REGEX = /^\[(ar|ti|al|au|by|re|ve|length|offset):(.*)\]$/i;

const FILLER_LINE = '♪';

/** Parse an LRC string into a list of lyric lines, sorted ascending by time. */
export function parseLrc(raw: string): { lines: LyricLine[]; offsetMs: number } {
  if (!raw) return { lines: [], offsetMs: 0 };

  let offsetMs = 0;
  const entries: LyricLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const meta = line.match(METADATA_REGEX);
    if (meta) {
      if (meta[1].toLowerCase() === 'offset') {
        const parsed = Number(meta[2].trim());
        if (Number.isFinite(parsed)) offsetMs = parsed;
      }
      continue;
    }

    const matches = Array.from(line.matchAll(TIMESTAMP_REGEX));
    if (matches.length === 0) continue;

    const text = line.replace(TIMESTAMP_REGEX, '').trim();

    for (const match of matches) {
      const minutes = Number(match[1]);
      const secondsPart = match[2].replace(':', '.'); // tolerate [mm:ss:xx]
      const seconds = Number(secondsPart);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) continue;

      const time = minutes * 60 + seconds;
      entries.push({ time, text: text || FILLER_LINE });
    }
  }

  entries.sort((a, b) => a.time - b.time);

  // Apply LRC-level offset (tag says "[offset:+250]" meaning shift lyrics +250ms).
  if (offsetMs !== 0) {
    const offsetSeconds = offsetMs / 1000;
    for (const entry of entries) {
      entry.time = Math.max(0, entry.time + offsetSeconds);
    }
  }

  return { lines: entries, offsetMs };
}

/**
 * Binary search for the active lyric index given a playback time (seconds).
 * Returns -1 if we are still in the intro (before the first lyric).
 */
export function findActiveLyricIndex(lines: LyricLine[], time: number): number {
  if (!lines.length) return -1;
  if (time < lines[0].time) return -1; // intro guard — don't show lyrics yet.

  let low = 0;
  let high = lines.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= time) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

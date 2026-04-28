import { NextResponse } from 'next/server';
import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
let initialized = false;

type LyricsResponse = {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: 'lrclib' | 'ytmusic' | null;
};

const EMPTY: LyricsResponse = { syncedLyrics: null, plainLyrics: null, source: null };
const LRCLIB_ENDPOINT = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
const USER_AGENT = 'Vynra-Tune (https://github.com/Kayyonly/vyenra-tune)';

interface LrclibHit {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

async function fetchFromLrclib(
  trackName: string,
  artistName: string,
  albumName: string,
  duration: number,
): Promise<LrclibHit | null> {
  if (!trackName || !artistName) {
    return null;
  }

  // 1) Exact signature match (highest precision).
  try {
    const params = new URLSearchParams({ track_name: trackName, artist_name: artistName });
    if (albumName) params.set('album_name', albumName);
    if (duration > 0) params.set('duration', String(Math.round(duration)));

    const res = await fetch(`${LRCLIB_ENDPOINT}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = (await res.json()) as LrclibHit;
      if (data && (data.syncedLyrics || data.plainLyrics)) {
        return data;
      }
    }
  } catch (error) {
    console.warn('[lyrics:lrclib:get]', error);
  }

  // 2) Search fallback — pick the hit with closest duration + synced lyrics.
  try {
    const params = new URLSearchParams({ track_name: trackName, artist_name: artistName });
    const res = await fetch(`${LRCLIB_SEARCH}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const hits = (await res.json()) as LrclibHit[];
    if (!Array.isArray(hits) || hits.length === 0) return null;

    const synced = hits.filter((hit) => hit.syncedLyrics);
    const pool = synced.length > 0 ? synced : hits;

    pool.sort((a, b) => {
      const da = Math.abs((a.duration ?? 0) - duration);
      const db = Math.abs((b.duration ?? 0) - duration);
      return da - db;
    });

    return pool[0] ?? null;
  } catch (error) {
    console.warn('[lyrics:lrclib:search]', error);
    return null;
  }
}

const getLyricsBrowseId = (payload: unknown): string | null => {
  const tabs =
    (payload as {
      contents?: {
        singleColumnMusicWatchNextResultsRenderer?: {
          tabbedRenderer?: {
            watchNextTabbedResultsRenderer?: { tabs?: unknown[] };
          };
        };
      };
    })?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;

  if (!Array.isArray(tabs)) {
    return null;
  }

  for (const tab of tabs as Array<{
    tabRenderer?: {
      endpoint?: {
        browseEndpoint?: {
          browseId?: string;
          browseEndpointContextSupportedConfigs?: {
            browseEndpointContextMusicConfig?: { pageType?: string };
          };
        };
      };
    };
  }>) {
    const pageType =
      tab?.tabRenderer?.endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
        ?.browseEndpointContextMusicConfig?.pageType;
    if (pageType === 'MUSIC_PAGE_TYPE_TRACK_LYRICS') {
      return tab?.tabRenderer?.endpoint?.browseEndpoint?.browseId || null;
    }
  }

  return null;
};

const parseLyricsText = (payload: unknown): string | null => {
  const runs = (payload as {
    contents?: {
      sectionListRenderer?: {
        contents?: Array<{ musicDescriptionShelfRenderer?: { description?: { runs?: Array<{ text?: string }> } } }>;
      };
    };
  })?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs;

  if (!Array.isArray(runs)) {
    return null;
  }

  const text = runs.map((run) => run.text || '').join('').trim();
  if (!text || text.includes('Lyrics not available')) {
    return null;
  }

  return text;
};

async function fetchFromYouTubeMusic(videoId: string): Promise<string | null> {
  try {
    if (!initialized) {
      await ytmusic.initialize();
      initialized = true;
    }

    const nextPayload = await (
      ytmusic as unknown as { constructRequest: (endpoint: string, body: Record<string, unknown>) => Promise<unknown> }
    ).constructRequest('next', { videoId });

    const browseId = getLyricsBrowseId(nextPayload);
    if (!browseId) return null;

    const lyricsPayload = await (
      ytmusic as unknown as { constructRequest: (endpoint: string, body: Record<string, unknown>) => Promise<unknown> }
    ).constructRequest('browse', { browseId });

    return parseLyricsText(lyricsPayload);
  } catch (error) {
    console.error(`[lyrics:ytmusic] failed for id ${videoId}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  const trackName = (searchParams.get('name') || '').trim();
  const artistName = (searchParams.get('artist') || '').trim();
  const albumName = (searchParams.get('album') || '').trim();
  const duration = Number(searchParams.get('duration') || '0');

  if (!id || id.length !== 11) {
    return NextResponse.json(EMPTY, { status: 200 });
  }

  // 1) LRCLIB (LRC synced lyrics) — primary source for accurate sync.
  const lrclibHit = await fetchFromLrclib(trackName, artistName, albumName, duration);

  if (lrclibHit?.syncedLyrics) {
    return NextResponse.json(
      {
        syncedLyrics: lrclibHit.syncedLyrics,
        plainLyrics: lrclibHit.plainLyrics ?? null,
        source: 'lrclib',
      } satisfies LyricsResponse,
      {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
      },
    );
  }

  // 2) YouTube Music (plain text fallback — no timing).
  const ytPlain = await fetchFromYouTubeMusic(id);
  const plain = lrclibHit?.plainLyrics ?? ytPlain ?? null;

  return NextResponse.json(
    {
      syncedLyrics: null,
      plainLyrics: plain,
      source: plain ? (lrclibHit?.plainLyrics ? 'lrclib' : 'ytmusic') : null,
    } satisfies LyricsResponse,
    {
      headers: {
        'Cache-Control': plain
          ? 'public, s-maxage=1800, stale-while-revalidate=86400'
          : 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    },
  );
}

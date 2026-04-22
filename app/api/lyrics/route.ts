import { NextResponse } from 'next/server';
import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
let initialized = false;

const FALLBACK = { lyrics: null };

const getLyricsBrowseId = (payload: any): string | null => {
  const tabs = payload?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;

  if (!Array.isArray(tabs)) {
    return null;
  }

  for (const tab of tabs) {
    const pageType = tab?.tabRenderer?.endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    if (pageType === 'MUSIC_PAGE_TYPE_TRACK_LYRICS') {
      return tab?.tabRenderer?.endpoint?.browseEndpoint?.browseId || null;
    }
  }

  return null;
};

const parseLyricsText = (payload: any): string | null => {
  const runs = payload?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs;

  if (!Array.isArray(runs)) {
    return null;
  }

  const text = runs.map((run: { text?: string }) => run.text || '').join('').trim();
  if (!text || text.includes('Lyrics not available')) {
    return null;
  }

  return text;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();

  if (!id || id.length !== 11) {
    return NextResponse.json(FALLBACK, { status: 200 });
  }

  try {
    if (!initialized) {
      await ytmusic.initialize();
      initialized = true;
    }

    const nextPayload = await (ytmusic as any).constructRequest('next', { videoId: id });
    const browseId = getLyricsBrowseId(nextPayload);

    if (!browseId) {
      return NextResponse.json(FALLBACK, {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
        },
      });
    }

    const lyricsPayload = await (ytmusic as any).constructRequest('browse', { browseId });
    const lyricsText = parseLyricsText(lyricsPayload);

    return NextResponse.json(
      { lyrics: lyricsText },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error(`Lyrics API failed for id ${id}:`, error);
    return NextResponse.json(FALLBACK, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  }
}

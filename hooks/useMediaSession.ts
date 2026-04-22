'use client';

import { useEffect } from 'react';
import { Track } from '@/lib/store';
import { getHighResImage } from '@/lib/utils';

interface UseMediaSessionParams {
  track: Track | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function useMediaSession({ track, isPlaying, onPlay, onPause, onPrev, onNext }: UseMediaSessionParams) {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !track) {
      return;
    }

    const artist = Array.isArray(track.artist)
      ? track.artist.map((item) => item.name).join(', ')
      : track.artist?.name || 'Unknown Artist';

    const artworkUrl = getHighResImage(track.thumbnails?.[track.thumbnails.length - 1]?.url, 800);
    const artworkType = artworkUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist,
      album: 'State of Sound',
      artwork: [{ src: artworkUrl, sizes: '512x512', type: artworkType }],
    });

    console.log('[MediaSession] metadata:', navigator.mediaSession.metadata);

    navigator.mediaSession.setActionHandler('play', onPlay);
    navigator.mediaSession.setActionHandler('pause', onPause);
    navigator.mediaSession.setActionHandler('previoustrack', onPrev);
    navigator.mediaSession.setActionHandler('nexttrack', onNext);

    return () => {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
        return;
      }

      (['play', 'pause', 'previoustrack', 'nexttrack'] as const).forEach((action) => {
        navigator.mediaSession.setActionHandler(action, null);
      });
    };
  }, [track, onPlay, onPause, onPrev, onNext]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    console.log('[MediaSession] playbackState:', navigator.mediaSession.playbackState);
  }, [isPlaying]);
}

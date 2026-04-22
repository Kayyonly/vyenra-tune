'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { usePlayerStore, Track, usePlaylistStore } from '@/lib/store';
import { Play, ArrowLeft, Music, Trash2, Heart, Share2, MessageCircle, Send, Twitter } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { TrackItem } from '@/components/TrackItem';
import { PlaylistSkeleton } from '@/components/PlaylistSkeleton';
import { MarqueeText } from '@/components/MarqueeText';
import { cn } from '@/lib/utils';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  img: string;
  tracks: Track[];
  isPublic?: boolean;
}

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState('');

  const playTrack = usePlayerStore((state) => state.playTrack);
  const upsertPlaylist = usePlaylistStore((state) => state.upsertPlaylist);
  const setCurrentPlaylist = usePlaylistStore((state) => state.setCurrentPlaylist);

  useEffect(() => {
    const loadPlaylist = async () => {
      if (!params.id) return;

      setLoading(true);
      try {
        const id = String(params.id);

        const sharedRes = await fetch(`/api/playlist/${id}`);
        if (sharedRes.ok) {
          const sharedData = await sharedRes.json();
          const mappedPlaylist: Playlist = {
            id: sharedData.id || id,
            name: sharedData.name || 'Playlist',
            description: sharedData.description || 'Shared playlist',
            img: sharedData.coverImage || '',
            tracks: sharedData.songs || [],
            isPublic: sharedData.isPublic ?? true,
          };

          setPlaylist(mappedPlaylist);
          setCurrentPlaylist(mappedPlaylist);
          upsertPlaylist(mappedPlaylist);
          setIsSaved(false);
          return;
        }

        const data = await db.getPlaylist(id);
        if (data) {
          const localPlaylist: Playlist = {
            id: data.id,
            name: data.name,
            description: 'Playlist dari library kamu',
            img: data.img,
            tracks: data.tracks,
            isPublic: true,
          };
          setPlaylist(localPlaylist);
          setCurrentPlaylist(localPlaylist);
          upsertPlaylist(localPlaylist);
          setIsSaved(true);
        }
      } catch (error) {
        console.error('Failed to load playlist:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [params.id, setCurrentPlaylist, upsertPlaylist]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlaylistUrl(window.location.href);
    }
  }, [playlist?.id]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handlePlayAll = () => {
    if (playlist && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks, 'playlist');
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;

    if (confirm('Apakah Anda yakin ingin menghapus playlist ini?')) {
      await db.deletePlaylist(playlist.id);
      router.back();
    }
  };

  const handleRemoveSong = async (trackToRemove: Track) => {
    if (!playlist) return;

    if (confirm('Hapus lagu ini dari playlist?')) {
      const updatedTracks = playlist.tracks.filter((t) => t.videoId !== trackToRemove.videoId);
      const updatedPlaylist = { ...playlist, tracks: updatedTracks };
      await db.addPlaylist({ id: updatedPlaylist.id, name: updatedPlaylist.name, img: updatedPlaylist.img, tracks: updatedPlaylist.tracks });
      setPlaylist(updatedPlaylist);
      upsertPlaylist(updatedPlaylist);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Link berhasil disalin!');
    } catch {
      showToast('Gagal menyalin link');
    }
  };

  if (loading) {
    return <PlaylistSkeleton />;
  }

  if (!playlist || playlist.isPublic === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white">
        <p className="mb-4">Playlist tidak ditemukan atau private</p>
        <button onClick={() => router.back()} className="text-[#FA243C]">Kembali</button>
      </div>
    );
  }

  const isSelfCreated = /^\d+$/.test(playlist.id);

  return (
    <main className="min-h-screen pb-24 px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] rounded-full bg-black/70 backdrop-blur-xl border border-white/10 px-4 py-2 text-sm text-white"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 z-20 bg-black/30 backdrop-blur-xl border-b border-white/10 px-2 py-4 flex items-center gap-3 rounded-b-2xl">
        <button onClick={() => router.back()} className="text-white p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-white/80 text-sm">Public Playlist</p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mt-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-2xl mb-6 relative bg-white/5 flex items-center justify-center">
            {playlist.img ? (
              <Image src={playlist.img} alt={playlist.name} fill sizes="(max-width: 640px) 100vw, 300px" className="object-cover" />
            ) : (
              <Music className="w-20 h-20 text-white/20" />
            )}
          </div>

          <div className="w-full max-w-md mb-2">
            <MarqueeText text={playlist.name} className="text-3xl font-bold text-white text-center" />
          </div>
          <p className="text-white/70 text-sm mb-1">{playlist.description || 'Shared playlist untuk kamu nikmati.'}</p>
          <p className="text-white/50 mb-6">{playlist.tracks.length} lagu</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handlePlayAll}
              disabled={playlist.tracks.length === 0}
              className="h-12 px-6 bg-[#81B29A] rounded-full flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 text-black font-semibold"
            >
              <Play className="w-5 h-5 fill-current" />
              Play All
            </button>

            <button
              onClick={() => setIsLiked((prev) => !prev)}
              className="h-12 px-5 bg-white/10 rounded-full flex items-center gap-2 hover:bg-white/20 transition"
            >
              <Heart className={cn('w-5 h-5 text-white', isLiked && 'fill-[#FA243C] text-[#FA243C]')} />
              <span className="text-white text-sm">Like</span>
            </button>

            <button
              onClick={handleShare}
              className="h-12 px-5 bg-white/10 rounded-full flex items-center gap-2 hover:bg-white/20 transition"
            >
              <Share2 className="w-5 h-5 text-white" />
              <span className="text-white text-sm">Share</span>
            </button>

            <a href={`https://wa.me/?text=${encodeURIComponent(playlistUrl)}`} target="_blank" rel="noreferrer" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 transition inline-flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </a>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(playlistUrl)}`} target="_blank" rel="noreferrer" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 transition inline-flex items-center justify-center">
              <Twitter className="w-5 h-5 text-white" />
            </a>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(playlistUrl)}`} target="_blank" rel="noreferrer" className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 transition inline-flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </a>
          </div>

          <div className="mt-4 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 max-w-full truncate">
            {playlistUrl}
          </div>
        </div>
      </motion.section>

      <div className="max-w-3xl mx-auto mt-6">
        {playlist.tracks.length === 0 ? (
          <div className="text-center text-white/50 py-12 rounded-2xl border border-white/10 bg-white/5">Belum ada lagu di playlist ini.</div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-2">
            {playlist.tracks.map((track, index) => (
              <TrackItem
                key={`${track.videoId}-${index}`}
                track={track}
                queue={playlist.tracks}
                onRemove={isSaved && isSelfCreated ? handleRemoveSong : undefined}
              />
            ))}
          </motion.div>
        )}
      </div>

      {isSaved && (
        <div className="fixed bottom-24 right-4">
          <button
            onClick={handleDeletePlaylist}
            className="w-12 h-12 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition flex items-center justify-center"
            title="Hapus Playlist"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="h-8" />
    </main>
  );
}

import { Play } from 'lucide-react';
import Image from 'next/image';
import { getHighResImage } from '@/lib/utils';
import { motion } from 'motion/react';
import { MarqueeText } from './MarqueeText';
import { usePlayerStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface MixedScrollProps {
  title: string;
  items: any[];
}

export function MixedScroll({ title, items }: MixedScrollProps) {
  const playTrack = usePlayerStore((state) => state.playTrack);
  const router = useRouter();

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4 px-4">{title}</h2>
      <div className="flex overflow-x-auto no-scrollbar gap-4 px-4 pb-4 snap-x snap-mandatory scroll-smooth">
        {items.map((item, i) => {
          const type = item.type;
          const isArtist = type === 'ARTIST';
          const isPlaylist = type === 'PLAYLIST';
          const isAlbum = type === 'ALBUM';
          const isSong = type === 'SONG' || type === 'VIDEO';

          const titleText = item.name || item.title || 'Unknown';
          const subtitleText = isArtist 
            ? 'Artist' 
            : isPlaylist 
              ? 'Playlist' 
              : isAlbum 
                ? 'Album' 
                : Array.isArray(item.artist) 
                  ? item.artist.map((a: any) => a.name).join(', ') 
                  : item.artist?.name || 'Song';

          const handleClick = () => {
            if (isArtist && item.artistId) {
              router.push(`/artist/${item.artistId}`);
            } else if (isPlaylist && item.playlistId) {
              router.push(`/playlist/${item.playlistId}`);
            } else if (isAlbum && item.albumId) {
              router.push(`/album/${item.albumId}`);
            } else if (isSong && item.videoId) {
              playTrack(item, [item], 'similar');
            }
          };

          return (
            <motion.div
              key={`${item.videoId || item.playlistId || item.albumId || item.artistId}-${i}`}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-none w-36 cursor-pointer group snap-center hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
              onClick={handleClick}
            >
              <div className={`relative w-36 h-36 overflow-hidden mb-2 shadow-lg transition-transform duration-300 ${isArtist ? 'rounded-full' : 'rounded-xl'}`}>
                <Image 
                  src={getHighResImage(item.thumbnails?.[item.thumbnails.length - 1]?.url, 400)} 
                  alt={titleText} 
                  fill 
                  sizes="144px" 
                  className="object-cover" 
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="w-full">
                <MarqueeText text={titleText} className="text-sm font-medium text-white leading-tight" />
                <MarqueeText text={subtitleText} className="text-xs text-gray-400 mt-1" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
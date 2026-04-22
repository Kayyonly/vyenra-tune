import { NextResponse } from 'next/server';
import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
let initialized = false;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id || id === 'undefined' || id === 'null') {
    return NextResponse.json({ error: 'Invalid playlist id' }, { status: 400 });
  }

  try {
    if (!initialized) {
      await ytmusic.initialize();
      initialized = true;
    }

    try {
      const playlist = await ytmusic.getPlaylist(id) as any;
      const songs = Array.isArray(playlist.videos) && playlist.videos.length > 0
        ? playlist.videos
        : await ytmusic.getPlaylistVideos(id);

      return NextResponse.json({
        id: playlist.playlistId || id,
        name: playlist.name || 'Playlist',
        description: playlist.description || 'Shared playlist from State of Sound',
        songs,
        coverImage: playlist.thumbnails?.[playlist.thumbnails.length - 1]?.url || '',
        isPublic: true,
      });
    } catch {
      const album = await ytmusic.getAlbum(id) as any;

      return NextResponse.json({
        id: album.albumId || id,
        name: album.name || 'Album',
        description: `Album oleh ${album.artist?.name || 'Unknown Artist'}`,
        songs: (album.songs || []).map((song: any) => ({
          videoId: song.videoId,
          name: song.name,
          artist: song.artist || [album.artist],
          duration: song.duration,
          thumbnails: song.thumbnails || album.thumbnails,
        })),
        coverImage: album.thumbnails?.[album.thumbnails.length - 1]?.url || '',
        isPublic: true,
      });
    }
  } catch (error) {
    console.error(`Failed to get shared playlist ${id}:`, error);
    return NextResponse.json({ error: 'Playlist tidak dapat diakses', isPublic: false }, { status: 404 });
  }
}
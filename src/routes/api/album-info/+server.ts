import { json } from '@sveltejs/kit';
import { LASTFM_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const artist = url.searchParams.get('artist');
  const album = url.searchParams.get('album');
  if (!artist || !album) return json({ error: 'Missing params' }, { status: 400 });

  try {
    const params = new URLSearchParams({
      method: 'album.getInfo',
      api_key: LASTFM_API_KEY,
      artist,
      album,
      format: 'json'
    });
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    const data = await res.json();
    const info = data?.album;
    if (!info) return json({ found: false });

    const tracks = info.tracks?.track?.map((t: { name: string; duration: string; '@attr': { rank: string } }) => ({
      rank: Number(t['@attr']?.rank) || 0,
      name: t.name,
      duration: Number(t.duration) || 0
    })) || [];

    return json({
      found: true,
      name: info.name || album,
      artist: info.artist || artist,
      summary: info.wiki?.summary?.replace(/<[^>]*>/g, '').trim().split('\n')[0] || '',
      published: info.wiki?.published || '',
      tags: info.tags?.tag?.map((t: { name: string }) => t.name).slice(0, 4) || [],
      tracks,
      listeners: Number(info.listeners) || 0,
      playcount: Number(info.playcount) || 0,
      url: info.url || ''
    });
  } catch {
    return json({ found: false });
  }
};

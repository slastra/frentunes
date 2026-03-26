import { json } from '@sveltejs/kit';
import { LASTFM_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const artist = url.searchParams.get('artist');
  if (!artist) return json({ error: 'Missing artist' }, { status: 400 });

  try {
    const params = new URLSearchParams({
      method: 'artist.getInfo',
      api_key: LASTFM_API_KEY,
      artist,
      format: 'json'
    });
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    const data = await res.json();
    const info = data?.artist;
    if (!info) return json({ found: false });

    return json({
      found: true,
      name: info.name || artist,
      bio: info.bio?.summary?.replace(/<[^>]*>/g, '').trim().split('\n')[0] || '',
      tags: info.tags?.tag?.map((t: { name: string }) => t.name).slice(0, 4) || [],
      listeners: Number(info.stats?.listeners) || 0,
      playcount: Number(info.stats?.playcount) || 0,
      url: info.url || ''
    });
  } catch {
    return json({ found: false });
  }
};

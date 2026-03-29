import { json } from '@sveltejs/kit';
import { ICECAST_URL, LASTFM_API_KEY } from '$env/static/private';

interface LastfmImage {
  '#text': string;
  size: string;
}

interface LastfmTrack {
  album?: {
    title?: string;
    image?: LastfmImage[];
  };
}

async function getLastfmTrackInfo(artist: string, track: string): Promise<LastfmTrack | null> {
  try {
    const params = new URLSearchParams({
      method: 'track.getInfo',
      api_key: LASTFM_API_KEY,
      artist,
      track,
      format: 'json'
    });
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    const data = await res.json();
    return data?.track ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const statusUrl = `${ICECAST_URL}/status-json.xsl`;
    const res = await fetch(statusUrl);
    const data = await res.json();

    const source = data?.icestats?.source;
    if (!source) {
      return json({ playing: false });
    }

    // Icecast may return a single source or an array
    const mount = Array.isArray(source) ? source[0] : source;
    const title = mount.title || '';

    // Icecast typically sends "Artist - Title" in the title field
    let artist = '';
    let track = '';

    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      track = parts.slice(1).join(' - ').trim();
    } else {
      track = title;
    }

    // Fetch album info from Last.fm
    let album = '';
    let albumArt: string | null = null;

    if (artist && track) {
      const lastfm = await getLastfmTrackInfo(artist, track);
      if (lastfm) {
        album = lastfm.album?.title || '';
        // Get the largest available image (extralarge > large > medium)
        const images = lastfm.album?.image;
        if (images?.length) {
          const extralarge = images.find(i => i.size === 'extralarge');
          const large = images.find(i => i.size === 'large');
          const medium = images.find(i => i.size === 'medium');
          const img = extralarge || large || medium;
          albumArt = img?.['#text'] || null;
        }
      }
    }

    return json({
      playing: true,
      artist,
      track,
      album,
      albumArt,
      listenUrl: mount.listenurl || `${ICECAST_URL}${mount.server_url || '/angelo'}`,
      listeners: mount.listeners || 0
    });
  } catch {
    return json({ playing: false });
  }
}

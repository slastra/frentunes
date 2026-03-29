import { ICECAST_URL, LASTFM_API_KEY } from '$env/static/private';

interface NowPlaying {
	playing: boolean;
	artist: string;
	track: string;
	album: string;
	albumArt: string | null;
	listenUrl: string;
	listeners: number;
}

type Subscriber = (data: NowPlaying) => void;

const subscribers = new Set<Subscriber>();
let current: NowPlaying = {
	playing: false,
	artist: '',
	track: '',
	album: '',
	albumArt: null,
	listenUrl: '',
	listeners: 0
};
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

const MAX_CACHE = 500;
const lastfmCache = new Map<string, { album: string; albumArt: string | null }>();

async function fetchLastfm(
	artist: string,
	track: string
): Promise<{ album: string; albumArt: string | null }> {
	const key = `${artist}::${track}`;
	const cached = lastfmCache.get(key);
	if (cached) return cached;

	try {
		const params = new URLSearchParams({
			method: 'track.getInfo',
			api_key: LASTFM_API_KEY,
			artist,
			track,
			format: 'json'
		});
		const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
			signal: AbortSignal.timeout(5000)
		});
		const data = await res.json();
		const info = data?.track;
		const album = info?.album?.title || '';
		const images: { size: string; '#text': string }[] | undefined = info?.album?.image;
		let albumArt: string | null = null;
		if (images?.length) {
			const img =
				images.find((i) => i.size === 'extralarge') ||
				images.find((i) => i.size === 'large') ||
				images.find((i) => i.size === 'medium');
			albumArt = img?.['#text'] || null;
		}
		const result = { album, albumArt };
		if (lastfmCache.size >= MAX_CACHE) {
			lastfmCache.delete(lastfmCache.keys().next().value!);
		}
		lastfmCache.set(key, result);
		return result;
	} catch {
		return { album: '', albumArt: null };
	}
}

function broadcast() {
	for (const sub of subscribers) {
		try {
			sub(current);
		} catch {
			/* subscriber write failed, ignore */
		}
	}
}

async function poll() {
	if (isPolling) return;
	isPolling = true;

	try {
		const res = await fetch(`${ICECAST_URL}/status-json.xsl`);
		const data = await res.json();
		const source = data?.icestats?.source;

		if (!source) {
			if (current.playing) {
				current = {
					playing: false,
					artist: '',
					track: '',
					album: '',
					albumArt: null,
					listenUrl: '',
					listeners: 0
				};
				broadcast();
			}
			return;
		}

		const mount = Array.isArray(source) ? source[0] : source;
		const title = mount.title || '';

		let artist = '';
		let track = '';
		if (title.includes(' - ')) {
			const parts = title.split(' - ');
			artist = parts[0].trim();
			track = parts.slice(1).join(' - ').trim();
		} else {
			track = title;
		}

		const trackChanged = artist !== current.artist || track !== current.track;
		const listenersChanged = (mount.listeners || 0) !== current.listeners;
		const wasOffline = !current.playing;

		if (!trackChanged && !listenersChanged && !wasOffline) return;

		let album = current.album;
		let albumArt = current.albumArt;

		if (trackChanged && artist && track) {
			const lastfm = await fetchLastfm(artist, track);
			album = lastfm.album;
			albumArt = lastfm.albumArt;
		} else if (trackChanged) {
			album = '';
			albumArt = null;
		}

		current = {
			playing: true,
			artist,
			track,
			album,
			albumArt,
			listenUrl: '/api/stream',
			listeners: mount.listeners || 0
		};

		broadcast();
	} catch {
		if (current.playing) {
			current = {
				playing: false,
				artist: '',
				track: '',
				album: '',
				albumArt: null,
				listenUrl: '',
				listeners: 0
			};
			broadcast();
		}
	} finally {
		isPolling = false;
	}
}

function startPolling() {
	if (pollTimer) return;
	poll();
	pollTimer = setInterval(poll, 3000);
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

export function getCurrent(): NowPlaying {
	return current;
}

export function subscribe(callback: Subscriber): () => void {
	subscribers.add(callback);
	if (subscribers.size === 1) startPolling();
	return () => {
		subscribers.delete(callback);
		if (subscribers.size === 0) stopPolling();
	};
}

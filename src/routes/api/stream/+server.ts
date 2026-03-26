import { ICECAST_URL } from '$env/static/private';

export async function GET() {
  const streamUrl = `${ICECAST_URL}/stream`;
  const upstream = await fetch(streamUrl);

  if (!upstream.ok || !upstream.body) {
    return new Response('Stream unavailable', { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

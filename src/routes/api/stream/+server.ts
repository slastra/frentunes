import { ICECAST_URL } from '$env/static/private';

async function getFirstMount(): Promise<string> {
  try {
    const res = await fetch(`${ICECAST_URL}/status-json.xsl`);
    const data = await res.json();
    const source = data?.icestats?.source;
    if (!source) return '/angelo';
    const mount = Array.isArray(source) ? source[0] : source;
    // server_url is a path like "/angelo", listenurl is a full URL
    if (mount.server_url) return mount.server_url;
    if (mount.listenurl) return new URL(mount.listenurl).pathname;
    return '/angelo';
  } catch {
    return '/angelo';
  }
}

export async function GET() {
  const mountPath = await getFirstMount();
  const streamUrl = `${ICECAST_URL}${mountPath}`;
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

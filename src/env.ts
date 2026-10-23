import { defineEnvVars } from '@sveltejs/kit/env';

// Inlined at build time, as $env/static/private was. Coolify passes both to the build.
export const variables = defineEnvVars({
  ICECAST_URL: { description: 'Icecast server base URL, for status and the stream proxy.', static: true },
  LASTFM_API_KEY: { description: 'Last.fm API key for album art and artist info.', static: true }
});

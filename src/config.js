// Every environment variable the addon reads, parsed once.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

const secret = env.ADDON_SECRET || '';
const tokensFile = env.TOKENS_FILE || path.join(ROOT, 'tokens.json');

export const config = {
  port: Number(env.PORT || 7100),
  secret,                                              // path prefix acting as the credential
  prefix: secret ? `/${secret}` : '',
  adminPassword: env.ADMIN_PASSWORD || '',             // optional: protects the /config page (any username)
  publicUrl: env.PUBLIC_URL || '',
  publicDir: path.join(ROOT, 'public'),
  tokensFile,
  dataDir: path.dirname(tokensFile),
  trakt: {
    clientId: env.TRAKT_CLIENT_ID,
    clientSecret: env.TRAKT_CLIENT_SECRET || '',
    redirectUri: env.TRAKT_REDIRECT_URI || '',
  },
  metaAddon: {
    url: (env.META_ADDON_URL || '').replace(/\/$/, ''),   // optional: another addon whose titles and posters the list tiles use
  },
  // Keep equal to WATCH_STATE_PLAYED_PERCENT in AIOStreams: a stop at or past this share of the runtime counts as watched.
  playedPercent: Number(env.WATCH_STATE_PLAYED_PERCENT || 90),
  aiostreams: {
    url: (env.AIOSTREAMS_URL || '').replace(/\/$/, ''),
    uuid: env.AIOSTREAMS_UUID,
    password: env.AIOSTREAMS_PASSWORD,
  },
};

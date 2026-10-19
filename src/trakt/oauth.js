// Trakt login: authorization link (PKCE), code exchange, and token refresh.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { currentViewer } from '../context.js';
import { loadTokens, patchUser } from '../storage/token-store.js';
import { AuthError, TraktError, UnknownViewerError } from './errors.js';
import { request } from './http.js';

const { clientId, clientSecret, redirectUri } = config.trakt;
const secretField = clientSecret ? { client_secret: clientSecret } : {};

export const NOT_CONNECTED = 'Not connected: connect this user on the /config page';

export function newPkce() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
}

export const authorizeUrl = (state, challenge) => 'https://trakt.tv/oauth/authorize?' + new URLSearchParams({
  response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
  code_challenge: challenge, code_challenge_method: 'S256', state,
});

// A fresh login replaces the credentials only: the user's key, lists and revision stay.
function storeTokenResponse(j, viewer = currentViewer()) {
  return patchUser(viewer, {
    access_token: j.access_token, refresh_token: j.refresh_token, expires_at: (j.created_at + j.expires_in) * 1000, reauth: undefined,
  }, { create: true });
}

export async function exchangeCode(code, verifier, viewer = currentViewer()) {
  const res = await request('POST', '/oauth/token', { body: {
    code, client_id: clientId, redirect_uri: redirectUri, grant_type: 'authorization_code',
    code_verifier: verifier, ...secretField,
  } });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
  return storeTokenResponse(await res.json(), viewer);
}

const refreshing = new Map();           // viewer -> in-flight refresh, so concurrent calls share one
export async function refresh() {
  const viewer = currentViewer();
  if (refreshing.has(viewer)) return refreshing.get(viewer);
  const p = (async () => {
    const t = loadTokens(viewer);
    if (!t) throw viewer ? new UnknownViewerError(viewer) : new AuthError(NOT_CONNECTED);
    const res = await request('POST', '/oauth/token', { body: {
      refresh_token: t.refresh_token, client_id: clientId, ...secretField,
      redirect_uri: redirectUri, grant_type: 'refresh_token',
    } });
    if (!res.ok) {
      // Trakt is down or rate limiting: retryable, the login itself is fine.
      if (res.status === 429 || res.status >= 500) throw new TraktError(res.status, `Trakt token refresh -> ${res.status}`, res.headers.get('retry-after'));
      // Trakt rejected the refresh token: flag it so /config shows "Needs reconnect".
      patchUser(viewer, { reauth: true });
      throw new AuthError(`token refresh rejected (${res.status}); connect this user again on /config`);
    }
    if (!loadTokens(viewer)) throw new UnknownViewerError(viewer);     // disconnected while refreshing
    return storeTokenResponse(await res.json(), viewer);
  })().finally(() => { refreshing.delete(viewer); });
  refreshing.set(viewer, p);
  return p;
}

// Authenticated Trakt requests for the current user: adds the token, refreshes it, maps failures to typed errors.
import { currentViewer } from '../context.js';
import { loadTokens } from '../storage/token-store.js';
import { AuthError, TraktError, UnknownViewerError } from './errors.js';
import { request } from './http.js';
import { NOT_CONNECTED, refresh } from './oauth.js';

const REFRESH_AHEAD_MS = 24 * 3600 * 1000;

async function accessToken() {
  let t = loadTokens();
  if (!t) throw currentViewer() ? new UnknownViewerError(currentViewer()) : new AuthError(NOT_CONNECTED);
  if (t.reauth) throw new AuthError('Trakt login expired; connect this user again on /config');
  if (t.expires_at - Date.now() < REFRESH_AHEAD_MS) t = await refresh();
  return t.access_token;
}

async function answer(res, method, pathname) {
  if (res.status === 204) return null;
  if (!res.ok) throw new TraktError(res.status, `Trakt ${method} ${pathname} -> ${res.status}`, res.headers.get('retry-after'));
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function api(method, pathname, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await request(method, pathname, { token: await accessToken(), body });
    if (res.status === 401 && attempt === 0) { await refresh(); continue; }
    if (res.status === 401 || res.status === 403) throw new AuthError(`Trakt ${res.status}`);
    return answer(res, method, pathname);
  }
}

// For Trakt's public endpoints (the charts): only the app's client ID is sent, no user's login is involved.
export const apiPublic = async (pathname) => answer(await request('GET', pathname), 'GET', pathname);

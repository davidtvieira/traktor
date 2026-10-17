// Minimal Trakt client: token storage/refresh and JSON requests.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const TOKEN_FILE = process.env.TOKENS_FILE || path.join(dir, 'tokens.json');
const API = 'https://api.trakt.tv';

export const viewerContext = new AsyncLocalStorage();
const currentViewer = () => viewerContext.getStore()?.viewer ?? '';

export const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
export const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET || '';
export const REDIRECT_URI = process.env.TRAKT_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  'User-Agent': 'traktor/1.0 (AIOStreams)',
  'Accept': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': CLIENT_ID,
  ...extra,
});

// Write to a temp file, then rename: a crash mid-write never leaves a half-written file.
export function writeFileAtomic(file, data, mode = 0o600) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode });
  fs.renameSync(tmp, file);
}

function readAll() {
  let all = {};
  try { all = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { return {}; }
  if (all.access_token) all = { '': all };           // migrate the single-account format
  return all;
}
const writeAll = (all) => writeFileAtomic(TOKEN_FILE, JSON.stringify(all, null, 2));

export function loadTokens(viewer = currentViewer()) { return readAll()[viewer] || null; }
export function saveTokens(t, viewer = currentViewer()) {
  const all = readAll(); all[viewer] = t; writeAll(all);
}
export function deleteTokens(viewer) {
  const all = readAll(); delete all[viewer]; writeAll(all);
}
// A random key in the private lists address of a connected user.
export function catalogKey(viewer) {
  const t = loadTokens(viewer);
  if (!t) return null;
  if (!t.key) { t.key = crypto.randomBytes(16).toString('hex'); saveTokens(t, viewer); }
  return t.key;
}
export function viewerByKey(key) {
  for (const [viewer, t] of Object.entries(readAll())) if (t.key && t.key === key) return viewer;
  return null;
}
// The lists a user ticked (null = all of them).
export const getPicks = (viewer) => loadTokens(viewer)?.picks ?? null;
export function setPicks(viewer, picks) {
  const t = loadTokens(viewer);
  if (t) saveTokens({ ...t, picks }, viewer);
}
export const knownViewers = () => Object.keys(readAll());
// viewer -> 'ok' | 'reauth' (Trakt rejected the saved login; the user must connect again)
export const viewerStates = () => Object.fromEntries(Object.entries(readAll()).map(([k, v]) => [k, v.reauth ? 'reauth' : 'ok']));
export class UnknownViewerError extends Error {}
export class AuthError extends Error {}
export class TraktError extends Error {
  constructor(status, msg, retryAfter) { super(msg); this.status = status; this.retryAfter = retryAfter; }
}

const NOT_CONNECTED = 'Not connected: connect this user on the /auth page';
const post = (pathname, body) => fetch(API + pathname, { method: 'POST', headers: headers(), body: JSON.stringify(body) });

export async function exchangeCode(code, verifier, viewer = currentViewer()) {
  const res = await post('/oauth/token', {
    code, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    code_verifier: verifier, ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
  return storeTokenResponse(await res.json(), viewer);
}

function storeTokenResponse(j, viewer = currentViewer()) {
  const t = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: (j.created_at + j.expires_in) * 1000 };
  const prev = loadTokens(viewer);
  if (prev?.key) t.key = prev.key;                     // keep the lists address key and picks across refreshes
  if (prev?.picks) t.picks = prev.picks;
  saveTokens(t, viewer);
  return t;
}

const refreshing = new Map();
export async function refresh() {
  const viewer = currentViewer();
  if (refreshing.has(viewer)) return refreshing.get(viewer);
  const p = (async () => {
    const t = loadTokens(viewer);
    if (!t) throw viewer ? new UnknownViewerError(viewer) : new AuthError(NOT_CONNECTED);
    const res = await post('/oauth/token', {
      refresh_token: t.refresh_token, client_id: CLIENT_ID,
      ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
      redirect_uri: REDIRECT_URI, grant_type: 'refresh_token',
    });
    if (!res.ok) {
      // Trakt is down or rate limiting: retryable, the login itself is fine.
      if (res.status === 429 || res.status >= 500) throw new TraktError(res.status, `Trakt token refresh -> ${res.status}`, res.headers.get('retry-after'));
      // Trakt rejected the refresh token: flag it so /auth shows "Needs reconnect".
      if (loadTokens(viewer)) saveTokens({ ...t, reauth: true }, viewer);
      throw new AuthError(`token refresh rejected (${res.status}); connect this user again on /auth`);
    }
    if (!loadTokens(viewer)) throw new UnknownViewerError(viewer);     // disconnected while refreshing
    return storeTokenResponse(await res.json(), viewer);
  })().finally(() => { refreshing.delete(viewer); });
  refreshing.set(viewer, p);
  return p;
}

async function accessToken() {
  let t = loadTokens();
  if (!t) throw currentViewer() ? new UnknownViewerError(currentViewer()) : new AuthError(NOT_CONNECTED);
  if (t.reauth) throw new AuthError('Trakt login expired; connect this user again on /auth');
  if (t.expires_at - Date.now() < 24 * 3600 * 1000) t = await refresh();
  return t.access_token;
}

export async function api(method, pathname, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken();
    const res = await fetch(API + pathname, {
      method, headers: headers({ Authorization: `Bearer ${token}` }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && attempt === 0) { await refresh(); continue; }
    if (res.status === 401 || res.status === 403) throw new AuthError(`Trakt ${res.status}`);
    if (res.status === 204) return null;
    if (!res.ok) throw new TraktError(res.status, `Trakt ${method} ${pathname} -> ${res.status}`, res.headers.get('retry-after'));
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
}

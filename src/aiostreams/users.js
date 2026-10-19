// The users of the AIOStreams configuration: the owner (viewer '') plus each household user (viewer = persona id).
import crypto from 'node:crypto';
import { config } from '../config.js';

const TTL = 30_000;
const REFRESH_EVERY = 600_000;
let cache = { at: 0, list: null, traktorId: null };

export async function aioUsers() {
  if (cache.list && Date.now() - cache.at < TTL) return cache.list;
  const { url, uuid, password } = config.aiostreams;
  if (!url || !uuid || !password) throw new Error('Set AIOSTREAMS_URL, AIOSTREAMS_UUID and AIOSTREAMS_PASSWORD in .env');
  const res = await fetch(`${url}/api/v1/user`, { headers: { Authorization: 'Basic ' + Buffer.from(`${uuid}:${password}`).toString('base64') }, signal: AbortSignal.timeout(8000) })
    .catch((e) => { throw new Error(`Cannot reach AIOStreams at ${url} (${e.cause?.code || e.cause?.errors?.[0]?.code || e.cause?.message || e.name}). Check AIOSTREAMS_URL, and that Traktor can open that address.`); });
  if (!res.ok && (res.status === 401 || res.status === 403 || (await res.clone().json().catch(() => null))?.error?.code === 'USER_INVALID_DETAILS')) {
    throw new Error('AIOStreams rejected the login. Check AIOSTREAMS_UUID and AIOSTREAMS_PASSWORD.');
  }
  if (!res.ok) throw new Error(`AIOStreams user lookup failed (${res.status}). Check AIOSTREAMS_URL points at AIOStreams itself.`);
  const userData = (await res.json()).data?.userData || {};
  const j = userData.jellyfin || {};
  // AIOStreams names the addon its preset id plus the first 4 characters of the hash of the addon's identifier, which a custom addon has none of.
  const presetId = (userData.presets || []).find((p) => p.options?.name === 'Traktor')?.instanceId;
  const traktorId = presetId ? presetId + crypto.createHash('sha256').update('').digest('hex').slice(0, 4) : null;
  const list = [{ id: '', name: j.primary?.name || 'Primary user', owner: true }];
  for (const p of j.personas || []) list.push({ id: p.id, name: p.name, shared: p.history === 'shared' });
  cache = { at: Date.now(), list, traktorId };
  return list;
}

// Synchronous lookups of what was last fetched (null until the first fetch succeeds).
export const userName = (viewer) => cache.list?.find((u) => u.id === viewer)?.name ?? null;
export const traktorInstanceId = () => cache.traktorId;

// Keeps user names fresh so log lines say [david] instead of [primary].
export function keepUsersFresh() {
  aioUsers().catch(() => {});
  setInterval(() => aioUsers().catch(() => {}), REFRESH_EVERY).unref();
}

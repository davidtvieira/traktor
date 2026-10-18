// Per-user settings kept beside the Trakt login: the private address key and the ticked lists.
import crypto from 'node:crypto';
import { loadTokens, patchUser, allRecords } from './token-store.js';

// A random key in the private address of a connected user.
export function catalogKey(viewer) {
  const t = loadTokens(viewer);
  if (!t) return null;
  if (!t.key) return patchUser(viewer, { key: crypto.randomBytes(16).toString('hex') }).key;
  return t.key;
}
export function viewerByKey(key) {
  for (const [viewer, t] of allRecords()) if (t.key && t.key === key) return viewer;
  return null;
}
// The lists a user ticked (null = all of them).
export const getPicks = (viewer) => loadTokens(viewer)?.picks ?? null;
// Each save that changes the picks or their order bumps rev, which goes on the end of the user's address so AIOStreams reloads the manifest.
export const getRev = (viewer) => loadTokens(viewer)?.rev ?? 0;
export function setPicks(viewer, picks) {
  const t = loadTokens(viewer);
  if (!t) return;
  const same = Array.isArray(t.picks) && t.picks.length === picks.length && t.picks.every((x, i) => x === picks[i]);
  patchUser(viewer, { picks, rev: (t.rev || 0) + (same ? 0 : 1) });
}

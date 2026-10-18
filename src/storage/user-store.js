// Per-user settings kept beside the Trakt login: the private address key, the ticked lists and the shared charts turned off.
import crypto from 'node:crypto';
import { sharedRev } from './shared-store.js';
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
// A change to the lists shown to everyone counts for every user.
export const getRev = (viewer) => (loadTokens(viewer)?.rev ?? 0) + sharedRev();
// The charts shown to everyone that this user turned off.
export const getOptOut = (viewer) => loadTokens(viewer)?.optout ?? [];
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
export function setPicks(viewer, picks, optout = getOptOut(viewer)) {
  const t = loadTokens(viewer);
  if (!t) return;
  const same = sameList(t.picks, picks) && sameList(t.optout ?? [], optout);
  patchUser(viewer, { picks, optout, rev: (t.rev || 0) + (same ? 0 : 1) });
}

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
// How the user sorts each ticked list, by list id (a list not in here keeps Trakt's order).
export const getSorts = (viewer) => loadTokens(viewer)?.sorts ?? {};
// The charts shown to everyone that this user turned off.
export const getOptOut = (viewer) => loadTokens(viewer)?.optout ?? [];
// The lists this user keeps off Stremio's home screen (they stay in Discover).
export const getNoHome = (viewer) => loadTokens(viewer)?.nohome ?? [];
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
export function setPicks(viewer, picks, optout = getOptOut(viewer), sorts = getSorts(viewer), nohome = getNoHome(viewer)) {
  const t = loadTokens(viewer);
  if (!t) return;
  const same = sameList(t.picks, picks) && sameList(t.optout ?? [], optout) && sameList(t.nohome ?? [], nohome);
  patchUser(viewer, { picks, optout, sorts, nohome, rev: (t.rev || 0) + (same ? 0 : 1) });
}

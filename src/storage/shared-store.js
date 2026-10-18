// Settings for "Everyone": the public lists every user sees, and a private address for users with no Trakt account.
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from './json-store.js';

const file = () => path.join(config.dataDir, 'shared.json');
const read = () => readJson(file(), {});
const patch = (p) => { const s = { ...read(), ...p }; writeJson(file(), s, true); return s; };

// Before a first save everyone gets Trending.
export const getSharedPicks = () => read().picks ?? ['trending'];
// Each change that alters the picks or their order bumps rev, which goes on the end of every address so AIOStreams reloads the manifest.
export const sharedRev = () => read().rev ?? 0;
export function setSharedPicks(picks) {
  const s = read();
  const same = Array.isArray(s.picks) && s.picks.length === picks.length && s.picks.every((x, i) => x === picks[i]);
  patch({ picks, rev: (s.rev || 0) + (same ? 0 : 1) });
}

// The random key in the address for users with no Trakt account. Created on first ask.
export function sharedKey() {
  return read().key || patch({ key: crypto.randomBytes(16).toString('hex') }).key;
}
export const isSharedKey = (key) => Boolean(key) && read().key === key;

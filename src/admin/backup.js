// Backup and restore: the users' Trakt logins, their lists and the private addresses, which is everything Traktor cannot rebuild.
// The progress cache and the sync history are left out: both fill themselves again.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeFileAtomic } from '../storage/json-store.js';

export const BACKUP_MAX = 2_000_000;
const sharedFile = () => path.join(config.dataDir, 'shared.json');
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export const makeBackup = () => ({ traktor: 1, created: new Date().toISOString(), tokens: readJson(config.tokensFile, {}), shared: readJson(sharedFile(), {}) });

// Checks the file before anything is written. Returns the number of users restored.
export function restoreBackup(raw) {
  let b;
  try { b = JSON.parse(raw); } catch { throw new Error('That is not a Traktor backup file (not valid JSON).'); }
  if (!isObject(b) || b.traktor !== 1 || !isObject(b.tokens) || !isObject(b.shared)) throw new Error('That is not a Traktor backup file.');
  const legacy = typeof b.tokens.access_token === 'string';           // the old single-account format
  if (!legacy && !Object.values(b.tokens).every(isObject)) throw new Error('The backup file is damaged: a user record is not an object.');

  // Keep what is being replaced next to it, in case the wrong file was picked.
  for (const f of [config.tokensFile, sharedFile()]) if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.before-restore`);
  writeFileAtomic(config.tokensFile, JSON.stringify(b.tokens, null, 2));
  writeFileAtomic(sharedFile(), JSON.stringify(b.shared, null, 2));
  return legacy ? 1 : Object.keys(b.tokens).length;
}

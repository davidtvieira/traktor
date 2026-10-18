// Per-show watched progress (the list endpoint no longer includes episodes). Cached until the show changes,
// kept compact and saved next to the tokens so a restart does not refetch every show.
import path from 'node:path';
import { config } from '../../../config.js';
import { currentViewer } from '../../../context.js';
import { api } from '../../../trakt/client.js';
import { TraktError } from '../../../trakt/errors.js';
import { readJson, writeFileAtomic } from '../../../storage/json-store.js';
import { setBounded } from '../../../util/bounded-map.js';

const FILE = path.join(config.dataDir, 'cache.json');
const MAX = 3000;
const cache = new Map(Object.entries(readJson(FILE, {})));
let dirty = false;

export function saveProgressCache() {
  if (!dirty) return;
  dirty = false;
  try { writeFileAtomic(FILE, JSON.stringify(Object.fromEntries(cache)), 0o600); }
  catch (e) { console.error('cache save failed:', e.message); }
}

// s is an entry of /sync/watched/shows. Returns { completed, aired, last, done } or null when Trakt does not know the show.
export async function showProgress(s) {
  const key = s.show.ids.trakt;
  const ckey = `${currentViewer()}:${key}`;
  const stamp = `${s.last_updated_at}|${s.plays}`;
  const hit = cache.get(ckey);
  if (hit && hit.stamp === stamp) return hit.data;
  const raw = await api('GET', `/shows/${key}/progress/watched?specials=true&count_specials=false`).catch((e) => {
    if (e instanceof TraktError && e.status === 404) return null;
    throw e;
  });
  const data = raw && {
    completed: raw.completed ?? 0, aired: raw.aired ?? 0,
    last: raw.last_episode ? { season: raw.last_episode.season, number: raw.last_episode.number } : null,
    done: (raw.seasons || []).flatMap((se) => (se.episodes || []).filter((e) => e.completed).map((e) => [se.number, e.number])),
  };
  setBounded(cache, ckey, { stamp, data }, MAX);
  dirty = true;
  return data;
}

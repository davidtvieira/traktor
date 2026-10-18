// Anime addons number episodes absolutely (e.g. S1E1180); Trakt files them by season (S23E1180).
import { api } from '../../../trakt/client.js';
import { TraktError } from '../../../trakt/errors.js';
import { setBounded } from '../../../util/bounded-map.js';

const TTL = 6 * 3600 * 1000;
const seasonsCache = new Map();

async function traktSeasons(ids) {
  const key = ids.trakt || ids.imdb || ids.tmdb || ids.tvdb;
  if (!key) return null;
  const hit = seasonsCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await api('GET', `/shows/${key}/seasons?extended=episodes,full`).catch((e) => (e instanceof TraktError && e.status === 404 ? null : Promise.reject(e)));
  setBounded(seasonsCache, key, { at: Date.now(), data }, 300);
  return data;
}

// absolute number -> { season, episode }, from Trakt's season list (specials excluded).
export function absoluteIndex(seasons) {
  const byAbs = new Map();
  for (const se of seasons) for (const e of se.episodes || []) if (se.number > 0 && e.number_abs) byAbs.set(e.number_abs, { season: se.number, episode: e.number });
  return byAbs;
}

// Rewrites the event's season/episode numbers in place.
export async function fixNumbering(ev) {
  if (ev.scope === 'movie') return;
  const hasOne = ev.season != null || ev.episode != null;
  const list = ev.videos?.length ? ev.videos : (hasOne ? [ev] : []);
  if (!list.length) return;
  if (!list.some((v) => v.season == null || v.season === 1)) return;     // already a season > 1: trust it
  const seasons = await traktSeasons(ev.ids || {});
  if (!seasons) return;
  const byAbs = absoluteIndex(seasons);
  for (const v of list) {
    if (v.episode == null || (v.season != null && v.season !== 1)) continue;
    const m = byAbs.get(v.episode);
    if (m) { v.season = m.season; v.episode = m.episode; }
  }
}

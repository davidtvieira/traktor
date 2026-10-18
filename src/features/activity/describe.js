// Wording for the history on the users page, e.g. "Marked watched: Ozark S03E04".
import { api } from '../../trakt/client.js';
import { setBounded } from '../../util/bounded-map.js';
import { pad2 } from '../../util/time.js';

const PHRASES = { start: 'Started', pause: 'Paused', stop: 'Stopped', played: 'Marked watched', unplayed: 'Marked unwatched', watchlisted: 'Added to watchlist', unwatchlisted: 'Removed from watchlist', dropped: 'Dropped', undropped: 'Undropped', rated: 'Rated', unrated: 'Removed rating' };
const titleCache = new Map();

async function titleOf(ev) {
  const imdb = ev.ids?.imdb;
  if (!imdb) return ev.metaId || 'Unknown title';
  if (titleCache.has(imdb)) return titleCache.get(imdb);
  let t = imdb;
  try {
    const x = (await api('GET', `/search/imdb/${imdb}`))?.[0];
    const m = x?.[x.type];
    if (m?.title) { t = m.year ? `${m.title} (${m.year})` : m.title; setBounded(titleCache, imdb, t, 500); }
  } catch { /* keep the id */ }
  return t;
}

export async function describe(ev, pct) {
  const verb = ev.event === 'stop' && ev.played ? 'Marked watched' : PHRASES[ev.event] || ev.event;
  const part = ev.scope === 'season' ? ` S${pad2(ev.season)}` : ev.scope === 'episode' ? ` S${pad2(ev.season)}E${pad2(ev.episode)}` : '';
  return `${verb}: ${await titleOf(ev)}${part}${pct}`;
}

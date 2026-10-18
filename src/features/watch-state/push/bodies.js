// Pure builders: one AIOStreams push event in, one Trakt request body out (null when the event has no usable ids).
import { traktIds, hasIds, isMovie } from '../../../util/ids.js';
import { isoAt } from '../../../util/time.js';

// A Trakt sync object for a single event. Only history entries carry a timestamp.
export function syncBody(ev, withTime = false) {
  const ids = traktIds(ev.ids);
  if (!hasIds(ids)) return null;
  const t = withTime ? { watched_at: isoAt(ev.at) } : {};
  if (isMovie(ev)) return { movies: [{ ids, ...t }] };
  if (ev.scope === 'series') return { shows: [{ ids }] };
  if (ev.scope === 'season') return { shows: [{ ids, seasons: [{ number: ev.season }] }] };
  return { shows: [{ ids, seasons: [{ number: ev.season, episodes: [{ number: ev.episode, ...t }] }] }] };
}

// A whole season or series: every listed video becomes a history entry.
export function bulkBody(ev) {
  const ids = traktIds(ev.ids);
  if (!hasIds(ids)) return null;
  const seasons = new Map();
  for (const v of ev.videos || []) {
    if (v.season == null || v.episode == null) continue;
    if (!seasons.has(v.season)) seasons.set(v.season, []);
    seasons.get(v.season).push({ number: v.episode, watched_at: isoAt(ev.at) });
  }
  if (!seasons.size) return null;
  return { shows: [{ ids, seasons: [...seasons].map(([number, episodes]) => ({ number, episodes })) }] };
}

export function scrobbleBody(ev) {
  const ids = traktIds(ev.ids);
  if (!hasIds(ids)) return null;
  let progress = ev.durationMs ? (ev.positionMs / ev.durationMs) * 100 : 0;
  progress = Math.max(0, Math.min(100, progress));
  // Trakt marks a scrobble stop >= 80% as watched; only let that happen when AIOStreams says played.
  if (ev.event === 'stop' && !ev.played) progress = Math.min(progress, 79);
  return isMovie(ev)
    ? { movie: { ids }, progress }
    : { show: { ids }, episode: { season: ev.season, number: ev.episode }, progress };
}

export function showOnlyBody(ev) {
  const ids = traktIds(ev.ids);
  return hasIds(ids) ? { shows: [{ ids }] } : null;
}

export function ratingBody(ev) {
  const ids = traktIds(ev.ids);
  if (!hasIds(ids)) return null;
  const rating = ev.rating == null ? undefined : Math.max(1, Math.min(10, Math.round(ev.rating)));
  const r = rating ? { rating, rated_at: isoAt(ev.at) } : {};
  if (ev.scope === 'movie') return { movies: [{ ids, ...r }] };
  if (ev.scope === 'series') return { shows: [{ ids, ...r }] };
  if (ev.scope === 'season') return { shows: [{ ids, seasons: [{ number: ev.season, ...r }] }] };
  if (ev.scope === 'episode') return { shows: [{ ids, seasons: [{ number: ev.season, episodes: [{ number: ev.episode, ...r }] }] }] };
  return null;
}

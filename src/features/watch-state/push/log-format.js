// Log wording for a push: what was sent, and what Trakt answered.
import { pad2 } from '../../../util/time.js';

const LABELS = { start: 'play', pause: 'pause', stop: 'stop', played: 'watched', unplayed: 'unwatched', watchlisted: 'watchlist+', unwatchlisted: 'watchlist-', dropped: 'dropped', undropped: 'undropped', rated: 'rated', unrated: 'unrated' };

export const labelOf = (ev) => (ev.event === 'stop' && ev.played ? 'watched' : LABELS[ev.event] || ev.event).padEnd(10);
export const percentOf = (ev) => (['start', 'pause', 'stop'].includes(ev.event) && ev.durationMs ? ` ${Math.round((ev.positionMs / ev.durationMs) * 100)}%` : '');

export function what(ev) {
  const id = ev.ids?.imdb || ev.metaId || '?';
  if (ev.scope === 'season') return `${id} S${pad2(ev.season)}`;
  if (ev.scope === 'episode') return `${id} S${pad2(ev.season)}E${pad2(ev.episode)}`;
  return id;
}

const tally = (o) => Object.entries(o || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ');

export function outcome(r) {
  if (r?.duplicate) return 'already scrobbled (409)';
  if (!r) return 'ok';
  if (r.action) return `ok, Trakt saved: ${r.action}${r.progress != null ? ` at ${Math.round(r.progress * 10) / 10}%` : ''}`;
  const parts = [['added', r.added], ['deleted', r.deleted], ['updated', r.updated], ['already there', r.existing], ['NOT FOUND', r.not_found]]
    .map(([label, o]) => { const t = tally(o); return t && `${label} ${t}`; }).filter(Boolean);
  return parts.join(', ') || (r.added || r.deleted ? 'nothing changed' : 'ok');
}

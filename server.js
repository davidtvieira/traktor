// Trakt watch_state addon for AIOStreams (watch_state protocol v2).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { api, AuthError, TraktError, UnknownViewerError, viewerContext, knownViewers, viewerStates, deleteTokens, catalogKey, viewerByKey, getPicks, getRev, setPicks, writeFileAtomic, TOKEN_FILE, CLIENT_ID, REDIRECT_URI, exchangeCode } from './trakt.js';
import { esc, page, msg, about, help, ICONS } from './ui.js';
import { listsManifest, catalogMetas, availableLists } from './lists.js';
import { calendarIcs } from './calendar.js';

const LOGO = fs.readFileSync(new URL('./logo.svg', import.meta.url));

const PORT = Number(process.env.PORT || 7100);
const SECRET = process.env.ADDON_SECRET || '';       // path prefix acting as the credential
const PREFIX = SECRET ? `/${SECRET}` : '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';   // optional: protects the /auth page (any username)

const safeEq = (a, b) => crypto.timingSafeEqual(...[a, b].map((x) => crypto.createHash('sha256').update(String(x)).digest()));
const adminOk = (req) => {
  if (!ADMIN_PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const dec = Buffer.from(h.slice(6), 'base64').toString();
  return safeEq(dec.slice(dec.indexOf(':') + 1), ADMIN_PASSWORD);
};
async function readBody(req, max = 1_000_000) {
  let raw = '';
  for await (const c of req.setEncoding('utf8')) {
    raw += c;
    if (raw.length > max) throw Object.assign(new Error('payload too large'), { tooLarge: true });
  }
  return raw;
}
// Insertion-ordered Map that drops its oldest entries past `max`.
function setBounded(map, key, value, max) {
  map.delete(key); map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value);
}

const EVENTS = ['start', 'pause', 'stop', 'played', 'unplayed', 'watchlisted', 'unwatchlisted',
  'dropped', 'undropped', 'rated', 'unrated'];

const manifest = {
  id: 'com.local.trakt-watchstate',
  version: '1.0.0',
  name: 'Traktor',
  description: 'Syncs playback, history, watchlist, ratings and drops with Trakt.',
  types: ['movie', 'series'],
  catalogs: [],
  resources: [{ name: 'watch_state', types: ['movie', 'series'], idPrefixes: ['tt'] }],
  watchState: {
    version: 2,
    viewers: true,
    push: { events: EVENTS, bulk: true },
    pull: { items: true, watched: true, watchlist: true, ratings: true, ttlSeconds: 300 },
  },
};

// ---------- id helpers ----------
function traktIds(ids = {}) {
  const o = {};
  if (ids.imdb) o.imdb = ids.imdb;
  if (ids.tmdb) o.tmdb = Number(ids.tmdb);
  if (ids.tvdb) o.tvdb = Number(ids.tvdb);
  if (ids.trakt) o.trakt = Number(ids.trakt);
  return o;
}
const isoAt = (s) => new Date((s ?? Date.now() / 1000) * 1000).toISOString();
const imdbOf = (x) => x?.ids?.imdb || null;

// Build a Trakt sync object for a single push event. Only history entries carry a timestamp.
function syncBody(ev, withTime = false) {
  const ids = traktIds(ev.ids);
  if (!Object.keys(ids).length) return null;
  const t = withTime ? { watched_at: isoAt(ev.at) } : {};
  const movie = ev.scope === 'movie' || (!ev.scope && !ev.season);
  if (movie) return { movies: [{ ids, ...t }] };
  if (ev.scope === 'series') return { shows: [{ ids }] };
  if (ev.scope === 'season') return { shows: [{ ids, seasons: [{ number: ev.season }] }] };
  return { shows: [{ ids, seasons: [{ number: ev.season, episodes: [{ number: ev.episode, ...t }] }] }] };
}

function bulkBody(ev) {
  const ids = traktIds(ev.ids);
  if (!Object.keys(ids).length) return null;
  const seasons = new Map();
  for (const v of ev.videos || []) {
    if (v.season == null || v.episode == null) continue;
    if (!seasons.has(v.season)) seasons.set(v.season, []);
    seasons.get(v.season).push({ number: v.episode, watched_at: isoAt(ev.at) });
  }
  if (!seasons.size) return null;
  return { shows: [{ ids, seasons: [...seasons].map(([number, episodes]) => ({ number, episodes })) }] };
}

function scrobbleBody(ev) {
  const ids = traktIds(ev.ids);
  if (!Object.keys(ids).length) return null;
  let progress = ev.durationMs ? (ev.positionMs / ev.durationMs) * 100 : 0;
  progress = Math.max(0, Math.min(100, progress));
  // Trakt marks a scrobble stop >= 80% as watched; only let that happen when AIOStreams says played.
  if (ev.event === 'stop' && !ev.played) progress = Math.min(progress, 79);
  const movie = ev.scope === 'movie' || (!ev.scope && !ev.season);
  return movie
    ? { movie: { ids }, progress }
    : { show: { ids }, episode: { season: ev.season, number: ev.episode }, progress };
}


// ---------- episode numbering (absolute -> Trakt season/episode) ----------
// Anime addons number episodes absolutely (e.g. S1E1180); Trakt files them by season (S23E1180).
const seasonsCache = new Map();
async function traktSeasons(ids) {
  const key = ids.trakt || ids.imdb || ids.tmdb || ids.tvdb;
  if (!key) return null;
  const hit = seasonsCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.data;
  const data = await api('GET', `/shows/${key}/seasons?extended=episodes,full`).catch((e) => (e instanceof TraktError && e.status === 404 ? null : Promise.reject(e)));
  setBounded(seasonsCache, key, { at: Date.now(), data }, 300);
  return data;
}
async function fixNumbering(ev) {
  if (ev.scope === 'movie') return;
  const hasOne = ev.season != null || ev.episode != null;
  const list = ev.videos?.length ? ev.videos : (hasOne ? [ev] : []);
  if (!list.length) return;
  if (!list.some((v) => v.season == null || v.season === 1)) return;     // already a season > 1: trust it
  const seasons = await traktSeasons(ev.ids || {});
  if (!seasons) return;
  const byAbs = new Map();
  for (const se of seasons) for (const e of se.episodes || []) if (se.number > 0 && e.number_abs) byAbs.set(e.number_abs, { season: se.number, episode: e.number });
  for (const v of list) {
    if (v.episode == null || (v.season != null && v.season !== 1)) continue;
    const m = byAbs.get(v.episode);
    if (m) { v.season = m.season; v.episode = m.episode; }
  }
}

// ---------- last update per user ----------
// The last event written to Trakt for each user, shown on the users page. Saved with a short delay so it survives restarts.
const ACTIVITY_FILE = path.join(path.dirname(TOKEN_FILE), 'activity.json');
let activity = {};
try { activity = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8')); } catch { /* none yet */ }
const HISTORY_MAX = 10;                  // actions kept per user
let activityTimer = null;
// text set: an event was written to Trakt. No text: AIOStreams just checked in (a pull).
function touchActivity(text) {
  const v = viewerContext.getStore()?.viewer ?? '';
  const now = Date.now(), a = activity[v] || {};
  activity[v] = text ? { ...a, at: now, text, seen: now, recent: [{ at: now, text }, ...(a.recent || [])].slice(0, HISTORY_MAX) } : { ...a, seen: now };
  if (activityTimer) return;
  activityTimer = setTimeout(() => {
    activityTimer = null;
    try { writeFileAtomic(ACTIVITY_FILE, JSON.stringify(activity), 0o600); } catch (e) { console.error('activity save failed:', e.message); }
  }, 5000);
  activityTimer.unref();
}
function activityLine(a) {
  if (!a?.seen) return 'No updates yet';
  if (!a.recent?.length) return `Last sync ${ago(a.seen)}`;
  const info = `<button type=button class=info title="Last ${HISTORY_MAX} actions" aria-label="Last ${HISTORY_MAX} actions" onclick="hist(this)">i</button>`;
  const rows = a.recent.map((r) => `<li>${esc(r.text)} <em>${ago(r.at)}</em></li>`).join('');
  return `Last sync ${ago(a.seen)} ${info}</span><ul class=hist>${rows}</ul><span hidden>`;
}
function ago(at) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

// ---------- logging ----------
// One line per thing the addon does, tagged with the AIOStreams user it was done for.
const who = (v) => {
  if (v === undefined) { const store = viewerContext.getStore(); if (!store) return 'system'; v = store.viewer || ''; }
  return (usersCache.list?.find((u) => u.id === v)?.name || v || 'primary').toLowerCase();
};
const log = (msg, v) => console.log(`${new Date().toISOString().slice(11, 19)} [${who(v)}] ${msg}`);

const tally = (o) => Object.entries(o || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ');
function outcome(r) {
  if (r?.duplicate) return 'already scrobbled (409)';
  if (!r) return 'ok';
  if (r.action) return `ok, Trakt saved: ${r.action}${r.progress != null ? ` at ${Math.round(r.progress * 10) / 10}%` : ''}`;
  const parts = [['added', r.added], ['deleted', r.deleted], ['updated', r.updated], ['already there', r.existing], ['NOT FOUND', r.not_found]]
    .map(([label, o]) => { const t = tally(o); return t && `${label} ${t}`; }).filter(Boolean);
  return parts.join(', ') || (r.added || r.deleted ? 'nothing changed' : 'ok');
}
const pad2 = (n) => String(n).padStart(2, '0');
function what(ev) {
  const id = ev.ids?.imdb || ev.metaId || '?';
  if (ev.scope === 'season') return `${id} S${pad2(ev.season)}`;
  if (ev.scope === 'episode') return `${id} S${pad2(ev.season)}E${pad2(ev.episode)}`;
  return id;
}
const LABELS = { start: 'play', pause: 'pause', stop: 'stop', played: 'watched', unplayed: 'unwatched', watchlisted: 'watchlist+', unwatchlisted: 'watchlist-', dropped: 'dropped', undropped: 'undropped', rated: 'rated', unrated: 'unrated' };

// Wording for the history on the users page, e.g. "Marked watched: Ozark S03E04".
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
async function describe(ev, pct) {
  const verb = ev.event === 'stop' && ev.played ? 'Marked watched' : PHRASES[ev.event] || ev.event;
  const part = ev.scope === 'season' ? ` S${pad2(ev.season)}` : ev.scope === 'episode' ? ` S${pad2(ev.season)}E${pad2(ev.episode)}` : '';
  return `${verb}: ${await titleOf(ev)}${part}${pct}`;
}

// ---------- push ----------
const SKIPPED = Symbol('skipped');
async function handlePush(ev) {
  await fixNumbering(ev);
  const label = (ev.event === 'stop' && ev.played ? 'watched' : LABELS[ev.event] || ev.event).padEnd(10);
  const pct = ['start', 'pause', 'stop'].includes(ev.event) && ev.durationMs ? ` ${Math.round((ev.positionMs / ev.durationMs) * 100)}%` : '';
  try {
    const r = await sendPush(ev);
    log(`${label}${what(ev)}${pct} -> ${r === SKIPPED ? 'skipped (no ids or no duration)' : outcome(r)}`);
    touchActivity(await describe(ev, pct) + (r === SKIPPED ? ' (skipped, no ids)' : ''));
  } catch (e) {
    log(`${label}${what(ev)}${pct} -> FAILED ${e.message}`);
    touchActivity(`${await describe(ev, pct)} (failed)`);
    e.logged = true;
    throw e;
  }
}

async function sendPush(ev) {
  const bulk = ev.videos && (ev.scope === 'season' || ev.scope === 'series');
  switch (ev.event) {
    case 'start': case 'pause': {
      const b = scrobbleBody(ev); if (!b || !ev.durationMs) return SKIPPED;
      return scrobble(ev.event, b);
    }
    case 'stop': {
      if (ev.played) return syncHistory(ev);
      const b = scrobbleBody(ev); if (!b || !ev.durationMs) return SKIPPED;
      return scrobble('stop', b);
    }
    case 'played': {
      const body = bulk ? bulkBody(ev) : syncBody(ev, true);
      return body ? api('POST', '/sync/history', body) : SKIPPED;
    }
    case 'unplayed': {
      const body = bulk ? bulkBody(ev) : syncBody(ev);
      return body ? api('POST', '/sync/history/remove', body) : SKIPPED;
    }
    case 'watchlisted': { const b = syncBody(ev); return b ? api('POST', '/sync/watchlist', b) : SKIPPED; }
    case 'unwatchlisted': { const b = syncBody(ev); return b ? api('POST', '/sync/watchlist/remove', b) : SKIPPED; }
    case 'dropped': { const b = showOnly(ev); return b ? api('POST', '/users/hidden/dropped', b) : SKIPPED; }
    case 'undropped': { const b = showOnly(ev); return b ? api('POST', '/users/hidden/dropped/remove', b) : SKIPPED; }
    case 'rated': { const b = ratingBody(ev); return b ? api('POST', '/sync/ratings', b) : SKIPPED; }
    case 'unrated': { const b = ratingBody(ev); return b ? api('POST', '/sync/ratings/remove', b) : SKIPPED; }
  }
  return SKIPPED;
}

async function syncHistory(ev) {
  const b = syncBody(ev, true);
  return b ? api('POST', '/sync/history', b) : SKIPPED;
}

async function scrobble(kind, body) {
  try { return await api('POST', `/scrobble/${kind}`, body); }
  catch (e) { if (e instanceof TraktError && e.status === 409) return { duplicate: true }; throw e; } // already scrobbled recently
}

function showOnly(ev) {
  const ids = traktIds(ev.ids);
  return Object.keys(ids).length ? { shows: [{ ids }] } : null;
}

function ratingBody(ev) {
  const ids = traktIds(ev.ids);
  if (!Object.keys(ids).length) return null;
  const at = isoAt(ev.at);
  const rating = ev.rating == null ? undefined : Math.max(1, Math.min(10, Math.round(ev.rating)));
  const r = rating ? { rating, rated_at: at } : {};
  if (ev.scope === 'movie') return { movies: [{ ids, ...r }] };
  if (ev.scope === 'series') return { shows: [{ ids, ...r }] };
  if (ev.scope === 'season') return { shows: [{ ids, seasons: [{ number: ev.season, ...r }] }] };
  if (ev.scope === 'episode') return { shows: [{ ids, seasons: [{ number: ev.season, episodes: [{ number: ev.episode, ...r }] }] }] };
  return null;
}

// Per-show watched progress (the list endpoint no longer includes episodes). Cached until the show changes,
// kept compact and saved next to the tokens so a restart does not refetch every show.
const CACHE_FILE = path.join(path.dirname(TOKEN_FILE), 'cache.json');
const CACHE_MAX = 3000;
const progressCache = new Map();
let cacheDirty = false;
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')))) progressCache.set(k, v); } catch { /* no cache yet */ }
function saveCache() {
  if (!cacheDirty) return;
  cacheDirty = false;
  try { writeFileAtomic(CACHE_FILE, JSON.stringify(Object.fromEntries(progressCache)), 0o600); }
  catch (e) { console.error('cache save failed:', e.message); }
}
async function showProgress(s) {
  const key = s.show.ids.trakt;
  const ckey = `${viewerContext.getStore()?.viewer ?? ''}:${key}`;
  const stamp = `${s.last_updated_at}|${s.plays}`;
  const hit = progressCache.get(ckey);
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
  setBounded(progressCache, ckey, { stamp, data }, CACHE_MAX);
  cacheDirty = true;
  return data;
}
async function mapLimit(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k]); }
  }));
  return out;
}

// ---------- pull ----------
async function handlePull(since) {
  touchActivity();
  const act = await api('GET', '/sync/last_activities');
  const version = crypto.createHash('sha1').update(JSON.stringify(act)).digest('hex').slice(0, 16);

  const playback = await api('GET', '/sync/playback');
  const items = [];
  for (const p of playback || []) {
    const at = Math.floor(Date.parse(p.paused_at) / 1000);
    if (p.type === 'movie' && imdbOf(p.movie)) {
      const id = imdbOf(p.movie);
      items.push({ type: 'movie', metaId: id, videoId: id, progressPercent: p.progress, played: false, at });
    } else if (p.type === 'episode' && imdbOf(p.show)) {
      const id = imdbOf(p.show);
      items.push({ type: 'series', metaId: id, videoId: `${id}:${p.episode.season}:${p.episode.number}`,
        season: p.episode.season, episode: p.episode.number, progressPercent: p.progress, played: false, at });
    }
  }
  const out = { version, items };
  if (since === version) return out;               // gate: nothing changed in the watched/list half

  const [wm, ws, wl, rt, dr] = await Promise.all([
    api('GET', '/sync/watched/movies?limit=10000'),
    api('GET', '/sync/watched/shows?limit=10000'),
    api('GET', '/sync/watchlist?limit=10000'),
    api('GET', '/sync/ratings?limit=10000'),
    api('GET', '/users/hidden/dropped?type=show&limit=10000').catch((e) => { console.warn('dropped list unavailable:', e.message); return null; }),
  ]);

  const movies = [], episodes = [], nextUp = [], counts = {};
  for (const m of wm || []) if (imdbOf(m.movie)) movies.push(imdbOf(m.movie));
  const shows = (ws || []).filter((s) => imdbOf(s.show));
  const progress = await mapLimit(shows, 4, (s) => showProgress(s));
  shows.forEach((s, i) => {
    const id = imdbOf(s.show); const pr = progress[i]; if (!pr) return;
    for (const [sn, en] of pr.done) episodes.push(`${id}:${sn}:${en}`);
    counts[id] = { watched: pr.completed, total: pr.aired };
    const le = pr.last;
    if (le) nextUp.push({ type: 'series', metaId: id, videoId: `${id}:${le.season}:${le.number}`,
      season: le.season, episode: le.number, at: Math.floor(Date.parse(s.last_watched_at) / 1000) });
  });
  saveCache();
  out.watched = { movies, episodes, counts, nextUp };
  if (dr) out.watched.dropped = dr.map((d) => imdbOf(d.show)).filter(Boolean);

  out.watchlist = (wl || []).flatMap((w) => {
    const o = w.movie || w.show; const id = imdbOf(o);
    return id ? [{ type: w.movie ? 'movie' : 'series', metaId: id, at: Math.floor(Date.parse(w.listed_at) / 1000) }] : [];
  });

  out.ratings = (rt || []).flatMap((r) => {
    const at = Math.floor(Date.parse(r.rated_at) / 1000);
    if (r.type === 'movie' && imdbOf(r.movie)) return [{ type: 'movie', metaId: imdbOf(r.movie), rating: r.rating, at }];
    if (r.type === 'show' && imdbOf(r.show)) return [{ type: 'series', metaId: imdbOf(r.show), rating: r.rating, at }];
    if (r.type === 'season' && imdbOf(r.show)) return [{ type: 'series', metaId: imdbOf(r.show), season: r.season.number, rating: r.rating, at }];
    if (r.type === 'episode' && imdbOf(r.show)) {
      const id = imdbOf(r.show);
      return [{ type: 'series', metaId: id, videoId: `${id}:${r.episode.season}:${r.episode.number}`, rating: r.rating, at }];
    }
    return [];
  });
  log(`pull -> ${episodes.length} watched episodes, ${movies.length} movies, ${out.items.length} in progress, ${out.watchlist.length} watchlisted`);
  return out;
}


// ---------- browser login (per viewer) ----------
const OOB = REDIRECT_URI.startsWith('urn:');
const pending = new Map();                       // state -> { verifier, viewer, at }
const cleanViewer = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
const AIO_URL = (process.env.AIOSTREAMS_URL || '').replace(/\/$/, '');
let usersCache = { at: 0, list: null, traktorId: null };

// The users of the AIOStreams configuration: the owner (viewer '') plus each household user (viewer = persona id).
async function aioUsers() {
  if (usersCache.list && Date.now() - usersCache.at < 30000) return usersCache.list;
  const { AIOSTREAMS_UUID: uuid, AIOSTREAMS_PASSWORD: pw } = process.env;
  if (!AIO_URL || !uuid || !pw) throw new Error('Set AIOSTREAMS_URL, AIOSTREAMS_UUID and AIOSTREAMS_PASSWORD in .env');
  const res = await fetch(`${AIO_URL}/api/v1/user`, { headers: { Authorization: 'Basic ' + Buffer.from(`${uuid}:${pw}`).toString('base64') } });
  if (!res.ok) throw new Error(`AIOStreams user lookup failed (${res.status})`);
  const userData = (await res.json()).data?.userData || {};
  const j = userData.jellyfin || {};
  // AIOStreams names the addon its preset id plus the first 4 characters of the hash of the addon's identifier, which a custom addon has none of.
  const presetId = (userData.presets || []).find((p) => p.options?.name === 'Traktor')?.instanceId;
  const traktorId = presetId ? presetId + crypto.createHash('sha256').update('').digest('hex').slice(0, 4) : null;
  const list = [{ id: '', name: j.primary?.name || 'Primary user', owner: true }];
  for (const p of j.personas || []) list.push({ id: p.id, name: p.name, shared: p.history === 'shared' });
  usersCache = { at: Date.now(), list, traktorId };
  return list;
}

async function authIndex(req) {
  const users = await aioUsers();
  const states = viewerStates();
  const rows = users.map((u) => {
    const href = u.owner ? '?owner=1' : `?viewer=${encodeURIComponent(u.id)}`;
    const st = states[u.id];
    const sub = u.owner ? 'Primary user' : u.shared ? "Shares the primary user's history" : 'Household user';
    return `<div class=user><div class=av>${esc((u.name || '?').slice(0, 1).toUpperCase())}</div>
<div class=who><b title="${esc(u.name)}">${esc(u.name)}</b><span>${sub}</span>${st === 'ok' ? `<span>${activityLine(activity[u.id])}</span>` : ''}</div>
${st === 'ok' ? `<button type=button class="ghost ic" title="Copy calendar link" aria-label="Copy calendar link" data-url="${esc(`${publicBase(req)}/u/${catalogKey(u.id)}/calendar.ics`)}" data-msg="Calendar link copied" onclick="cp(this)">${ICONS.calendar}<span class=lb>iCal</span></button>` : ''}
${st === 'ok' ? `<a class="btn ghost ic" title="Lists" aria-label="Lists" href="${u.owner ? '?lists=1&owner=1' : `?lists=1&viewer=${encodeURIComponent(u.id)}`}">${ICONS.lists}<span class=lb>Lists</span></a>` : ''}
${st === 'ok'
  ? `<form method=post style="margin:0" onsubmit="return confirm('Disconnect ${esc(u.name).replace(/'/g,"")} from Trakt?')"><input type=hidden name=disconnect value="${esc(u.id)}"><button class="ghost warn ic" title="Disconnect" aria-label="Disconnect">${ICONS.unlink}<span class=lb>Disconnect</span></button></form>`
  : `<a class=btn href="${href}">${st === 'reauth' ? 'Reconnect' : 'Connect'}</a>`}</div>`;
  }).join('');
  return page(`<h1>AIOStreams users</h1><p class=sub>Connect each AIOStreams user to their Trakt account.</p><div class=card>${rows}</div><footer style="display:grid;gap:10px"><button type=button data-url="${esc(publicBase(req))}/manifest.json" data-msg="Manifest copied" onclick="cp(this)" style="width:100%">Copy manifest</button><a class="btn ghost" href="/" style="display:block;text-align:center">Back</a></footer><dialog id=hd><h2 id=ht></h2><p id=hs class=sub style="margin:-6px 0 12px"></p><ul id=hl></ul><button type=button class=ghost onclick="hd.close()" style="width:100%">Close</button></dialog><script>function hist(b){var w=b.closest('.who');ht.textContent=w.querySelector('b').textContent;hl.innerHTML=w.querySelector('.hist').innerHTML;hs.textContent='Showing the last ${HISTORY_MAX} actions';hd.showModal()}
hd.addEventListener('click',function(e){if(e.target===hd)hd.close()});
function cp(b){var e=document.createElement('textarea'),ok=false,l=b.dataset.l||(b.dataset.l=b.textContent);e.value=b.dataset.url;document.body.appendChild(e);e.select();try{ok=document.execCommand('copy')}catch(x){}
document.body.removeChild(e);if(!ok&&navigator.clipboard){navigator.clipboard.writeText(b.dataset.url);ok=true}toast(ok?(b.dataset.msg||'Copied'):'Copy failed',!ok)}</script>`);
}

const publicBase = (req) => (process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`).replace(/\/$/, '');

async function listsPage(req, viewer, user) {
  const key = catalogKey(viewer);
  if (!key) return msg('err', 'Not connected', 'Connect this user to Trakt first.');
  let avail;
  try { avail = await viewerContext.run({ viewer }, () => availableLists(viewer, true)); }
  catch (e) { return msg('err', 'Could not load lists', esc(e.message).slice(0, 300)); }
  const picks = getPicks(viewer);
  const chosen = picks ? picks.map((id) => avail.find((l) => l.id === id)).filter(Boolean) : avail.filter((l) => l.defaultOn);
  const chosenIds = new Set(chosen.map((l) => l.id));
  const row = (l) => `<div class=lr data-i="${avail.indexOf(l)}" data-g="${esc(l.group)}"><label style="flex:1;display:flex;align-items:center;min-width:0"><input type=checkbox name=pick value="${esc(l.id)}" onchange="tg(this)" style="width:auto;margin:0 12px 0 0"${chosenIds.has(l.id) ? ' checked' : ''}>${esc(l.name)}</label><span class=mvs><button type=button class="mvb up" onclick="mv(this,-1)" title="Move up" aria-label="Move up"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button type=button class="mvb dn" onclick="mv(this,1)" title="Move down" aria-label="Move down"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></span></div>`;
  const head = (t) => `<b style="display:block;margin:14px 0 4px;color:var(--mute);font-size:13px">${esc(t)}</b>`;
  const groups = [...new Set(avail.map((l) => l.group))];
  const boxes = `<div class=g>${head('Shown, in this order')}<div id=shown>${chosen.map(row).join('')}</div></div>`
    + groups.map((g) => `<div class=g>${head(g)}<div class=gl data-g="${esc(g)}">${avail.filter((l) => l.group === g && !chosenIds.has(l.id)).map(row).join('')}</div></div>`).join('');
  const moveJs = `<style>.g:not(:has(.lr)){display:none}button:disabled{opacity:.45;cursor:default}.lr{display:flex;align-items:center;padding:8px 12px;margin:6px 0;background:var(--card2);border-radius:10px}.mvs{display:none;gap:4px;margin-left:8px}#shown .mvs{display:inline-flex}
.mvb{width:30px;height:30px;padding:0;display:inline-grid;place-items:center;border-radius:8px;background:var(--red);border:0;color:#fff}
.mvb:hover{background:var(--red2)}.mvb svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#shown .lr:first-child .up,#shown .lr:last-child .dn{opacity:.3;pointer-events:none}</style>
<script>function mv(b,d){var r=b.closest('.lr'),s=d<0?r.previousElementSibling:r.nextElementSibling;if(s&&s.classList.contains('lr'))r.parentNode.insertBefore(d<0?r:s,d<0?s:r);chk()}
function tg(c){var r=c.closest('.lr');
if(c.checked){document.getElementById('shown').appendChild(r);chk();return}
var gl=[].filter.call(document.querySelectorAll('.gl'),function(x){return x.dataset.g===r.dataset.g})[0];if(!gl)return;
var after=[].filter.call(gl.children,function(x){return +x.dataset.i>+r.dataset.i})[0];gl.insertBefore(r,after||null);chk()}</script>`;
  const rev = getRev(viewer);
  const addr = `${publicBase(req)}/u/${key}/manifest.json${rev ? `?r=${rev}` : ''}`;
  await aioUsers().catch(() => {});
  // Keeps the catalogs in the order Traktor sends them (AIOStreams otherwise keeps its own saved positions).
  const orderLine = usersCache.traktorId ? `\nadd upstreamCatalogOrder "${usersCache.traktorId}"` : '';
  const script = `enable presets[options.name="Traktor"]\nset presets[options.name="Traktor"].options.manifestUrl = "${addr}"${orderLine}`;
  // The clipboard API needs HTTPS, so copy through a temporary textarea with the older copy command, which works on plain http.
  const copyJs = `<script>function cp(b){var e=document.createElement('textarea'),ok=false;e.value=b.dataset.url;document.body.appendChild(e);e.select();try{ok=document.execCommand('copy')}catch(x){}
document.body.removeChild(e);if(!ok&&navigator.clipboard){navigator.clipboard.writeText(b.dataset.url);ok=true}toast(ok?'Script copied':'Copy failed',!ok)}</script>`;
  const saveJs = `<script>function state(){return [].map.call(document.querySelectorAll('input[name=pick]:checked'),function(x){return x.value}).join(',')}
var base=state();
function chk(){document.getElementById('sv').disabled=state()===base}
function saveLists(f){var b=document.getElementById('sv');b.disabled=true;
fetch('',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f))})
.then(function(r){return r.text().then(function(t){var ok=r.ok&&t.indexOf('msg good')>-1;
if(!ok)return toast('Could not save lists',true);
base=state();toast('Lists saved. Copy the script again and update the variant.');
return fetch(location.href).then(function(g){return g.text()}).then(function(h){var n=new DOMParser().parseFromString(h,'text/html').getElementById('cs'),c=document.getElementById('cs');if(n&&c)c.dataset.url=n.dataset.url})})})
.catch(function(){toast('Could not save lists',true)}).then(chk);return false}</script>`;
  return page(`<h1>Lists for ${esc(user.name)}</h1><p class=sub>Choose which of this user's Trakt lists to show as catalogs, and use the arrows to put them in order. After saving, copy the script below again and paste it over this user's variant in AIOStreams, see <a href="/help">Help</a>.</p>
<form method=post class=card autocomplete=off onsubmit="return saveLists(this)"><div style="padding:14px"><input type=hidden name=listsfor value="${esc(viewer)}"><div>${boxes}</div><div style="margin-top:12px"><button id=sv disabled style="width:100%">Save lists</button></div></div></form>
<div class=card style="margin-top:16px"><div style="padding:14px"><b>Variant for AIOStreams</b>
<p class=sub style="margin-top:10px">In AIOStreams create a variant named <code>${esc(user.name.toLowerCase())}</code>, paste this as its script, and pick it for this user under Users. It points the <code>Traktor</code> addon at this user's own address, for their watch state and their lists. Anyone with the address can see the chosen lists.</p>
<button type=button id=cs data-url="${esc(script)}" onclick="cp(this)" style="width:100%;margin-top:6px">Copy script</button></div></div>
<footer><a class="btn ghost" href="?" style="display:block;text-align:center">Back</a></footer>${copyJs}${saveJs}${moveJs}`);
}

async function authPage(url, req) {
  if (!url.searchParams.has('viewer') && !url.searchParams.has('owner')) return authIndex(req);
  const viewer = url.searchParams.has('owner') ? '' : cleanViewer(url.searchParams.get('viewer'));
  const user = (await aioUsers()).find((u) => u.id === viewer);
  if (!user) return msg('err', 'Unknown user', 'That user does not exist in AIOStreams.');
  if (url.searchParams.has('lists')) return listsPage(req, viewer, user);
  for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60 * 1000) pending.delete(k);
  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pending.set(state, { verifier, viewer, at: Date.now() });
  const link = 'https://trakt.tv/oauth/authorize?' + new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
    code_challenge: challenge, code_challenge_method: 'S256', state,
  });
  return page(`<h1>Connect Trakt for ${esc(user.name)}</h1><p class=sub>Two quick steps.</p>
<div class=card><ol class=steps>
<li><b>Approve access</b><p>Sign in to trakt.tv as the person this is for, then approve.</p>
<a class=btn href="${esc(link)}" target=_blank rel=noopener>Open Trakt</a></li>
<li><b>Paste the ${OOB ? 'code' : 'address'}</b><p>${OOB ? 'Trakt shows an authorization code. Copy it and paste it below.' : `Trakt redirects to <code>${esc(REDIRECT_URI)}</code>, which may show an error page. Copy the full address from the address bar and paste it below.`}</p>
<form method=post><input type=hidden name=state value="${state}">
<input name=url placeholder="${OOB ? 'Authorization code' : esc(REDIRECT_URI) + '?code=...'}" required autocomplete=off><button>Finish</button></form></li>
</ol></div><footer><a class="btn ghost" href="?" style="display:block;text-align:center">Back</a></footer>`);
}

async function authSubmit(raw) {
  const f = new URLSearchParams(raw);
  if (f.has('listsfor')) {
    const lv = cleanViewer(f.get('listsfor'));
    if (!knownViewers().includes(lv)) return msg('err', 'Not connected', 'Connect this user to Trakt first.');
    const picks = f.getAll('pick').filter((x) => /^[a-z0-9-]{1,40}$/.test(x));
    setPicks(lv, picks);
    log(`lists saved: ${picks.length} selected`, lv);
    return msg('good', 'Lists saved', 'AIOStreams may take a few minutes to show the change. Save the addon there again if it does not.');
  }
  if (f.has('disconnect')) {
    const v = cleanViewer(f.get('disconnect'));
    if (!knownViewers().includes(v)) return msg('err', 'Not connected', 'That user has no Trakt account linked.');
    deleteTokens(v);
    log('disconnected from Trakt', v);
    return msg('good', 'Disconnected', 'The Trakt account was unlinked. You can connect it again from the list.');
  }
  let input = (f.get('url') || '').trim(), code = input, state = f.get('state');
  if (input.includes('code=')) { const u = new URL(input); code = u.searchParams.get('code'); state = u.searchParams.get('state') || state; }
  const p = pending.get(state);
  if (!p || !code) return msg('err', 'Expired or invalid', 'Start again from the list.');
  pending.delete(state);
  await exchangeCode(code, p.verifier, p.viewer);
  log('connected to Trakt', p.viewer);
  return msg('good', 'Connected', 'Trakt is linked. Syncing starts automatically.');
}


// ---------- server ----------
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/logo.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }); return res.end(LOGO); }
    if (req.method === 'GET' && url.pathname === '/help') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(help()); }
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(about()); }
    const lm = url.pathname.match(/^\/u\/([a-f0-9]{32})\/(.+)$/);       // private lists address (primary user)
    if (lm) {
      const lv = viewerByKey(lm[1]);
      if (lv === null) return send(res, 404, { error: 'not found' });
      return await viewerContext.run({ viewer: lv }, () => listsRoute(req, res, lv, url, lm[2]));
    }
    const isAuth = url.pathname === '/auth';            // short address, no secret (meant for a private network / VPN)
    if (!isAuth && SECRET && !(url.pathname.startsWith(PREFIX + '/') && safeEq(url.pathname.split('/')[1], SECRET))) return send(res, 404, { error: 'not found' });
    const p = isAuth ? '/auth' : url.pathname.slice(PREFIX.length);
    const viewer = cleanViewer(url.searchParams.get('viewer'));

    if (p === '/auth') {
      const html = (code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
      if (!adminOk(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Traktor"', 'Content-Type': 'text/plain' }); return res.end('Password required'); }
      if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return html(403, msg('err', 'Blocked', 'Cross-site request refused.'));
      if (!CLIENT_ID) return html(500, msg('err', 'Not configured', 'TRAKT_CLIENT_ID is not set.'));
      try {
        if (req.method === 'GET') return html(200, await authPage(url, req));
        if (req.method === 'POST') {
          return html(200, await authSubmit(await readBody(req, 20_000)));
        }
      } catch (e) { log(`ERROR auth page: ${e.message}`); return html(400, msg('err', 'Something went wrong', esc(e.message).slice(0, 300))); }
    }
    return await viewerContext.run({ viewer }, () => route(req, res, url, p));
  } catch (e) { return fail(res, e); }
});
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.listen(PORT, '0.0.0.0', () => console.log(`traktor on :${PORT}`));
// Keeps user names fresh so log lines say [david] instead of [primary].
aioUsers().catch(() => {});
setInterval(() => aioUsers().catch(() => {}), 600_000).unref();

// A user's own address serves everything for that user: watch state, and their Trakt lists as catalogs.
async function listsRoute(req, res, viewer, url, rest) {
  try {
    if (rest === 'manifest.json' && req.method === 'GET') {
      const lists = await listsManifest(viewer, `${publicBase(req)}/logo.svg`);
      log(`manifest -> ${lists.catalogs.length} list catalogs`);
      return send(res, 200, { ...manifest, ...lists, id: `com.local.traktor.${viewer || 'primary'}`, name: 'Traktor',
        description: 'Syncs playback with Trakt and shows your Trakt lists', resources: [...manifest.resources, 'catalog'] });
    }
    if (rest === 'calendar.ics' && req.method === 'GET') {
      const name = (await aioUsers().catch(() => [])).find((u) => u.id === viewer)?.name;
      const ics = await calendarIcs(viewer, name ? `Traktor - ${name}` : 'Traktor');
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="traktor.ics"', 'Cache-Control': 'private, max-age=900' });
      log(`calendar -> ${(ics.match(/BEGIN:VEVENT/g) || []).length} events`);
      return res.end(ics);
    }
    if (rest.startsWith('watch_state/')) {
      // An address belongs to one user: a call that names a different user is dropped, never written to this account.
      if (cleanViewer(url.searchParams.get('viewer')) !== viewer) return send(res, 404, { error: 'unknown viewer' });
      if (await watchStateRoute(req, res, url, `/${rest}`)) return;
    }
    const m = rest.match(/^catalog\/(movie|series)\/([\w-]+)(?:\/([^/]+))?\.json$/);
    if (m && req.method === 'GET') {
      const skip = Number(decodeURIComponent(m[3] || '').match(/skip=(\d+)/)?.[1] || 0);
      const metas = await catalogMetas(viewer, m[1], m[2], skip);
      log(`catalog ${m[1]} ${m[2]}${skip ? ` from ${skip}` : ''} -> ${metas.length} titles`);
      return send(res, 200, { metas });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) { return fail(res, e); }
}

// The watch_state calls, shared by the plain addon and the per-user address. True when handled.
async function watchStateRoute(req, res, url, p) {
  if (req.method === 'GET' && p === '/watch_state/pull.json') {
    send(res, 200, await handlePull(url.searchParams.get('since') || ''));
    return true;
  }
  if (req.method === 'POST' && p.startsWith('/watch_state/push/')) {
    const ev = JSON.parse(await readBody(req));
    await handlePush(ev);
    send(res, 200, { ok: true });
    return true;
  }
  return false;
}

async function route(req, res, url, p) {
  try {

    if (req.method === 'GET' && p === '/manifest.json') {
      const proto = req.headers['x-forwarded-proto'] || 'http';
      return send(res, 200, { ...manifest, logo: `${proto}://${req.headers.host}/logo.svg` });
    }

    if (await watchStateRoute(req, res, url, p)) return;
    send(res, 404, { error: 'not found' });
  } catch (e) { return fail(res, e); }
}

function fail(res, e) {
  if (!e.logged) log(`ERROR ${e.message}`);
  if (e.tooLarge) return send(res, 413, { error: e.message });
  if (e instanceof UnknownViewerError) return send(res, 404, { error: 'unknown viewer' });   // dropped, not retried
  if (e instanceof AuthError) return send(res, 401, { error: e.message });
  if (e instanceof TraktError) {
    const h = e.retryAfter ? { 'Retry-After': e.retryAfter } : {};
    if (e.status === 429 || e.status >= 500) return send(res, e.status === 429 ? 429 : 503, { error: e.message }, h);
    return send(res, 400, { error: e.message });       // unmappable item: drop, don't retry
  }
  send(res, e instanceof SyntaxError ? 400 : 500, { error: e.message });
}

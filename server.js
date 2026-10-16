// Trakt watch_state addon for AIOStreams (watch_state protocol v2).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { api, AuthError, TraktError, UnknownViewerError, viewerContext, knownViewers, viewerStates, deleteTokens, writeFileAtomic, TOKEN_FILE, CLIENT_ID, REDIRECT_URI, exchangeCode } from './trakt.js';
import { esc, page, msg, about } from './ui.js';

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

// ---------- push ----------
async function handlePush(ev) {
  await fixNumbering(ev);
  const bulk = ev.videos && (ev.scope === 'season' || ev.scope === 'series');
  switch (ev.event) {
    case 'start': case 'pause': {
      const b = scrobbleBody(ev); if (!b || !ev.durationMs) return;
      return scrobble(ev.event, b);
    }
    case 'stop': {
      if (ev.played) return syncHistory(ev);
      const b = scrobbleBody(ev); if (!b || !ev.durationMs) return;
      return scrobble('stop', b);
    }
    case 'played': {
      const body = bulk ? bulkBody(ev) : syncBody(ev, true);
      return body && api('POST', '/sync/history', body);
    }
    case 'unplayed': {
      const body = bulk ? bulkBody(ev) : syncBody(ev);
      return body && api('POST', '/sync/history/remove', body);
    }
    case 'watchlisted': { const b = syncBody(ev); return b && api('POST', '/sync/watchlist', b); }
    case 'unwatchlisted': { const b = syncBody(ev); return b && api('POST', '/sync/watchlist/remove', b); }
    case 'dropped': { const b = showOnly(ev); return b && api('POST', '/users/hidden/dropped', b); }
    case 'undropped': { const b = showOnly(ev); return b && api('POST', '/users/hidden/dropped/remove', b); }
    case 'rated': {
      const b = ratingBody(ev); return b && api('POST', '/sync/ratings', b);
    }
    case 'unrated': {
      const b = ratingBody(ev); return b && api('POST', '/sync/ratings/remove', b);
    }
  }
}

async function syncHistory(ev) {
  const b = syncBody(ev, true);
  return b && api('POST', '/sync/history', b);
}

async function scrobble(kind, body) {
  try { return await api('POST', `/scrobble/${kind}`, body); }
  catch (e) { if (e instanceof TraktError && e.status === 409) return; throw e; } // already scrobbled recently
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
  return out;
}


// ---------- browser login (per viewer) ----------
const OOB = REDIRECT_URI.startsWith('urn:');
const pending = new Map();                       // state -> { verifier, viewer, at }
const cleanViewer = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
const AIO_URL = (process.env.AIOSTREAMS_URL || '').replace(/\/$/, '');
let usersCache = { at: 0, list: null };

// The users of the AIOStreams configuration: the owner (viewer '') plus each household user (viewer = persona id).
async function aioUsers() {
  if (usersCache.list && Date.now() - usersCache.at < 30000) return usersCache.list;
  const { AIOSTREAMS_UUID: uuid, AIOSTREAMS_PASSWORD: pw } = process.env;
  if (!AIO_URL || !uuid || !pw) throw new Error('Set AIOSTREAMS_URL, AIOSTREAMS_UUID and AIOSTREAMS_PASSWORD in .env');
  const res = await fetch(`${AIO_URL}/api/v1/user`, { headers: { Authorization: 'Basic ' + Buffer.from(`${uuid}:${pw}`).toString('base64') } });
  if (!res.ok) throw new Error(`AIOStreams user lookup failed (${res.status})`);
  const j = (await res.json()).data?.userData?.jellyfin || {};
  const list = [{ id: '', name: j.primary?.name || 'Primary user', owner: true }];
  for (const p of j.personas || []) list.push({ id: p.id, name: p.name, shared: p.history === 'shared' });
  usersCache = { at: Date.now(), list };
  return list;
}

async function authIndex() {
  const users = await aioUsers();
  const states = viewerStates();
  const rows = users.map((u) => {
    const href = u.owner ? '?owner=1' : `?viewer=${encodeURIComponent(u.id)}`;
    const st = states[u.id];
    const sub = u.owner ? 'Primary user' : u.shared ? "Shares the primary user's history" : 'Household user';
    return `<div class=user><div class=av>${esc((u.name || '?').slice(0, 1).toUpperCase())}</div>
<div class=who><b title="${esc(u.name)}">${esc(u.name)}</b><span>${sub}</span></div>
${st === 'ok'
  ? `<form method=post style="margin:0"><input type=hidden name=disconnect value="${esc(u.id)}"><button class="ghost">Disconnect</button></form>`
  : `<a class=btn href="${href}">${st === 'reauth' ? 'Reconnect' : 'Connect'}</a>`}</div>`;
  }).join('');
  return page(`<h1>AIOStreams users</h1><p class=sub>Connect each AIOStreams user to their Trakt account.</p><div class=card>${rows}</div>`);
}

async function authPage(url) {
  if (!url.searchParams.has('viewer') && !url.searchParams.has('owner')) return authIndex();
  const viewer = url.searchParams.has('owner') ? '' : cleanViewer(url.searchParams.get('viewer'));
  const user = (await aioUsers()).find((u) => u.id === viewer);
  if (!user) return msg('err', 'Unknown user', 'That user does not exist in AIOStreams.');
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
</ol></div><footer><a class="btn ghost" href="?">Back</a></footer>`);
}

async function authSubmit(raw) {
  const f = new URLSearchParams(raw);
  if (f.has('disconnect')) {
    const v = cleanViewer(f.get('disconnect'));
    if (!knownViewers().includes(v)) return msg('err', 'Not connected', 'That user has no Trakt account linked.');
    deleteTokens(v);
    return msg('good', 'Disconnected', 'The Trakt account was unlinked. You can connect it again from the list.');
  }
  let input = (f.get('url') || '').trim(), code = input, state = f.get('state');
  if (input.includes('code=')) { const u = new URL(input); code = u.searchParams.get('code'); state = u.searchParams.get('state') || state; }
  const p = pending.get(state);
  if (!p || !code) return msg('err', 'Expired or invalid', 'Start again from the list.');
  pending.delete(state);
  await exchangeCode(code, p.verifier, p.viewer);
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
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(about()); }
    const isAuth = url.pathname === '/auth';            // short address, no secret (meant for a private network / VPN)
    if (!isAuth && SECRET && !(url.pathname.startsWith(PREFIX + '/') && safeEq(url.pathname.split('/')[1], SECRET))) return send(res, 404, { error: 'not found' });
    const p = isAuth ? '/auth' : url.pathname.slice(PREFIX.length);
    const viewer = cleanViewer(url.searchParams.get('viewer'));
    console.log(req.method, p, viewer ? `viewer=${viewer}` : '');

    if (p === '/auth') {
      const html = (code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); };
      if (!adminOk(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Traktor"', 'Content-Type': 'text/plain' }); return res.end('Password required'); }
      if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return html(403, msg('err', 'Blocked', 'Cross-site request refused.'));
      if (!CLIENT_ID) return html(500, msg('err', 'Not configured', 'TRAKT_CLIENT_ID is not set.'));
      try {
        if (req.method === 'GET') return html(200, await authPage(url));
        if (req.method === 'POST') {
          return html(200, await authSubmit(await readBody(req, 20_000)));
        }
      } catch (e) { return html(400, msg('err', 'Something went wrong', esc(e.message).slice(0, 300))); }
    }
    return await viewerContext.run({ viewer }, () => route(req, res, url, p));
  } catch (e) { return fail(res, e); }
});
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.listen(PORT, '0.0.0.0', () => console.log(`traktor on :${PORT}`));

async function route(req, res, url, p) {
  try {

    if (req.method === 'GET' && p === '/manifest.json') {
      const proto = req.headers['x-forwarded-proto'] || 'http';
      return send(res, 200, { ...manifest, logo: `${proto}://${req.headers.host}/logo.svg` });
    }

    if (req.method === 'GET' && p === '/watch_state/pull.json') {
      const since = url.searchParams.get('since') || '';
      return send(res, 200, await handlePull(since));
    }

    if (req.method === 'POST' && p.startsWith('/watch_state/push/')) {
      const ev = JSON.parse(await readBody(req));
      await handlePush(ev);
      console.log(`push ${ev.event} ${ev.scope || ''} ${ev.metaId || ''} ${ev.videoId || ''}`);
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { return fail(res, e); }
}

function fail(res, e) {
  console.error(e.message);
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

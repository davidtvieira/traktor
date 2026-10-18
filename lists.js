// Trakt lists as catalogs for a connected user: personal lists, favorites, and Trakt's public charts.
// The watchlist is not offered here: AIOStreams already shows it as the user's favourites.
import { api, getPicks } from './trakt.js';

const TTL = 5 * 60 * 1000;
const PAGE = 100;                 // items per catalog page (Stremio's skip steps)
const FETCH_LIMIT = 1000;         // items read from Trakt for lists that are not paged
const cache = new Map();          // viewer:path -> { at, data }, never shared between users

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await fn();
  cache.delete(key); cache.set(key, { at: Date.now(), data });
  while (cache.size > 300) cache.delete(cache.keys().next().value);
  return data;
}

const poster = (imdb) => `https://images.metahub.space/poster/small/${imdb}/img`;
const toMeta = (o, type) => (o?.ids?.imdb
  ? { id: o.ids.imdb, type, name: o.title, releaseInfo: o.year ? String(o.year) : undefined, poster: poster(o.ids.imdb) }
  : null);

const BOTH = ['movie', 'series'];
// kind is 'movie' or 'show'. A paged chart reads one page of PAGE items; the rest read up to FETCH_LIMIT.
const chart = (id, name, pathOf, extra = {}) => ({ id, group: 'Discover', name, types: BOTH, paged: true, path: (kind, page) => `${pathOf(kind)}?limit=${PAGE}&page=${page}`, ...extra });
const ACCOUNT = [
  { id: 'recommended', group: 'Your account', name: 'Recommended', types: BOTH, defaultOn: true, path: (k) => `/recommendations/${k}s?limit=100&ignore_watchlisted=true` },
  { id: 'favorites', group: 'Your account', name: 'Favorites', types: BOTH, path: (k) => `/sync/favorites/${k}s?limit=${FETCH_LIMIT}` },
  { id: 'collection', group: 'Your account', name: 'Collection', types: BOTH, path: (k) => `/sync/collection/${k}s` },
];
const DISCOVER = [
  chart('trending', 'Trending', (k) => `/${k}s/trending`),
  chart('popular', 'Popular', (k) => `/${k}s/popular`),
  chart('anticipated', 'Anticipated', (k) => `/${k}s/anticipated`),
  chart('watched', 'Most watched this week', (k) => `/${k}s/watched/weekly`),
  chart('played', 'Most played this week', (k) => `/${k}s/played/weekly`),
  chart('collected', 'Most collected this week', (k) => `/${k}s/collected/weekly`),
  chart('favorited', 'Most favorited this week', (k) => `/${k}s/favorited/weekly`),
  { id: 'boxoffice', group: 'Discover', name: 'Box office', types: ['movie'], path: () => '/movies/boxoffice' },
];

// Every list the user can tick, in the order they appear.
export async function availableLists(viewer, fresh = false) {
  if (fresh) for (const k of ['lists', 'smart', 'liked']) cache.delete(`${viewer}:${k}`);
  const [lists, smart, liked] = await Promise.all([
    cached(`${viewer}:lists`, () => api('GET', '/users/me/lists')),
    cached(`${viewer}:smart`, () => api('GET', '/users/me/smart-lists').catch(() => [])),      // smart lists are optional
    cached(`${viewer}:liked`, () => api('GET', '/users/likes/lists?limit=100').catch(() => [])),
  ]);
  return [
    ...ACCOUNT,
    ...(lists || []).map((l) => ({ id: String(l.ids.trakt), group: 'Your lists', name: l.name, types: BOTH, defaultOn: true, path: (k) => `/users/me/lists/${l.ids.trakt}/items/${k}?limit=${FETCH_LIMIT}` })),
    ...(smart || []).map((l) => ({ id: `smart-${l.ids.trakt}`, group: 'Smart lists', name: l.name, types: BOTH, defaultOn: true, path: (k) => `/smart-lists/${l.ids.trakt}/items/${k}s/rank/asc?limit=${FETCH_LIMIT}` })),
    ...(liked || []).filter((x) => x.list?.ids?.trakt).map((x) => ({ id: `liked-${x.list.ids.trakt}`, group: 'Liked lists', name: x.list.name, types: BOTH, path: (k) => `/lists/${x.list.ids.trakt}/items/${k}?limit=${FETCH_LIMIT}` })),
    ...DISCOVER,
  ];
}

// The lists that were ticked. Nothing saved yet means the default set (your account and your own lists).
async function selected(viewer) {
  const all = await availableLists(viewer);
  const picks = getPicks(viewer);
  if (!picks) return all.filter((l) => l.defaultOn);
  const byId = new Map(all.map((l) => [l.id, l]));
  return picks.map((id) => byId.get(id)).filter(Boolean);       // the order the user saved
}

// Titles of one list for one type, as catalog entries. skip/PAGE slice the result.
async function fetchMetas(viewer, entry, type, skip = 0) {
  const kind = type === 'movie' ? 'movie' : 'show';
  const page = entry.paged ? Math.floor(skip / PAGE) + 1 : 1;
  const path = entry.path(kind, page);
  const items = await cached(`${viewer}:${path}`, () => api('GET', path));
  const metas = (items || []).map((i) => toMeta(i[kind] ?? i, type)).filter(Boolean);
  return entry.paged ? metas.slice(skip - (page - 1) * PAGE) : metas.slice(skip, skip + PAGE);
}

// A catalog's id is its list's id, so a cached manifest can never point a name at a different list.
// A personal list only gets a movie or series catalog when it has titles of that type (charts always have both).
export async function listsManifest(viewer, logo) {
  const entries = await selected(viewer);
  const catalogs = (await Promise.all(entries.map(async (e) => {
    const types = e.paged ? e.types : (await Promise.all(e.types.map(async (type) => {
      try { return (await fetchMetas(viewer, e, type)).length ? type : null; }
      catch { return type; }                           // could not check: keep it rather than hide it
    }))).filter(Boolean);
    return types.map((type) => ({ type, id: e.id, name: e.name, extra: [{ name: 'skip' }] }));
  }))).flat();
  return {
    id: `com.local.traktor.lists.${viewer || 'primary'}`,
    version: '1.0.0',
    name: 'Traktor Lists',
    description: 'Your Trakt lists and charts',
    logo,
    resources: ['catalog'],
    types: BOTH,
    catalogs,
  };
}

// A list that is not ticked (or unknown) answers with no titles.
export async function catalogMetas(viewer, type, id, skip = 0) {
  const entry = (await selected(viewer)).find((e) => e.id === id);
  if (!entry || !entry.types.includes(type)) return [];
  return fetchMetas(viewer, entry, type, skip);
}

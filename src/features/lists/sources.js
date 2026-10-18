// Every list a user can tick: their account and their own / smart / liked lists. The public charts are set once for everyone.
// The watchlist is not offered here: AIOStreams already shows it as the user's favourites.
import { api } from '../../trakt/client.js';
import { getSharedPicks } from '../../storage/shared-store.js';
import { cached, forget } from './cache.js';

export const PAGE = 100;                 // items per catalog page (Stremio's skip steps)
const FETCH_LIMIT = 1000;                // items read from Trakt for lists that are not paged
const BOTH = ['movie', 'series'];

// kind is 'movie' or 'show'. A paged chart reads one page of PAGE items; the rest read up to FETCH_LIMIT.
const chart = (id, name, pathOf, extra = {}) => ({ id, group: 'Discover', name, types: BOTH, paged: true, public: true, path: (kind, page) => `${pathOf(kind)}?limit=${PAGE}&page=${page}`, ...extra });

const ACCOUNT = [
  { id: 'recommended', group: 'Your account', name: 'Recommended', types: BOTH, defaultOn: true, path: (k) => `/recommendations/${k}s?limit=100&ignore_watchlisted=true` },
  { id: 'favorites', group: 'Your account', name: 'Favorites', types: BOTH, path: (k) => `/sync/favorites/${k}s?limit=${FETCH_LIMIT}` },
  { id: 'collection', group: 'Your account', name: 'Collection', types: BOTH, path: (k) => `/sync/collection/${k}s` },
];
// The charts need no Trakt login, so they can be shown to everyone.
export const DISCOVER = [
  chart('trending', 'Trending', (k) => `/${k}s/trending`),
  chart('popular', 'Popular', (k) => `/${k}s/popular`),
  chart('anticipated', 'Anticipated', (k) => `/${k}s/anticipated`),
  chart('watched', 'Most watched this week', (k) => `/${k}s/watched/weekly`),
  chart('played', 'Most played this week', (k) => `/${k}s/played/weekly`),
  chart('collected', 'Most collected this week', (k) => `/${k}s/collected/weekly`),
  chart('favorited', 'Most favorited this week', (k) => `/${k}s/favorited/weekly`),
  { id: 'boxoffice', group: 'Discover', name: 'Box office', types: ['movie'], public: true, path: () => '/movies/boxoffice' },
];

// Every list the user can tick, in the order they appear.
export async function availableLists(viewer, fresh = false) {
  if (fresh) for (const k of ['lists', 'smart', 'liked']) forget(`${viewer}:${k}`);
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
  ];
}

// The lists that are shown: what the user saved (in that order), or the default set (account and own lists) before the first save.
export function chosenLists(avail, picks) {
  if (!picks) return avail.filter((l) => l.defaultOn);
  const byId = new Map(avail.map((l) => [l.id, l]));
  return picks.map((id) => byId.get(id)).filter(Boolean);
}

// The charts shown to every user, in the order set for Everyone.
export const sharedLists = () => chosenLists(DISCOVER, getSharedPicks());

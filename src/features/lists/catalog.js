// Trakt lists as Stremio catalogs: a connected user's own, plus the charts shown to everyone.
import { api, apiPublic } from '../../trakt/client.js';
import { getOptOut, getPicks, getSorts } from '../../storage/user-store.js';
import { cached } from './cache.js';
import { enrich } from './enrich.js';
import { toMeta } from './meta.js';
import { PAGE, availableLists, chosenLists, sharedLists } from './sources.js';
import { needsFull, sortItems } from './sort.js';

const BOTH = ['movie', 'series'];

// The user's ticked lists, then the charts shown to everyone (minus the ones this user turned off or already ticked).
async function selected(viewer) {
  const sorts = getSorts(viewer);
  const own = chosenLists(await availableLists(viewer), getPicks(viewer)).map((l) => (sorts[l.id] ? { ...l, sort: sorts[l.id] } : l));
  const skip = new Set([...own.map((l) => l.id), ...getOptOut(viewer)]);
  return [...own, ...sharedLists().filter((l) => !skip.has(l.id))];
}

const withFull = (path) => `${path}${path.includes('?') ? '&' : '?'}extended=full`;

// Titles of one list for one type, as catalog entries. skip/PAGE slice the result. A sorted list is read in full and sorted here.
async function fetchMetas(viewer, entry, type, skip = 0) {
  const kind = type === 'movie' ? 'movie' : 'show';
  const page = entry.paged ? Math.floor(skip / PAGE) + 1 : 1;
  const path = needsFull(entry.sort) ? withFull(entry.path(kind, page)) : entry.path(kind, page);
  const items = await (entry.public ? cached(`public:${path}`, () => apiPublic(path)) : cached(`${viewer}:${path}`, () => api('GET', path)));
  const metas = sortItems(entry.arrange ? entry.arrange(items || []) : items || [], entry.sort, kind).map((i) => toMeta(i[kind] ?? i, type)).filter(Boolean);
  return entry.paged ? metas.slice(skip - (page - 1) * PAGE) : metas.slice(skip, skip + PAGE);
}

// A catalog's id is its list's id, so a cached manifest can never point a name at a different list.
// A personal list only gets a movie or series catalog when it has titles of that type (charts always have both).
async function manifestOf(viewer, entries, id, description, logo) {
  const catalogs = (await Promise.all(entries.map(async (e) => {
    const types = e.paged ? e.types : (await Promise.all(e.types.map(async (type) => {
      try { return (await fetchMetas(viewer, e, type)).length ? type : null; }
      catch { return type; }                           // could not check: keep it rather than hide it
    }))).filter(Boolean);
    return types.map((type) => ({ type, id: e.id, name: e.name, extra: [{ name: 'skip' }] }));
  }))).flat();
  return { id, version: '1.0.0', name: 'Traktor Lists', description, logo, resources: ['catalog'], types: BOTH, catalogs };
}

export async function listsManifest(viewer, logo) {
  return manifestOf(viewer, await selected(viewer), `com.local.traktor.lists.${viewer || 'primary'}`, 'Your Trakt lists and charts', logo);
}
// For users with no Trakt account: only the charts shown to everyone.
export const sharedManifest = (logo) => manifestOf(null, sharedLists(), 'com.local.traktor.lists.public', 'Trakt charts', logo);

const pick = (entries, type, id) => {
  const entry = entries.find((e) => e.id === id);
  return entry && entry.types.includes(type) ? entry : null;
};

// A list that is not ticked (or unknown) answers with no titles.
export async function catalogMetas(viewer, type, id, skip = 0) {
  const entry = pick(await selected(viewer), type, id);
  return entry ? enrich(await fetchMetas(viewer, entry, type, skip), type) : [];
}
export async function sharedCatalogMetas(type, id, skip = 0) {
  const entry = pick(sharedLists(), type, id);
  return entry ? enrich(await fetchMetas(null, entry, type, skip), type) : [];
}

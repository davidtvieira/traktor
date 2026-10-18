// Trakt lists as Stremio catalogs for a connected user.
import { api } from '../../trakt/client.js';
import { getPicks } from '../../storage/user-store.js';
import { cached } from './cache.js';
import { toMeta } from './meta.js';
import { PAGE, availableLists, chosenLists } from './sources.js';

const BOTH = ['movie', 'series'];

const selected = async (viewer) => chosenLists(await availableLists(viewer), getPicks(viewer));

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

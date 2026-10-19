// Sorting a list's titles. Only lists that are read whole can be sorted: the charts keep Trakt's ranking.
export const SORTS = {
  trakt: 'Trakt order',
  'title:asc': 'Title A to Z',
  'title:desc': 'Title Z to A',
  'rating:desc': 'Rating, highest first',
  'rating:asc': 'Rating, lowest first',
  'year:desc': 'Release, newest first',
  'year:asc': 'Release, oldest first',
  'added:desc': 'Added, newest first',
  'added:asc': 'Added, oldest first',
};
export const sortKey = (x) => (x && x !== 'trakt' && SORTS[x] ? x : null);

// What each sort compares. A title missing the value goes last, whichever way the sort runs.
const VALUE = {
  title: (_, o) => o.title,
  rating: (_, o) => o.rating,
  year: (_, o) => o.released || o.first_aired || (o.year ? String(o.year) : null),
  added: (i) => i.listed_at || i.collected_at || i.last_collected_at || null,
};
const missing = (v) => v === undefined || v === null || v === '';

// Trakt only sends ratings and dates when asked for the full details.
export const needsFull = (key) => Boolean(sortKey(key)) && !key.startsWith('title');

// items: Trakt's list entries, each a title or a wrapper with the title under `kind`.
export function sortItems(items, key, kind) {
  if (!sortKey(key)) return items;
  const [by, dir] = key.split(':');
  const get = VALUE[by], sign = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const x = get(a, a[kind] ?? a), y = get(b, b[kind] ?? b);
    if (missing(x) || missing(y)) return missing(x) - missing(y);
    return sign * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true }));
  });
}

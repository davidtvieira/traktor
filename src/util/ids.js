// Identifiers and scopes shared by the push, pull and lists code.
export function traktIds(ids = {}) {
  const o = {};
  if (ids.imdb) o.imdb = ids.imdb;
  if (ids.tmdb) o.tmdb = Number(ids.tmdb);
  if (ids.tvdb) o.tvdb = Number(ids.tvdb);
  if (ids.trakt) o.trakt = Number(ids.trakt);
  return o;
}
export const hasIds = (ids) => Object.keys(ids).length > 0;
export const imdbOf = (x) => x?.ids?.imdb || null;
// A push event is for a movie when it says so, or says nothing and has no season.
export const isMovie = (ev) => ev.scope === 'movie' || (!ev.scope && !ev.season);
// Viewer ids come from the query string: keep them to a short, safe alphabet.
export const cleanViewer = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);

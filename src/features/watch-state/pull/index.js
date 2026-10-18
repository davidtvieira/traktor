// Pull: AIOStreams asks what a user has watched; Traktor answers from Trakt.
import crypto from 'node:crypto';
import { api } from '../../../trakt/client.js';
import { mapLimit } from '../../../util/concurrency.js';
import { imdbOf } from '../../../util/ids.js';
import { log } from '../../../util/log.js';
import { touchActivity } from '../../activity/store.js';
import { showProgress, saveProgressCache } from './progress-cache.js';
import { playbackItems, watchedMovies, watchedShows, droppedShows, watchlistItems, ratingItems } from './mappers.js';

const LIMIT = 10000;
const PROGRESS_CONCURRENCY = 4;

export async function handlePull(since) {
  touchActivity();
  const act = await api('GET', '/sync/last_activities');
  const version = crypto.createHash('sha1').update(JSON.stringify(act)).digest('hex').slice(0, 16);

  const out = { version, items: playbackItems(await api('GET', '/sync/playback')) };
  if (since === version) return out;               // gate: nothing changed in the watched/list half

  const [wm, ws, wl, rt, dr] = await Promise.all([
    api('GET', `/sync/watched/movies?limit=${LIMIT}`),
    api('GET', `/sync/watched/shows?limit=${LIMIT}`),
    api('GET', `/sync/watchlist?limit=${LIMIT}`),
    api('GET', `/sync/ratings?limit=${LIMIT}`),
    api('GET', `/users/hidden/dropped?type=show&limit=${LIMIT}`).catch((e) => { console.warn('dropped list unavailable:', e.message); return null; }),
  ]);

  const movies = watchedMovies(wm);
  const shows = (ws || []).filter((s) => imdbOf(s.show));
  const progress = await mapLimit(shows, PROGRESS_CONCURRENCY, showProgress);
  const { episodes, counts, nextUp } = watchedShows(shows, progress);
  saveProgressCache();

  out.watched = { movies, episodes, counts, nextUp };
  if (dr) out.watched.dropped = droppedShows(dr);
  out.watchlist = watchlistItems(wl);
  out.ratings = ratingItems(rt);
  log(`pull -> ${episodes.length} watched episodes, ${movies.length} movies, ${out.items.length} in progress, ${out.watchlist.length} watchlisted`);
  return out;
}

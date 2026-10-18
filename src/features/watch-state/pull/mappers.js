// Pure mappers: Trakt answers in, the shapes AIOStreams' watch_state pull expects out.
import { imdbOf } from '../../../util/ids.js';
import { epochSeconds } from '../../../util/time.js';

// Paused plays (/sync/playback) -> items in progress.
export function playbackItems(playback) {
  const items = [];
  for (const p of playback || []) {
    const at = epochSeconds(p.paused_at);
    if (p.type === 'movie' && imdbOf(p.movie)) {
      const id = imdbOf(p.movie);
      items.push({ type: 'movie', metaId: id, videoId: id, progressPercent: p.progress, played: false, at });
    } else if (p.type === 'episode' && imdbOf(p.show)) {
      const id = imdbOf(p.show);
      items.push({ type: 'series', metaId: id, videoId: `${id}:${p.episode.season}:${p.episode.number}`,
        season: p.episode.season, episode: p.episode.number, progressPercent: p.progress, played: false, at });
    }
  }
  return items;
}

export const watchedMovies = (wm) => (wm || []).map((m) => imdbOf(m.movie)).filter(Boolean);

// Watched shows with their progress -> watched episodes, per-show counts and next-up entries.
// `shows` and `progress` line up by index; a show without progress is skipped.
export function watchedShows(shows, progress) {
  const episodes = [], nextUp = [], counts = {};
  shows.forEach((s, i) => {
    const id = imdbOf(s.show); const pr = progress[i]; if (!pr) return;
    for (const [sn, en] of pr.done) episodes.push(`${id}:${sn}:${en}`);
    counts[id] = { watched: pr.completed, total: pr.aired };
    const le = pr.last;
    if (le) nextUp.push({ type: 'series', metaId: id, videoId: `${id}:${le.season}:${le.number}`,
      season: le.season, episode: le.number, at: epochSeconds(s.last_watched_at) });
  });
  return { episodes, counts, nextUp };
}

export const droppedShows = (dr) => dr.map((d) => imdbOf(d.show)).filter(Boolean);

export const watchlistItems = (wl) => (wl || []).flatMap((w) => {
  const o = w.movie || w.show; const id = imdbOf(o);
  return id ? [{ type: w.movie ? 'movie' : 'series', metaId: id, at: epochSeconds(w.listed_at) }] : [];
});

export const ratingItems = (rt) => (rt || []).flatMap((r) => {
  const at = epochSeconds(r.rated_at);
  if (r.type === 'movie' && imdbOf(r.movie)) return [{ type: 'movie', metaId: imdbOf(r.movie), rating: r.rating, at }];
  if (r.type === 'show' && imdbOf(r.show)) return [{ type: 'series', metaId: imdbOf(r.show), rating: r.rating, at }];
  if (r.type === 'season' && imdbOf(r.show)) return [{ type: 'series', metaId: imdbOf(r.show), season: r.season.number, rating: r.rating, at }];
  if (r.type === 'episode' && imdbOf(r.show)) {
    const id = imdbOf(r.show);
    return [{ type: 'series', metaId: id, videoId: `${id}:${r.episode.season}:${r.episode.number}`, rating: r.rating, at }];
  }
  return [];
});

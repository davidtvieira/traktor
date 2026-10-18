import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackItems, watchedShows, watchlistItems, ratingItems, droppedShows } from '../../src/features/watch-state/pull/mappers.js';

const show = (imdb) => ({ ids: { imdb } });

test('playback becomes movie and episode items, titles without IMDb ids are skipped', () => {
  const items = playbackItems([
    { type: 'movie', movie: show('tt1'), progress: 40, paused_at: '2026-01-01T00:00:00Z' },
    { type: 'episode', show: show('tt2'), episode: { season: 3, number: 4 }, progress: 10, paused_at: '2026-01-01T00:00:00Z' },
    { type: 'movie', movie: { ids: {} }, progress: 1, paused_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.deepEqual(items.map((i) => i.videoId), ['tt1', 'tt2:3:4']);
  assert.equal(items[0].at, 1767225600);
});

test('watched shows give episodes, counts and next-up', () => {
  const shows = [{ show: show('tt9'), last_watched_at: '2026-01-01T00:00:00Z' }, { show: show('tt8') }];
  const r = watchedShows(shows, [{ done: [[1, 1], [1, 2]], completed: 2, aired: 10, last: { season: 1, number: 2 } }, null]);
  assert.deepEqual(r.episodes, ['tt9:1:1', 'tt9:1:2']);
  assert.deepEqual(r.counts, { tt9: { watched: 2, total: 10 } });
  assert.equal(r.nextUp[0].videoId, 'tt9:1:2');
});

test('watchlist, ratings and drops', () => {
  assert.deepEqual(watchlistItems([{ movie: show('tt1'), listed_at: '1970-01-01T00:01:00Z' }, { show: show('tt2'), listed_at: '1970-01-01T00:02:00Z' }, { movie: { ids: {} } }]).map((w) => [w.type, w.metaId, w.at]),
    [['movie', 'tt1', 60], ['series', 'tt2', 120]]);
  const r = ratingItems([
    { type: 'show', show: show('tt2'), rating: 8, rated_at: '1970-01-01T00:00:00Z' },
    { type: 'season', show: show('tt2'), season: { number: 2 }, rating: 7, rated_at: '1970-01-01T00:00:00Z' },
    { type: 'episode', show: show('tt2'), episode: { season: 1, number: 3 }, rating: 9, rated_at: '1970-01-01T00:00:00Z' },
  ]);
  assert.deepEqual(r.map((x) => x.videoId ?? x.season ?? x.metaId), ['tt2', 2, 'tt2:1:3']);
  assert.deepEqual(droppedShows([{ show: show('tt5') }, { show: { ids: {} } }]), ['tt5']);
});

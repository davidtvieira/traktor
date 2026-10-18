import test from 'node:test';
import assert from 'node:assert/strict';
import { syncBody, bulkBody, scrobbleBody, ratingBody, showOnlyBody } from '../../src/features/watch-state/push/bodies.js';
import { absoluteIndex } from '../../src/features/watch-state/push/numbering.js';
import { outcome, what, labelOf } from '../../src/features/watch-state/push/log-format.js';

const ids = { imdb: 'tt1', tmdb: '5' };

test('sync bodies per scope; no ids means no body', () => {
  assert.deepEqual(syncBody({ ids, scope: 'movie' }), { movies: [{ ids: { imdb: 'tt1', tmdb: 5 } }] });
  assert.deepEqual(syncBody({ ids, scope: 'series' }), { shows: [{ ids: { imdb: 'tt1', tmdb: 5 } }] });
  assert.deepEqual(syncBody({ ids, scope: 'season', season: 2 }).shows[0].seasons, [{ number: 2 }]);
  const ep = syncBody({ ids, scope: 'episode', season: 2, episode: 3, at: 0 }, true);
  assert.deepEqual(ep.shows[0].seasons[0].episodes, [{ number: 3, watched_at: '1970-01-01T00:00:00.000Z' }]);
  assert.equal(syncBody({ ids: {}, scope: 'movie' }), null);
});

test('bulk body groups videos by season and skips unnumbered ones', () => {
  const b = bulkBody({ ids, at: 0, videos: [{ season: 1, episode: 1 }, { season: 1, episode: 2 }, { season: 2, episode: 1 }, { season: null, episode: 4 }] });
  assert.deepEqual(b.shows[0].seasons.map((s) => [s.number, s.episodes.length]), [[1, 2], [2, 1]]);
  assert.equal(bulkBody({ ids, videos: [] }), null);
});

test('scrobble progress is clamped, and an unplayed stop never reaches the 80% watched mark', () => {
  assert.equal(scrobbleBody({ ids, event: 'start', scope: 'movie', positionMs: 50, durationMs: 100 }).progress, 50);
  assert.equal(scrobbleBody({ ids, event: 'stop', scope: 'movie', positionMs: 99, durationMs: 100, played: false }).progress, 79);
  assert.equal(scrobbleBody({ ids, event: 'stop', scope: 'movie', positionMs: 99, durationMs: 100, played: true }).progress, 99);
  assert.equal(scrobbleBody({ ids, event: 'start', scope: 'movie', positionMs: 500, durationMs: 100 }).progress, 100);
  assert.deepEqual(scrobbleBody({ ids, event: 'start', season: 1, episode: 2, positionMs: 0, durationMs: 1 }).episode, { season: 1, number: 2 });
});

test('rating body clamps to 1-10 and unrating sends no rating', () => {
  assert.equal(ratingBody({ ids, scope: 'movie', rating: 14, at: 0 }).movies[0].rating, 10);
  assert.equal(ratingBody({ ids, scope: 'movie', rating: 0.2, at: 0 }).movies[0].rating, 1);
  assert.deepEqual(ratingBody({ ids, scope: 'series' }).shows[0], { ids: { imdb: 'tt1', tmdb: 5 } });
  assert.equal(ratingBody({ ids }), null);
  assert.equal(showOnlyBody({ ids: {} }), null);
});

test('absolute numbers map to Trakt seasons, specials ignored', () => {
  const idx = absoluteIndex([{ number: 0, episodes: [{ number: 1, number_abs: 9 }] }, { number: 23, episodes: [{ number: 5, number_abs: 1180 }] }]);
  assert.deepEqual(idx.get(1180), { season: 23, episode: 5 });
  assert.equal(idx.has(9), false);
});

test('log wording', () => {
  assert.equal(what({ ids, scope: 'episode', season: 1, episode: 2 }), 'tt1 S01E02');
  assert.equal(labelOf({ event: 'stop', played: true }).trim(), 'watched');
  assert.equal(outcome({ added: { movies: 1, episodes: 0 } }), 'added movies=1');
  assert.equal(outcome({ duplicate: true }), 'already scrobbled (409)');
  assert.equal(outcome({ action: 'scrobble', progress: 50.04 }), 'ok, Trakt saved: scrobble at 50%');
});

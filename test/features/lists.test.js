import test from 'node:test';
import assert from 'node:assert/strict';
import { toMeta } from '../../src/features/lists/meta.js';
import { chosenLists } from '../../src/features/lists/sources.js';
import { cached } from '../../src/features/lists/cache.js';

test('meta needs an IMDb id and carries artwork', () => {
  assert.equal(toMeta({ title: 'x', ids: {} }, 'movie'), null);
  const m = toMeta({ title: 'Heat', year: 1995, ids: { imdb: 'tt0113277' } }, 'movie');
  assert.equal(m.id, 'tt0113277');
  assert.equal(m.releaseInfo, '1995');
  assert.match(m.poster, /\/poster\/large\/tt0113277\//);
});

test('before a first save the default lists show; after, the saved order', () => {
  const avail = [{ id: 'a', defaultOn: true }, { id: 'b' }, { id: 'c', defaultOn: true }];
  assert.deepEqual(chosenLists(avail, null).map((l) => l.id), ['a', 'c']);
  assert.deepEqual(chosenLists(avail, ['c', 'zzz', 'b']).map((l) => l.id), ['c', 'b']);
  assert.deepEqual(chosenLists(avail, []), []);
});

test('cache answers repeat calls without calling again', async () => {
  let n = 0;
  const f = async () => ++n;
  assert.equal(await cached('u:k', f), 1);
  assert.equal(await cached('u:k', f), 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
process.env.TOKENS_FILE = path.join(dir, 'tokens.json');
const t = await import('../trakt.js');

test('save, load, state and delete per viewer', () => {
  t.saveTokens({ access_token: 'a', refresh_token: 'r', expires_at: 1 }, '');
  t.saveTokens({ access_token: 'b', refresh_token: 's', expires_at: 1, reauth: true }, 'kid');
  assert.equal(t.loadTokens('').access_token, 'a');
  assert.deepEqual(t.viewerStates(), { '': 'ok', kid: 'reauth' });
  t.deleteTokens('kid');
  assert.deepEqual(t.knownViewers(), ['']);
});

test('atomic write leaves no temp file and keeps owner-only mode', () => {
  t.saveTokens({ access_token: 'c', refresh_token: 'r', expires_at: 1 }, '');
  assert.deepEqual(fs.readdirSync(dir), ['tokens.json']);
  assert.equal(fs.statSync(process.env.TOKENS_FILE).mode & 0o777, 0o600);
});

test('lists key is stable and found by key; picks survive and default to null', () => {
  t.saveTokens({ access_token: 'a', refresh_token: 'r', expires_at: 1 }, '');
  const k = t.catalogKey('');
  assert.match(k, /^[a-f0-9]{32}$/);
  assert.equal(t.catalogKey(''), k);
  assert.equal(t.viewerByKey(k), '');
  assert.equal(t.viewerByKey('0'.repeat(32)), null);
  assert.equal(t.getPicks(''), null);
  t.setPicks('', ['watchlist', '123']);
  assert.deepEqual(t.getPicks(''), ['watchlist', '123']);
});

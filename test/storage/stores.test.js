import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
process.env.TOKENS_FILE = path.join(dir, 'tokens.json');
const tokens = await import('../../src/storage/token-store.js');
const users = await import('../../src/storage/user-store.js');
test('save, load, state and delete per viewer', () => {
  tokens.saveTokens({ access_token: 'a', refresh_token: 'r', expires_at: 1 }, '');
  tokens.saveTokens({ access_token: 'b', refresh_token: 's', expires_at: 1, reauth: true }, 'kid');
  assert.equal(tokens.loadTokens('').access_token, 'a');
  assert.deepEqual(tokens.viewerStates(), { '': 'ok', kid: 'reauth' });
  tokens.deleteTokens('kid');
  assert.deepEqual(tokens.knownViewers(), ['']);
});

test('atomic write leaves no temp file and keeps owner-only mode', () => {
  tokens.saveTokens({ access_token: 'c', refresh_token: 'r', expires_at: 1 }, '');
  assert.deepEqual(fs.readdirSync(dir), ['tokens.json']);
  assert.equal(fs.statSync(process.env.TOKENS_FILE).mode & 0o777, 0o600);
});

test('lists key is stable and found by key; picks survive and default to null', () => {
  tokens.saveTokens({ access_token: 'a', refresh_token: 'r', expires_at: 1 }, '');
  const k = users.catalogKey('');
  assert.match(k, /^[a-f0-9]{32}$/);
  assert.equal(users.catalogKey(''), k);
  assert.equal(users.viewerByKey(k), '');
  assert.equal(users.viewerByKey('0'.repeat(32)), null);
  assert.equal(users.getPicks(''), null);
  users.setPicks('', ['watchlist', '123']);
  assert.deepEqual(users.getPicks(''), ['watchlist', '123']);
});

test('picks bump rev only when they change, and a new login keeps key and picks', () => {
  tokens.saveTokens({ access_token: 'a', refresh_token: 'r', expires_at: 1 }, 'u');
  users.setPicks('u', ['1', '2']);
  users.setPicks('u', ['1', '2']);
  assert.equal(users.getRev('u'), 1);
  users.setPicks('u', ['2', '1']);
  assert.equal(users.getRev('u'), 2);
  const key = users.catalogKey('u');
  tokens.patchUser('u', { access_token: 'new', reauth: undefined });
  assert.equal(users.catalogKey('u'), key);
  assert.deepEqual(users.getPicks('u'), ['2', '1']);
  assert.equal(tokens.patchUser('ghost', { access_token: 'x' }), null);
});

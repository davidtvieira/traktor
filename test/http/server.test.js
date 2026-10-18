import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
Object.assign(process.env, { TOKENS_FILE: path.join(dir, 'tokens.json'), PORT: '0', TRAKT_CLIENT_ID: 'test' });
const { startServer } = await import('../../src/http/server.js');
const server = startServer();
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

test('health, static assets and public pages', async () => {
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { ok: true });
  const css = await fetch(`${base}/css/app.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  assert.equal((await fetch(`${base}/logo.svg`)).headers.get('content-type'), 'image/svg+xml');
  assert.equal((await fetch(`${base}/js/nope.js`)).status, 404);
  const home = await (await fetch(base)).text();
  assert.match(home, /Configure addon/);
  assert.match(home, /\/css\/app\.css/);
  assert.match(await (await fetch(`${base}/help`)).text(), /<h1>Help<\/h1>/);
});

test('the manifest advertises watch state', async () => {
  const m = await (await fetch(`${base}/manifest.json`)).json();
  assert.equal(m.id, 'com.local.trakt-watchstate');
  assert.equal(m.watchState.version, 2);
  assert.ok(m.catalogs.some((c) => c.id === 'trending'), 'the charts for everyone are in the base manifest');
});

test('unknown paths and unknown private addresses are 404, an unconnected viewer is refused', async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/u/${'a'.repeat(32)}/manifest.json`)).status, 404);
  const pull = await fetch(`${base}/watch_state/pull.json?viewer=ghost`);
  assert.equal(pull.status, 404);
});

test('users with no Trakt account get the charts shown to everyone, and only those', async () => {
  const { sharedKey, setSharedPicks, sharedRev } = await import('../../src/storage/shared-store.js');
  const key = sharedKey();
  const ids = async () => [...new Set((await (await fetch(`${base}/u/${key}/manifest.json`)).json()).catalogs.map((c) => c.id))];
  assert.deepEqual(await ids(), ['trending']);
  setSharedPicks(['popular', 'trending']);
  assert.deepEqual(await ids(), ['popular', 'trending']);
  assert.equal(sharedRev(), 1);
  assert.equal((await fetch(`${base}/u/${key}/watch_state/pull.json`)).status, 404);
});

test('a user can turn off a chart shown to everyone, and the address revision moves', async () => {
  const { saveTokens } = await import('../../src/storage/token-store.js');
  const { setPicks, getOptOut, getRev } = await import('../../src/storage/user-store.js');
  saveTokens({ access_token: 'x', expires_at: Date.now() + 1e9 }, 'kid');
  const before = getRev('kid');
  setPicks('kid', [], ['trending']);
  assert.deepEqual(getOptOut('kid'), ['trending']);
  assert.equal(getRev('kid'), before + 1);
  setPicks('kid', [], ['trending']);
  assert.equal(getRev('kid'), before + 1);
});

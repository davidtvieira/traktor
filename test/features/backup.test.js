import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traktor-backup-'));
process.env.TOKENS_FILE = path.join(dir, 'tokens.json');
const { makeBackup, restoreBackup } = await import('../../src/admin/backup.js');
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const users = { '': { access_token: 'a', key: 'k0' }, sofia: { access_token: 'b', key: 'k1', picks: ['trending'] } };

test('a backup restores what it saved, keys included', () => {
  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(users));
  fs.writeFileSync(path.join(dir, 'shared.json'), JSON.stringify({ key: 'sk', picks: ['popular'], rev: 2 }));
  const file = JSON.stringify(makeBackup());
  fs.writeFileSync(path.join(dir, 'tokens.json'), '{}');
  fs.rmSync(path.join(dir, 'shared.json'));
  assert.equal(restoreBackup(file), 2);
  assert.deepEqual(read('tokens.json'), users);
  assert.equal(read('shared.json').key, 'sk');
});

test('the replaced files are kept as .before-restore', () => {
  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify({ x: { access_token: 'old' } }));
  restoreBackup(JSON.stringify({ traktor: 1, tokens: users, shared: {} }));
  assert.equal(read('tokens.json.before-restore').x.access_token, 'old');
});

test('files that are not a backup are refused and nothing is written', () => {
  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(users));
  for (const bad of ['nope', '[]', '{}', JSON.stringify({ traktor: 2, tokens: {}, shared: {} }), JSON.stringify({ traktor: 1, tokens: { a: 'x' }, shared: {} }), JSON.stringify({ traktor: 1, tokens: {} })]) {
    assert.throws(() => restoreBackup(bad));
  }
  assert.deepEqual(read('tokens.json'), users);
});

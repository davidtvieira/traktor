import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.TOKENS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'traktor-activity-')), 'tokens.json');
const { noteSync, touchActivity, getActivity } = await import('../../src/features/activity/store.js');
const { runAs } = await import('../../src/context.js');

test('a failed sync is remembered until the next success', () => {
  runAs('sofia', () => {
    touchActivity();
    noteSync('Trakt GET /sync/playback -> 503');
    assert.equal(getActivity('sofia').error.text, 'Trakt GET /sync/playback -> 503');
    assert.ok(getActivity('sofia').seen);
    noteSync();
    assert.equal(getActivity('sofia').error, undefined);
    assert.ok(getActivity('sofia').seen);
  });
});

test('a success with nothing to clear does not create a record', () => {
  runAs('nobody', () => noteSync());
  assert.equal(getActivity('nobody'), undefined);
});

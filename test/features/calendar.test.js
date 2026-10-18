import test from 'node:test';
import assert from 'node:assert/strict';
import { toEvents } from '../../src/features/calendar/events.js';
import { toIcs } from '../../src/features/calendar/ics.js';

const shows = [{
  first_aired: '2026-10-18T14:30:00.000Z',
  episode: { season: 2, number: 5, title: 'Tea, Cake; and "Lies"', runtime: 45, ids: { trakt: 99 } },
  show: { title: 'Black Clover', ids: { trakt: 7 } },
}];
const movies = [{ released: '2026-12-31', movie: { title: 'New Year', ids: { trakt: 5 } } }];

test('episodes and movies become events', () => {
  const ev = toEvents(shows, movies);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].uid, 'episode-99');
  assert.equal(ev[0].summary, 'Black Clover S02E05');
  assert.equal(ev[0].end - ev[0].start, 45 * 60000);
  assert.equal(ev[1].date, '2026-12-31');
});

test('episodes of a season that air the same day become one event, other days stay apart', () => {
  const ep = (number, at) => ({ first_aired: at, episode: { season: 1, number, title: `T${number}`, ids: { trakt: 100 + number } }, show: { title: 'Drop', runtime: 50, ids: { trakt: 3 } } });
  const ev = toEvents([ep(2, '2026-10-20T07:00:00.000Z'), ep(1, '2026-10-20T07:00:00.000Z'), ep(3, '2026-10-20T09:00:00.000Z'), ep(4, '2026-10-27T07:00:00.000Z')], []);
  assert.equal(ev.length, 2);
  const drop = ev.find((e) => e.uid.startsWith('season-'));
  assert.equal(drop.summary, 'Drop S01 (E01-E03)');
  assert.equal(drop.description, 'E01 T1\nE02 T2\nE03 T3');
  assert.equal(drop.start.toISOString(), '2026-10-20T07:00:00.000Z');
  assert.equal(drop.end - drop.start, 50 * 60000);
  assert.equal(ev.find((e) => !e.uid.startsWith('season-')).summary, 'Drop S01E04');
});

test('entries without a date or ids are skipped', () => {
  assert.deepEqual(toEvents([{ first_aired: null, episode: {}, show: {} }, {}], [{ movie: { title: 'x' } }]), []);
});

test('ics has CRLF lines, escapes text, uses all-day dates for movies', () => {
  const ics = toIcs(toEvents(shows, movies), 'Traktor - A', new Date('2026-10-17T00:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART:20261018T143000Z\r\nDTEND:20261018T151500Z'));
  assert.ok(ics.includes('DESCRIPTION:Tea\\, Cake\\; and "Lies"'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'));
  assert.ok(ics.includes('UID:episode-99@traktor'));
});

test('long lines are folded to 75 octets', () => {
  const ics = toIcs([{ uid: 'x', summary: 'é'.repeat(200), date: '2026-01-01' }], 'n');
  for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75, l.length);
});

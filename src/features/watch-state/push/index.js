// Push: AIOStreams tells Traktor what a user did; Traktor writes it to Trakt.
import { api } from '../../../trakt/client.js';
import { TraktError } from '../../../trakt/errors.js';
import { log } from '../../../util/log.js';
import { touchActivity } from '../../activity/store.js';
import { describe } from '../../activity/describe.js';
import { syncBody, bulkBody, scrobbleBody, showOnlyBody, ratingBody } from './bodies.js';
import { fixNumbering } from './numbering.js';
import { labelOf, percentOf, what, outcome } from './log-format.js';

const SKIPPED = Symbol('skipped');

async function scrobble(kind, body) {
  try { return await api('POST', `/scrobble/${kind}`, body); }
  catch (e) { if (e instanceof TraktError && e.status === 409) return { duplicate: true }; throw e; } // already scrobbled recently
}

const send = (path, body) => (body ? api('POST', path, body) : SKIPPED);

async function sendPush(ev) {
  const bulk = ev.videos && (ev.scope === 'season' || ev.scope === 'series');
  switch (ev.event) {
    case 'start': case 'pause': {
      const b = scrobbleBody(ev);
      return b && ev.durationMs ? scrobble(ev.event, b) : SKIPPED;
    }
    case 'stop': {
      if (ev.played) return send('/sync/history', syncBody(ev, true));
      const b = scrobbleBody(ev);
      return b && ev.durationMs ? scrobble('stop', b) : SKIPPED;
    }
    case 'played': return send('/sync/history', bulk ? bulkBody(ev) : syncBody(ev, true));
    case 'unplayed': return send('/sync/history/remove', bulk ? bulkBody(ev) : syncBody(ev));
    case 'watchlisted': return send('/sync/watchlist', syncBody(ev));
    case 'unwatchlisted': return send('/sync/watchlist/remove', syncBody(ev));
    case 'dropped': return send('/users/hidden/dropped', showOnlyBody(ev));
    case 'undropped': return send('/users/hidden/dropped/remove', showOnlyBody(ev));
    case 'rated': return send('/sync/ratings', ratingBody(ev));
    case 'unrated': return send('/sync/ratings/remove', ratingBody(ev));
  }
  return SKIPPED;
}

export async function handlePush(ev) {
  await fixNumbering(ev);
  const label = labelOf(ev), pct = percentOf(ev);
  try {
    const r = await sendPush(ev);
    log(`${label}${what(ev)}${pct} -> ${r === SKIPPED ? 'skipped (no ids or no duration)' : outcome(r)}`);
    touchActivity(await describe(ev, pct) + (r === SKIPPED ? ' (skipped, no ids)' : ''));
  } catch (e) {
    log(`${label}${what(ev)}${pct} -> FAILED ${e.message}`);
    touchActivity(`${await describe(ev, pct)} (failed)`);
    e.logged = true;
    throw e;
  }
}

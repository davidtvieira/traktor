// A connected user's Trakt calendar (upcoming episodes and movies) as an iCalendar feed to subscribe to from a phone.
import { api } from '../../trakt/client.js';
import { day, toEvents } from './events.js';
import { toIcs } from './ics.js';

const TTL = 60 * 60 * 1000;
const BACK_DAYS = 2;              // a little history, so an episode that aired today or yesterday is still listed
const SPAN_DAYS = 33;             // the longest range Trakt documents for a calendar call
const cache = new Map();          // viewer -> { at, events }, never shared between users

// The .ics text for one user. Call it inside that user's viewerContext (api() reads the current user).
export async function calendarIcs(viewer, name = 'Traktor') {
  let hit = cache.get(viewer);
  if (!hit || Date.now() - hit.at > TTL) {
    const start = day(new Date(Date.now() - BACK_DAYS * 86400000));
    const [shows, movies] = await Promise.all([
      api('GET', `/calendars/my/shows/${start}/${SPAN_DAYS}?extended=full`),
      api('GET', `/calendars/my/movies/${start}/${SPAN_DAYS}`),
    ]);
    hit = { at: Date.now(), events: toEvents(shows, movies) };
    cache.set(viewer, hit);
  }
  return toIcs(hit.events, name);
}

export { toEvents, toIcs };

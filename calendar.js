// A connected user's Trakt calendar (upcoming episodes and movies) as an iCalendar feed to subscribe to from a phone.
import { api } from './trakt.js';

const TTL = 60 * 60 * 1000;
const BACK_DAYS = 2;              // a little history, so an episode that aired today or yesterday is still listed
const SPAN_DAYS = 33;             // the longest range Trakt documents for a calendar call
const DEFAULT_MINUTES = 30;
const cache = new Map();          // viewer -> { at, events }, never shared between users

const day = (d) => d.toISOString().slice(0, 10);
const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');          // 20261017T203000Z
const dateOnly = (s) => s.replace(/-/g, '');

// RFC 5545: escape text, end lines with CRLF, and fold lines longer than 75 octets.
const escText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n) => String(n).padStart(2, '0');

// Turns Trakt's two calendar answers into a flat list of events (pure, so it can be tested).
// Episodes of one show and season that air on the same (UTC) day, such as a streaming drop, become one event.
export function toEvents(shows, movies) {
  const events = [];
  const groups = new Map();
  for (const i of shows || []) {
    const start = new Date(i.first_aired || NaN);       // null would otherwise become 1970
    if (!i.episode || !i.show || isNaN(start)) continue;
    const { season, number, title, runtime } = i.episode;
    const ep = { start, season, number, title: title || '', trakt: i.episode.ids?.trakt, show: i.show, minutes: runtime || i.show.runtime || DEFAULT_MINUTES };
    const key = `${i.show.ids?.trakt ?? i.show.title}-${season}-${day(start)}`;
    groups.set(key, [...(groups.get(key) || []), ep]);
  }
  for (const [key, eps] of groups) {
    eps.sort((a, b) => a.number - b.number);
    const first = eps[0], last = eps[eps.length - 1];
    const start = new Date(Math.min(...eps.map((e) => e.start)));
    const end = new Date(start.getTime() + first.minutes * 60000);
    if (eps.length === 1) {
      const code = `S${pad(first.season)}E${pad(first.number)}`;
      events.push({ uid: `episode-${first.trakt ?? `${first.show.ids?.trakt}-${code}`}`, summary: `${first.show.title} ${code}`, description: first.title, start, end });
    } else {
      events.push({
        uid: `season-${key}`,
        summary: `${first.show.title} S${pad(first.season)} (E${pad(first.number)}-E${pad(last.number)})`,
        description: eps.map((e) => `E${pad(e.number)} ${e.title}`.trim()).join('\n'),
        start, end,
      });
    }
  }
  for (const i of movies || []) {
    if (!i.movie || !i.released) continue;
    events.push({ uid: `movie-${i.movie.ids?.trakt}`, summary: i.movie.title, description: 'Movie release', date: i.released });
  }
  return events;
}

export function toIcs(events, name, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Traktor//Trakt calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escText(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@traktor`, `DTSTAMP:${stamp(now)}`);
    if (e.date) {
      const next = new Date(`${e.date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.date)}`, `DTEND;VALUE=DATE:${dateOnly(day(next))}`);
    } else lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`);
    lines.push(`SUMMARY:${escText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escText(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

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

// Trakt's two calendar answers as a flat list of events (pure, so it can be tested).
const DEFAULT_MINUTES = 30;

export const day = (d) => d.toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

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

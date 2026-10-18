// A Trakt movie or show as a Stremio catalog entry (null when it has no IMDb id).
const art = (kind, size, imdb) => `https://images.metahub.space/${kind}/${size}/${imdb}/img`;

export const toMeta = (o, type) => (o?.ids?.imdb
  ? { id: o.ids.imdb, type, name: o.title, releaseInfo: o.year ? String(o.year) : undefined, poster: art('poster', 'large', o.ids.imdb), background: art('background', 'medium', o.ids.imdb), logo: art('logo', 'medium', o.ids.imdb) }
  : null);

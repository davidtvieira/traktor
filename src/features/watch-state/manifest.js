export const EVENTS = ['start', 'pause', 'stop', 'played', 'unplayed', 'watchlisted', 'unwatchlisted',
  'dropped', 'undropped', 'rated', 'unrated'];

// The id stays as it was so AIOStreams does not need a reinstall.
export const watchStateManifest = {
  id: 'com.local.trakt-watchstate',
  version: '1.0.0',
  name: 'Traktor',
  description: 'Syncs playback, history, watchlist, ratings and drops with Trakt.',
  types: ['movie', 'series'],
  catalogs: [],
  resources: [{ name: 'watch_state', types: ['movie', 'series'], idPrefixes: ['tt'] }],
  watchState: {
    version: 2,
    viewers: true,
    push: { events: EVENTS, bulk: true },
    pull: { items: true, watched: true, watchlist: true, ratings: true, ttlSeconds: 300 },
  },
};

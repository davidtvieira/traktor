// Trakt watch_state addon for AIOStreams (watch_state protocol v2).
import { keepUsersFresh, userName } from './aiostreams/users.js';
import { startServer } from './http/server.js';
import { setViewerNamer } from './util/log.js';

setViewerNamer(userName);
startServer();
keepUsersFresh();

// The watch_state calls, shared by the plain addon address and the per-user address. True when handled.
import { noteSync } from '../../features/activity/store.js';
import { handlePull } from '../../features/watch-state/pull/index.js';
import { handlePush } from '../../features/watch-state/push/index.js';
import { UnknownViewerError } from '../../trakt/errors.js';
import { readBody } from '../request.js';
import { sendJson } from '../respond.js';

export async function watchStateRoute(req, res, url, p) {
  try {
    if (req.method === 'GET' && p === '/watch_state/pull.json') {
      sendJson(res, 200, await handlePull(url.searchParams.get('since') || ''));
    } else if (req.method === 'POST' && p.startsWith('/watch_state/push/')) {
      await handlePush(JSON.parse(await readBody(req)));
      sendJson(res, 200, { ok: true });
    } else return false;
  } catch (e) {
    // Shown on the users page; a bad request or an unknown user is not the user's setup going wrong.
    if (!(e instanceof UnknownViewerError) && !(e instanceof SyntaxError)) noteSync(e.message);
    throw e;
  }
  noteSync();
  return true;
}

// The watch_state calls, shared by the plain addon address and the per-user address. True when handled.
import { handlePull } from '../../features/watch-state/pull/index.js';
import { handlePush } from '../../features/watch-state/push/index.js';
import { readBody } from '../request.js';
import { sendJson } from '../respond.js';

export async function watchStateRoute(req, res, url, p) {
  if (req.method === 'GET' && p === '/watch_state/pull.json') {
    sendJson(res, 200, await handlePull(url.searchParams.get('since') || ''));
    return true;
  }
  if (req.method === 'POST' && p.startsWith('/watch_state/push/')) {
    await handlePush(JSON.parse(await readBody(req)));
    sendJson(res, 200, { ok: true });
    return true;
  }
  return false;
}

// /config: the browser pages for connecting users and choosing lists. Guarded by ADMIN_PASSWORD when set.
import { config } from '../config.js';
import { adminAuthorized, isCrossOrigin, readBody } from '../http/request.js';
import { sendHtml } from '../http/respond.js';
import { esc } from '../util/html.js';
import { log } from '../util/log.js';
import { adminSubmit } from './actions.js';
import { adminPage } from './pages.js';
import { msg } from './views/layout.js';

const html = (res, code, body) => sendHtml(res, code, body, { 'Cache-Control': 'no-store' });

// True when handled.
export async function adminRoute({ req, res, admin }) {
  if (!adminAuthorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Traktor"', 'Content-Type': 'text/plain' });
    res.end('Password required');
    return true;
  }
  if (req.method === 'POST' && isCrossOrigin(req)) { html(res, 403, msg('err', 'Blocked', 'Cross-site request refused.')); return true; }
  if (!config.trakt.clientId) { html(res, 500, msg('err', 'Not configured', 'TRAKT_CLIENT_ID is not set.')); return true; }
  try {
    if (req.method === 'GET') { html(res, 200, await adminPage(admin, req)); return true; }
    if (req.method === 'POST') { html(res, 200, await adminSubmit(await readBody(req, 20_000))); return true; }
  } catch (e) {
    log(`ERROR auth page: ${e.message}`);
    html(res, 400, msg('err', 'Something went wrong', esc(e.message).slice(0, 300)));
    return true;
  }
  return false;
}

import { AuthError, TraktError, UnknownViewerError } from '../trakt/errors.js';
import { log } from '../util/log.js';

export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

export function sendHtml(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

// Maps a failure to the status AIOStreams should see: retryable ones back off, unmappable items are dropped.
export function sendError(res, e) {
  if (!e.logged) log(`ERROR ${e.message}`);
  if (e.tooLarge) return sendJson(res, 413, { error: e.message });
  if (e instanceof UnknownViewerError) return sendJson(res, 404, { error: 'unknown viewer' });   // dropped, not retried
  if (e instanceof AuthError) return sendJson(res, 401, { error: e.message });
  if (e instanceof TraktError) {
    const h = e.retryAfter ? { 'Retry-After': e.retryAfter } : {};
    if (e.status === 429 || e.status >= 500) return sendJson(res, e.status === 429 ? 429 : 503, { error: e.message }, h);
    return sendJson(res, 400, { error: e.message });       // unmappable item: drop, don't retry
  }
  sendJson(res, e instanceof SyntaxError ? 400 : 500, { error: e.message });
}

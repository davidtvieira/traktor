// The answer for an address nothing lives at: a small page for a browser, JSON for AIOStreams and other clients.
import { msg } from '../admin/views/layout.js';
import { sendHtml, sendJson } from './respond.js';

export function notFound(req, res) {
  if (req.method === 'GET' && String(req.headers.accept || '').includes('text/html')) {
    return sendHtml(res, 404, msg('err', 'Wrong route', 'There is nothing at this address. Check the link, or go back to the start.', { href: '/', label: 'Home' }));
  }
  sendJson(res, 404, { error: 'not found' });
}

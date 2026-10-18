// The shared addon address (behind ADDON_SECRET when set): the manifest AIOStreams installs, and watch state for the viewer named in ?viewer=.
import { watchStateManifest } from '../../features/watch-state/manifest.js';
import { sendJson } from '../respond.js';
import { watchStateRoute } from './watch-state.js';

// `p` is the path with the secret prefix already removed.
export async function addonRoute({ req, res, url }, p) {
  if (req.method === 'GET' && p === '/manifest.json') {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    return sendJson(res, 200, { ...watchStateManifest, logo: `${proto}://${req.headers.host}/logo.svg` });
  }
  if (await watchStateRoute(req, res, url, p)) return;
  sendJson(res, 404, { error: 'not found' });
}

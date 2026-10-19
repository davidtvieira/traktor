// The shared addon address (behind ADDON_SECRET when set): the manifest AIOStreams installs, the charts shown to everyone, and watch state for the viewer named in ?viewer=.
import { sharedCatalogMetas, sharedManifest } from '../../features/lists/index.js';
import { watchStateManifest } from '../../features/watch-state/manifest.js';
import { notFound } from '../not-found.js';
import { sendJson } from '../respond.js';
import { catalogRoute } from './user.js';
import { watchStateRoute } from './watch-state.js';

// `p` is the path with the secret prefix already removed.
export async function addonRoute({ req, res, url }, p) {
  if (req.method === 'GET' && p === '/manifest.json') {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const logo = `${proto}://${req.headers.host}/logo.svg`;
    const { catalogs } = await sharedManifest(logo);
    return sendJson(res, 200, { ...watchStateManifest, logo, catalogs, resources: [...watchStateManifest.resources, 'catalog'] });
  }
  if (await catalogRoute(req, res, p.slice(1), sharedCatalogMetas)) return;
  if (await watchStateRoute(req, res, url, p)) return;
  notFound(req, res);
}

// The address for users with no Trakt account (/u/<key>/...): only the charts shown to everyone.
import { sharedCatalogMetas, sharedManifest } from '../../features/lists/index.js';
import { log } from '../../util/log.js';
import { publicBase } from '../request.js';
import { notFound } from '../not-found.js';
import { sendJson } from '../respond.js';
import { catalogRoute } from './user.js';

export async function sharedRoute({ req, res }, rest) {
  if (rest === 'manifest.json' && req.method === 'GET') {
    const lists = await sharedManifest(`${publicBase(req)}/logo.svg`);
    log(`public manifest -> ${lists.catalogs.length} list catalogs`);
    return sendJson(res, 200, { ...lists, name: 'Traktor' });
  }
  if (await catalogRoute(req, res, rest, sharedCatalogMetas)) return;
  notFound(req, res);
}

// A user's own address (/u/<key>/...): their manifest with watch state and Trakt lists as catalogs, the catalogs, and their calendar feed.
import { calendarIcs } from '../../features/calendar/index.js';
import { catalogMetas, listsManifest } from '../../features/lists/index.js';
import { watchStateManifest } from '../../features/watch-state/manifest.js';
import { aioUsers, userName } from '../../aiostreams/users.js';
import { cleanViewer } from '../../util/ids.js';
import { log } from '../../util/log.js';
import { publicBase } from '../request.js';
import { sendJson } from '../respond.js';
import { watchStateRoute } from './watch-state.js';

const CATALOG = /^catalog\/(movie|series)\/([\w-]+)(?:\/([^/]+))?\.json$/;

// Call inside the user's viewerContext.
export async function userRoute({ req, res, url }, viewer, rest) {
  if (rest === 'manifest.json' && req.method === 'GET') {
    const lists = await listsManifest(viewer, `${publicBase(req)}/logo.svg`);
    log(`manifest -> ${lists.catalogs.length} list catalogs`);
    return sendJson(res, 200, { ...watchStateManifest, ...lists, id: `com.local.traktor.${viewer || 'primary'}`, name: 'Traktor',
      description: 'Syncs playback with Trakt and shows your Trakt lists', resources: [...watchStateManifest.resources, 'catalog'] });
  }
  if (rest === 'calendar.ics' && req.method === 'GET') {
    await aioUsers().catch(() => {});
    const name = userName(viewer);
    const ics = await calendarIcs(viewer, name ? `Traktor - ${name}` : 'Traktor');
    res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="traktor.ics"', 'Cache-Control': 'private, max-age=900' });
    log(`calendar -> ${(ics.match(/BEGIN:VEVENT/g) || []).length} events`);
    return res.end(ics);
  }
  if (rest.startsWith('watch_state/')) {
    // An address belongs to one user: a call that names a different user is dropped, never written to this account.
    if (cleanViewer(url.searchParams.get('viewer')) !== viewer) return sendJson(res, 404, { error: 'unknown viewer' });
    if (await watchStateRoute(req, res, url, `/${rest}`)) return;
  }
  const m = rest.match(CATALOG);
  if (m && req.method === 'GET') {
    const skip = Number(decodeURIComponent(m[3] || '').match(/skip=(\d+)/)?.[1] || 0);
    const metas = await catalogMetas(viewer, m[1], m[2], skip);
    log(`catalog ${m[1]} ${m[2]}${skip ? ` from ${skip}` : ''} -> ${metas.length} titles`);
    return sendJson(res, 200, { metas });
  }
  return sendJson(res, 404, { error: 'not found' });
}

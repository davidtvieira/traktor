// The route table. Public routes first; everything else sits behind ADDON_SECRET (when set) and runs as the ?viewer= user.
import { adminRoute } from '../admin/routes.js';
import { about } from '../admin/views/about.js';
import { help } from '../admin/views/help.js';
import { config } from '../config.js';
import { runAs } from '../context.js';
import { isSharedKey } from '../storage/shared-store.js';
import { viewerByKey } from '../storage/user-store.js';
import { cleanViewer } from '../util/ids.js';
import { safeEq } from './request.js';
import { sendHtml, sendJson } from './respond.js';
import { addonRoute } from './routes/addon.js';
import { sharedRoute } from './routes/shared.js';
import { userRoute } from './routes/user.js';
import { STATIC_PATH, serveStatic } from './static.js';

const notFound = (res) => sendJson(res, 404, { error: 'not found' });

// [method ('*' = any), path (string or RegExp; its groups are passed on), handler]
const PUBLIC = [
  ['*', '/healthz', (ctx) => sendJson(ctx.res, 200, { ok: true })],
  ['GET', STATIC_PATH, (ctx) => serveStatic(ctx.res, ctx.url.pathname) || notFound(ctx.res)],
  ['GET', '/help', (ctx) => sendHtml(ctx.res, 200, help())],
  ['GET', '/', (ctx) => sendHtml(ctx.res, 200, about())],
  // A user's private address (or the one for users with no Trakt account): the random key in the path is the credential.
  ['*', /^\/u\/([a-f0-9]{32})\/(.+)$/, (ctx, key, rest) => {
    if (isSharedKey(key)) return sharedRoute(ctx, rest);
    const viewer = viewerByKey(key);
    if (viewer === null) return notFound(ctx.res);
    return runAs(viewer, () => userRoute(ctx, viewer, rest));
  }],
  // Short address with no secret: meant for a private network / VPN.
  ['*', '/auth', async (ctx) => { if (!await adminRoute(ctx)) notFound(ctx.res); }],
];

function matchRoute([method, pattern], req, pathname) {
  if (method !== '*' && method !== req.method) return null;
  if (typeof pattern === 'string') return pattern === pathname ? [] : null;
  const m = pattern.exec(pathname);
  return m && m.slice(1);
}

export async function dispatch(req, res) {
  const url = new URL(req.url, 'http://x');
  const ctx = { req, res, url };
  for (const route of PUBLIC) {
    const groups = matchRoute(route, req, url.pathname);
    if (groups) return route[2](ctx, ...groups);
  }
  const { secret, prefix } = config;
  if (secret && !(url.pathname.startsWith(prefix + '/') && safeEq(url.pathname.split('/')[1], secret))) return notFound(res);
  const viewer = cleanViewer(url.searchParams.get('viewer'));
  return runAs(viewer, () => addonRoute(ctx, url.pathname.slice(prefix.length)));
}

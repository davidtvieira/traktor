// The GET side of /auth: gathers the data for each page and hands it to a view.
import { aioUsers, traktorInstanceId } from '../aiostreams/users.js';
import { config } from '../config.js';
import { runAs } from '../context.js';
import { DISCOVER, availableLists, chosenLists, sharedLists } from '../features/lists/index.js';
import { getActivity } from '../features/activity/store.js';
import { publicBase } from '../http/request.js';
import { sharedKey, sharedRev } from '../storage/shared-store.js';
import { catalogKey, getOptOut, getPicks, getRev } from '../storage/user-store.js';
import { viewerStates } from '../storage/token-store.js';
import { esc } from '../util/html.js';
import { beginLogin, isOob } from './login.js';
import { connectPage } from './views/connect.js';
import { msg } from './views/layout.js';
import { listsPage, sharedListsPage } from './views/lists.js';
import { usersPage } from './views/users.js';

async function usersIndex(req) {
  const users = await aioUsers();
  const states = viewerStates();
  const rows = users.map((u) => ({
    user: u,
    state: states[u.id],
    activity: getActivity(u.id),
    calendarUrl: states[u.id] === 'ok' ? `${publicBase(req)}/u/${catalogKey(u.id)}/calendar.ics` : '',
  }));
  return usersPage(rows, `${publicBase(req)}/manifest.json`);
}

// The AIOStreams script that points the Traktor addon at an address and keeps the catalogs in Traktor's order.
async function variantScript(req, key, rev) {
  const addr = `${publicBase(req)}/u/${key}/manifest.json${rev ? `?r=${rev}` : ''}`;
  await aioUsers().catch(() => {});
  const orderLine = traktorInstanceId() ? `\nadd upstreamCatalogOrder "${traktorInstanceId()}"` : '';
  return `enable presets[options.name="Traktor"]\nset presets[options.name="Traktor"].options.manifestUrl = "${addr}"${orderLine}`;
}

async function sharedIndex(req) {
  return sharedListsPage({ avail: DISCOVER, chosen: sharedLists(), script: await variantScript(req, sharedKey(), sharedRev()) });
}

async function listsIndex(req, viewer, user) {
  const key = catalogKey(viewer);
  if (!key) return msg('err', 'Not connected', 'Connect this user to Trakt first.');
  let avail;
  try { avail = await runAs(viewer, () => availableLists(viewer, true)); }
  catch (e) { return msg('err', 'Could not load lists', esc(e.message).slice(0, 300)); }
  const chosen = chosenLists(avail, getPicks(viewer));
  return listsPage({ user, viewer, avail, chosen, everyone: sharedLists(), off: new Set(getOptOut(viewer)), script: await variantScript(req, key, getRev(viewer)) });
}

function connectIndex(user, viewer) {
  const { state, link } = beginLogin(viewer);
  return connectPage({ user, link, state, redirectUri: config.trakt.redirectUri, oob: isOob });
}

// admin: { page: 'users' | 'shared' | 'connect' | 'lists', viewer } as chosen by the route.
export async function adminPage({ page, viewer }, req) {
  if (page === 'shared') return sharedIndex(req);
  if (page === 'users') return usersIndex(req);
  const user = (await aioUsers()).find((u) => u.id === viewer);
  if (!user) return msg('err', 'Unknown user', 'That user does not exist in AIOStreams.');
  if (page === 'lists') return listsIndex(req, viewer, user);
  return connectIndex(user, viewer);
}

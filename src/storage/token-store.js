// One record per AIOStreams user in tokens.json: Trakt login first, plus the per-user fields the user-store keeps beside it.
import { config } from '../config.js';
import { currentViewer } from '../context.js';
import { readJson, writeJson } from './json-store.js';

function readAll() {
  let all = readJson(config.tokensFile, {});
  if (all.access_token) all = { '': all };           // migrate the single-account format
  return all;
}
const writeAll = (all) => writeJson(config.tokensFile, all, true);

export const loadTokens = (viewer = currentViewer()) => readAll()[viewer] || null;
export function saveTokens(t, viewer = currentViewer()) {
  const all = readAll(); all[viewer] = t; writeAll(all);
}
// Merge fields into a user's record. Without `create` an unknown (disconnected) user is left alone.
export function patchUser(viewer, patch, { create = false } = {}) {
  const all = readAll();
  if (!all[viewer] && !create) return null;
  all[viewer] = { ...all[viewer], ...patch };
  writeAll(all);
  return all[viewer];
}
export function deleteTokens(viewer) {
  const all = readAll(); delete all[viewer]; writeAll(all);
}
export const knownViewers = () => Object.keys(readAll());
export const allRecords = () => Object.entries(readAll());
// viewer -> 'ok' | 'reauth' (Trakt rejected the saved login; the user must connect again)
export const viewerStates = () => Object.fromEntries(allRecords().map(([k, v]) => [k, v.reauth ? 'reauth' : 'ok']));

// The last event written to Trakt for each user, and the last failed sync, shown on the users page. Saved with a short delay so it survives restarts.
import path from 'node:path';
import { config } from '../../config.js';
import { currentViewer } from '../../context.js';
import { readJson, writeFileAtomic } from '../../storage/json-store.js';

const FILE = path.join(config.dataDir, 'activity.json');
export const HISTORY_MAX = 10;                  // actions kept per user
const SAVE_DELAY_MS = 5000;

const activity = readJson(FILE, {});
let timer = null;

// text set: an event was written to Trakt. No text: AIOStreams just checked in (a pull).
function scheduleSave() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try { writeFileAtomic(FILE, JSON.stringify(activity), 0o600); } catch (e) { console.error('activity save failed:', e.message); }
  }, SAVE_DELAY_MS);
  timer.unref();
}

export function touchActivity(text) {
  const v = currentViewer();
  const now = Date.now(), a = activity[v] || {};
  activity[v] = text ? { ...a, at: now, text, seen: now, recent: [{ at: now, text }, ...(a.recent || [])].slice(0, HISTORY_MAX) } : { ...a, seen: now };
  scheduleSave();
}

// A pull or push failed (text) or worked (no text, which clears the last failure) for the current user.
export function noteSync(text) {
  const v = currentViewer(), { error, ...rest } = activity[v] || {};
  if (!text && !error) return;
  activity[v] = text ? { ...rest, error: { at: Date.now(), text } } : rest;
  scheduleSave();
}

export const getActivity = (viewer) => activity[viewer];

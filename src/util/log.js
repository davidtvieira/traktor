// One line per thing the addon does, tagged with the AIOStreams user it was done for.
import { viewerContext } from '../context.js';

let nameOf = () => null;
// Lets log lines say [david] instead of [primary] once the AIOStreams users are known.
export const setViewerNamer = (fn) => { nameOf = fn; };

function who(v) {
  if (v === undefined) {
    const store = viewerContext.getStore();
    if (!store) return 'system';
    v = store.viewer || '';
  }
  return (nameOf(v) || v || 'primary').toLowerCase();
}
export const log = (msg, v) => console.log(`${new Date().toISOString().slice(11, 19)} [${who(v)}] ${msg}`);

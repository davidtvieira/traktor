// The browser login: a one-time state + PKCE verifier is handed out with the Trakt link, and redeemed when the user pastes the result back.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { authorizeUrl, exchangeCode, newPkce } from '../trakt/oauth.js';

const TTL = 15 * 60 * 1000;
const pending = new Map();                       // state -> { verifier, viewer, at }

export const isOob = config.trakt.redirectUri.startsWith('urn:');

export function beginLogin(viewer) {
  for (const [k, v] of pending) if (Date.now() - v.at > TTL) pending.delete(k);
  const state = crypto.randomBytes(16).toString('hex');
  const { verifier, challenge } = newPkce();
  pending.set(state, { verifier, viewer, at: Date.now() });
  return { state, link: authorizeUrl(state, challenge) };
}

// `input` is what the user pasted: the full redirect address, or the bare code. Returns the connected viewer, or null when the login expired.
export async function finishLogin(input, formState) {
  let code = input, state = formState;
  if (input.includes('code=')) { const u = new URL(input); code = u.searchParams.get('code'); state = u.searchParams.get('state') || state; }
  const p = pending.get(state);
  if (!p || !code) return null;
  pending.delete(state);
  await exchangeCode(code, p.verifier, p.viewer);
  return p.viewer;
}

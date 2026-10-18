import crypto from 'node:crypto';
import { config } from '../config.js';

export const safeEq = (a, b) => crypto.timingSafeEqual(...[a, b].map((x) => crypto.createHash('sha256').update(String(x)).digest()));

// HTTP Basic with any username; open when no ADMIN_PASSWORD is set.
export function adminAuthorized(req) {
  if (!config.adminPassword) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const dec = Buffer.from(h.slice(6), 'base64').toString();
  return safeEq(dec.slice(dec.indexOf(':') + 1), config.adminPassword);
}

// A browser form post from another site names a different origin.
export const isCrossOrigin = (req) => Boolean(req.headers.origin) && new URL(req.headers.origin).host !== req.headers.host;

export async function readBody(req, max = 1_000_000) {
  let raw = '';
  for await (const c of req.setEncoding('utf8')) {
    raw += c;
    if (raw.length > max) throw Object.assign(new Error('payload too large'), { tooLarge: true });
  }
  return raw;
}

// The address this addon is reached at, for links handed to AIOStreams and phones.
export const publicBase = (req) => (config.publicUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`).replace(/\/$/, '');

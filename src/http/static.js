// Serves public/ (the logo, admin CSS and browser JS). Files are read once at startup.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const TYPES = { '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const files = new Map();                      // '/css/app.css' -> { type, body }

function load(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) load(path.join(dir, entry.name), `${prefix}/${entry.name}`);
    else if (TYPES[path.extname(entry.name)]) files.set(`${prefix}/${entry.name}`, { type: TYPES[path.extname(entry.name)], body: fs.readFileSync(path.join(dir, entry.name)) });
  }
}
load(config.publicDir);

export const STATIC_PATH = /^\/(?:logo\.svg|(?:css|js)\/[\w.-]+)$/;

export function serveStatic(res, pathname) {
  const f = files.get(pathname);
  if (!f) return false;
  res.writeHead(200, { 'Content-Type': f.type, 'Cache-Control': 'no-cache' });
  res.end(f.body);
  return true;
}

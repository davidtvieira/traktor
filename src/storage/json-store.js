import fs from 'node:fs';

// Write to a temp file, then rename: a crash mid-write never leaves a half-written file.
export function writeFileAtomic(file, data, mode = 0o600) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode });
  fs.renameSync(tmp, file);
}

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export const writeJson = (file, value, pretty = false) => writeFileAtomic(file, JSON.stringify(value, null, pretty ? 2 : undefined));

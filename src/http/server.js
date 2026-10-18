import http from 'node:http';
import { config } from '../config.js';
import { dispatch } from './router.js';
import { sendError } from './respond.js';

export function startServer() {
  const server = http.createServer(async (req, res) => {
    try { await dispatch(req, res); } catch (e) { sendError(res, e); }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.listen(config.port, '0.0.0.0', () => console.log(`traktor on :${config.port}`));
  return server;
}

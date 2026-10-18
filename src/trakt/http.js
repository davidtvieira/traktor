// The raw Trakt request: base address and headers. No login logic here.
import { config } from '../config.js';

const API = 'https://api.trakt.tv';

export const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  'User-Agent': 'traktor/1.0 (AIOStreams)',
  'Accept': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': config.trakt.clientId,
  ...extra,
});

export const request = (method, pathname, { token, body } = {}) => fetch(API + pathname, {
  method,
  headers: headers(token ? { Authorization: `Bearer ${token}` } : {}),
  body: body === undefined ? undefined : JSON.stringify(body),
});

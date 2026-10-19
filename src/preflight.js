// Refuses to start while a required setting is missing, and says which one in the log.
import { config } from './config.js';

const REQUIRED = [
  ['TRAKT_CLIENT_ID', config.trakt.clientId, 'the Client ID of your app at https://trakt.tv/oauth/applications'],
  ['TRAKT_REDIRECT_URI', config.trakt.redirectUri, 'the Redirect URI of that Trakt app, exactly (for example https://just-copy.me)'],
  ['AIOSTREAMS_URL', config.aiostreams.url, 'the address of your AIOStreams, for example http://192.168.1.4:3000'],
  ['AIOSTREAMS_UUID', config.aiostreams.uuid, 'your AIOStreams user id'],
  ['AIOSTREAMS_PASSWORD', config.aiostreams.password, 'your AIOStreams password'],
];

// Returns one line per problem: empty when the setup is complete.
export function configProblems() {
  const problems = REQUIRED.filter(([, value]) => !value).map(([name, , what]) => `${name} is not set: ${what}`);
  if (config.aiostreams.url && !/^https?:\/\//.test(config.aiostreams.url)) problems.push('AIOSTREAMS_URL must start with http:// or https://');
  return problems;
}

export function requireConfig() {
  const problems = configProblems();
  if (!problems.length) return;
  console.error(['Traktor cannot start: fix these settings in .env, then start it again.', ...problems.map((p) => `  - ${p}`), 'See the Setup section of the README.'].join('\n'));
  process.exit(1);
}

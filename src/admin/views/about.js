import { page } from './layout.js';

export const about = () => page(`<img class=hero src="/logo.svg" alt=""><h1 style="text-align:center">Traktor</h1><p class=sub style="text-align:center">Keeps AIOStreams and Trakt in sync.</p>
<div class=card><ol class=steps>
<li><b>Syncs what you watch</b><p>Plays in AIOStreams go to Trakt, and your Trakt progress fills Continue Watching and Next Up.</p></li>
<li><b>Shows your Trakt lists</b><p>Recommendations, favorites, your own lists and more appear as catalogs in AIOStreams.</p></li>
<li><b>Adds a calendar</b><p>Your upcoming episodes and movies, as a feed for your phone calendar.</p></li>
</ol></div>
<div class=card style="margin-top:16px;border-left:3px solid var(--red)"><div style="padding:14px"><b>Install once</b>
<p class=sub style="margin:6px 0 0">This is a one-time install. Never reinstall the addon in AIOStreams, and don't edit it afterwards: that breaks the link between the addon and your users. To change anything later, update each user's variant instead. See Help.</p></div></div>
<footer style="display:grid;gap:10px;margin-top:20px"><a class=btn href="/auth" style="display:block;text-align:center">Configure addon</a><a class="btn ghost" href="/help" style="display:block;text-align:center">Help</a></footer>`);

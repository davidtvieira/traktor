// The two-step "connect Trakt for this user" page.
import { esc } from '../../util/html.js';
import { page } from './layout.js';

export function connectPage({ user, link, state, redirectUri, oob }) {
  return page(`<h1>Connect Trakt for ${esc(user.name)}</h1><p class=sub>Two quick steps.</p>
<div class=card><ol class=steps>
<li><b>Approve access</b><p>Sign in to trakt.tv as the person this is for, then approve.</p>
<a class=btn href="${esc(link)}" target=_blank rel=noopener>Open Trakt</a></li>
<li><b>Paste the ${oob ? 'code' : 'address'}</b><p>${oob ? 'Trakt shows an authorization code. Copy it and paste it below.' : `Trakt redirects to <code>${esc(redirectUri)}</code>, which may show an error page. Copy the full address from the address bar and paste it below.`}</p>
<form method=post><input type=hidden name=state value="${state}">
<input name=url placeholder="${oob ? 'Authorization code' : esc(redirectUri) + '?code=...'}" required autocomplete=off><button>Finish</button></form></li>
</ol></div><footer><a class="btn ghost" href="/auth" style="display:block;text-align:center">Back</a></footer>`);
}

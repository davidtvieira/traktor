import { page } from './layout.js';

export const help = () => page(`<h1>Help</h1><p class=sub>Everything you need to install Traktor and keep your lists up to date.</p>
<nav class=jump><a class=btn href="#sync">Add sync watch</a><a class=btn href="#lists">Lists</a><a class=btn href="#calendar">Calendar</a></nav>
<h2 id=sync>Add sync watch</h2>
<div class=card><ol class=steps>
<li><b>Copy the manifest</b><p>Press Configure addon, then Copy manifest at the bottom of the users list.</p></li>
<li><b>Add it to AIOStreams</b><p>Go to Addons, Marketplace, Custom Addon, paste the link, then press Install and Save.</p></li>
<li><b>Check your users</b><p>Reload AIOStreams. Under Users, make sure each user has Traktor picked.</p></li>
<li><b>Connect Trakt</b><p>Press Configure addon, then Connect next to each user. Sign in to Trakt as that person and approve. Trakt then sends you to a page that may show an error. That is fine: copy the full address from the address bar, paste it back here and press Finish.</p></li>
</ol></div>
<div id=lists style="display:flex;align-items:center;justify-content:space-between;margin-top:28px"><h2 style="margin:0">Add Trakt lists</h2><button type=button class=ghost aria-label="Why is a variant needed?" onclick="var w=document.getElementById('why');w.hidden=!w.hidden" style="width:30px;height:30px;padding:0;border-radius:50%">?</button></div>
<div id=why hidden class=card style="margin-top:12px"><div style="padding:14px">
<b>Why does each user need a variant?</b>
<p class=sub style="margin:6px 0 0">The manifest you copy on the users page is the same for everyone. It only syncs watch state and has no lists in it, because AIOStreams tells Traktor which user is watching for syncing, but not when it asks for lists. Traktor cannot tell whose lists to show.</p>
<p class=sub style="margin:10px 0 0">So each user gets their own address, with their own Trakt lists and their own identity. A variant is how AIOStreams swaps the Traktor addon's address for that user's one. Without it, nobody would see their lists, or everyone would see the same ones.</p>
</div></div>
<p class=sub style="margin:12px 0">Optional. If you do not need lists, skip this step: watch sync works without it.</p>
<div class=card><ol class=steps>
<li><b>Choose the lists</b><p>Press Configure addon, then Lists next to a connected user. Tick the lists you want and press Save lists.</p></li>
<li><b>Copy the script</b><p>On the same page, press Copy script.</p></li>
<li><b>Create a variant</b><p>In AIOStreams open About, Advanced Mode, Miscellaneous, Variants. Create a variant named after the user, paste the script and save.</p></li>
<li><b>Pick it for the user</b><p>Under Users, choose that variant for the user. Repeat for each user, so everyone sees their own lists.</p></li>
</ol></div>
<h2 style="margin-top:28px">Changing or updating lists</h2>
<div class=card><div style="padding:14px">
<p style="margin-top:0"><b>Always update the variant, never the main addon.</b> Reinstalling or editing the main addon breaks the link between the addon and your users.</p>
<p>Whenever you change a user's lists, whether you tick or untick one, add new ones or change the order:</p>
<ol style="margin:0;padding-left:20px;line-height:1.6">
<li>Press <b>Save lists</b>.</li>
<li>Press <b>Copy script</b>.</li>
<li>In AIOStreams open that user's variant, paste the script over the old one and save.</li>
</ol>
<p style="margin:12px 0 0">Each save adds 1 to the number at the end of the address (<code>?r=1</code>, <code>?r=2</code> and so on). That tells AIOStreams to reload the addon, so the new lists and the new order show up. The script also keeps the catalogs in the order you set. Do this for each user whose lists you changed.</p>
<p style="margin:12px 0 0"><b>Still not changing?</b> Restart the AIOStreams container, for example with <code>docker compose down</code> and then <code>docker compose up -d</code> in its folder. This clears its cache. Do not reinstall the addon.</p>
<p class=sub style="margin:12px 0 0">Anyone with a user's address can see that user's chosen lists, so do not share it.</p>
</div></div>
<h2 id=calendar style="margin-top:28px">Add a calendar</h2>
<p class=sub style="margin:12px 0">Optional. Shows each user's upcoming episodes and movies in a phone calendar. Needs no variant.</p>
<div class=card><ol class=steps>
<li><b>Copy the link</b><p>Press Configure addon, then the calendar icon next to a connected user. Each user has their own link.</p></li>
<li><b>Subscribe to it</b><p>Android: add it in ICSx⁵, then tick the new calendar in your calendar app. Google Calendar on the web: Other calendars, From URL. iPhone: Settings, Calendar, Accounts, Add Subscribed Calendar.</p></li>
</ol></div>
<footer><a class="btn ghost" href="/" style="display:block;text-align:center">Back</a></footer>`);

<p align="center"><img src="public/logo.svg" width="96" alt=""></p>

# Traktor

Syncs AIOStreams with Trakt, one Trakt account per AIOStreams user.

- Plays from the AIOStreams app go to Trakt.
- Your Trakt progress, history, watchlist, ratings and dropped shows fill Continue Watching and Next Up.
- Your Trakt lists (recommendations, favorites, collection, your own, smart and liked lists, and Trakt's charts) can show as catalogs.
- Each user's upcoming episodes and movies are a calendar feed (iCalendar) you can subscribe to from a phone. See [Calendar](#calendar).
- The users page shows each user's last sync, and an **i** button opens their last 10 actions (watched, unwatched, watchlist changes, ratings and so on), each with the title and when it happened.

## Setup

1. Create an app at <https://trakt.tv/oauth/applications> so that Traktor can communicate with Trakt. Set the **Redirect URI** to any `https://` address (for example `https://just-copy.me`; the page never has to load). Copy the **Client ID**.

2. Download `compose.yaml` and `.env.example` from this repo into an empty folder, and copy the example to `.env`:

   ```sh
   cp .env.example .env     # then fill in TRAKT_CLIENT_ID and the AIOStreams values
   ```

   `TRAKT_REDIRECT_URI` must match the Trakt app exactly. The three `AIOSTREAMS_` values are only used to fetch your users, so each can be linked to a Trakt account on `/auth`. `ADMIN_PASSWORD` (asks for a password on `/auth`) and `ADDON_SECRET` (adds `/<secret>/` to the manifest URL) are optional.

3. Start it:

   ```sh
   mkdir -p data && chown 1000:1000 data
   docker compose up -d
   ```

   This pulls `davidtvieira/traktor` from Docker Hub (`docker pull davidtvieira/traktor`; also published as `ghcr.io/davidtvieira/traktor`). To build from source instead: `docker compose -f compose.yaml -f compose.build.yaml up -d --build`.

## WARNING: Updating lists

Always update a user's **variant** in AIOStreams, never the main addon: reinstalling or editing the main addon breaks the link between the addon and your users.

After any change to a user's lists (ticking or unticking one, new lists, a new order):

1. Press **Save lists** on that user's lists page.
2. Press **Copy script**.
3. In AIOStreams, open that user's variant, paste the script over the old one and save.

Each save adds 1 to the `?r=` number at the end of the address in the script. That makes AIOStreams reload the addon, so new lists and the new order show up. The script also keeps the catalogs in the order set in Traktor. If nothing changes after that, restart the AIOStreams container (`docker compose down` then `docker compose up -d` in its folder).

## Calendar

Each connected user has a private calendar feed of the episodes and movies coming up on their Trakt calendar (shows they watch, collect or have on their watchlist). It is read with the user's own Trakt login and needs no Trakt VIP.

1. Open `/auth` and press the **iCal** button (a calendar icon on mobile) next to a connected user. It copies that user's feed address, which ends in `/calendar.ics`.
2. Subscribe to it from a calendar app, so it keeps itself updated:
   - **Android:** [ICSx⁵](https://f-droid.org/packages/at.bitfire.icsdroid/): add a subscription with the address, then tick the new calendar in your calendar app.
   - **Google Calendar (web):** *Other calendars → From URL*.
   - **iPhone / Mac:** *Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar*.

## Project layout

```
src/
  index.js            boot: wires logging, starts the server
  config.js           every environment variable, parsed once
  context.js          which AIOStreams user the current request is for
  http/               server, route table, request/response helpers, static files
    routes/           addon (shared manifest), user (private address), watch_state
  admin/              the /auth pages: login flow, form actions, views
  features/
    watch-state/      push (Trakt writes), pull (Trakt reads), manifest
    lists/            Trakt lists and charts as catalogs
    calendar/         upcoming episodes and movies as an iCalendar feed
    activity/         last sync and the recent-actions history
  trakt/              API client, OAuth, typed errors
  storage/            atomic JSON files: Trakt logins, per-user settings
  aiostreams/         user lookup from the AIOStreams API
  util/               ids, time, logging, small helpers
public/               logo, admin stylesheet and browser scripts
test/                 mirrors src/ (run with npm test)
```

---

Unofficial project. Not affiliated with or endorsed by Trakt or AIOStreams. MIT licensed.

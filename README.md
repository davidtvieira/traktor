<p align="center"><img src="logo.svg" width="96" alt=""></p>

# Traktor

Syncs AIOStreams with Trakt, one Trakt account per AIOStreams user.

- Plays from the AIOStreams app and Jellyfin clients go to Trakt.
- Your Trakt progress, history, watchlist, ratings and dropped shows fill Continue Watching and Next Up.
- Your Trakt lists (recommendations, favorites, collection, your own, smart and liked lists, and Trakt's charts) can show as catalogs.
- Each user's upcoming episodes and movies are a calendar feed (iCalendar) you can subscribe to from a phone. See [Calendar](#calendar).

Stremio playback is not reported to addons, so it is not synced.

## Setup

1. Create an app at <https://trakt.tv/oauth/applications>. Set the **Redirect URI** to any `https://` address (for example `https://just-copy.me`; the page never has to load). Copy the **Client ID**.

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

## Calendar

Each connected user has a private calendar feed of the episodes and movies coming up on their Trakt calendar (shows they watch, collect or have on their watchlist). It is read with the user's own Trakt login and needs no Trakt VIP.

1. Open `/auth` and press the calendar icon next to a connected user. It copies that user's feed address, which ends in `/calendar.ics`.
2. Subscribe to it from a calendar app, so it keeps itself updated:
   - **Android:** [ICSx⁵](https://f-droid.org/packages/at.bitfire.icsdroid/): add a subscription with the address, then tick the new calendar in your calendar app.
   - **Google Calendar (web):** *Other calendars → From URL*.
   - **iPhone / Mac:** *Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar*.

Notes:

- The address has to be reachable from the phone, so set `PUBLIC_URL` in `.env` to Traktor's `https://` address (Google Calendar needs a public one). Without it, the copied address uses whatever host you opened `/auth` with.
- Episodes of one season that air on the same day, such as a streaming release, are one event (`Show S02 (E01-E10)`) with every episode listed in its description. Weekly shows get one event per episode. Movies are all-day events.
- The feed covers about the next month and is cached for an hour. Calendar apps refresh it every few hours, so new episodes can take a while to show.
- Anyone with a user's address can see that user's upcoming shows, and nothing else. Keep it private.

---

Unofficial project. Not affiliated with or endorsed by Trakt or AIOStreams. MIT licensed.

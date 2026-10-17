<p align="center"><img src="logo.svg" width="96" alt=""></p>

# Traktor

Syncs AIOStreams with Trakt, one Trakt account per AIOStreams user.

- Plays from the AIOStreams app and Jellyfin clients go to Trakt.
- Your Trakt progress, history, watchlist, ratings and dropped shows fill Continue Watching and Next Up.
- Your Trakt lists (recommendations, favorites, collection, your own, smart and liked lists, and Trakt's charts) can show as catalogs.

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

---

Unofficial project. Not affiliated with or endorsed by Trakt or AIOStreams. MIT licensed.

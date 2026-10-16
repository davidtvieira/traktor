<p align="center"><img src="logo.svg" width="96" alt=""></p>

# Traktor

Syncs AIOStreams with Trakt, one Trakt account per AIOStreams user.

- Plays from the AIOStreams app and Jellyfin clients go to Trakt.
- Your Trakt progress, history, watchlist, ratings and dropped shows fill Continue Watching and Next Up.

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

   This pulls `ghcr.io/davidtvieira/traktor`. To build from source instead: `docker compose -f compose.yaml -f compose.build.yaml up -d --build`.

## Install in AIOStreams

1. **Addons → Marketplace → Custom Addon**, paste `http://<host-ip>:7100/manifest.json` (add `/<ADDON_SECRET>` before `/manifest.json` if set), **Install**, then **Save**.
2. Reload the page. Under **Save & Install → Users, trackers and playback → Trackers**, check that every user has this addon picked. If not, pick it under **Users → \<user\> → \<this addon\>**.

## Connect Trakt accounts

Open `http://<host-ip>:7100/auth`. For each AIOStreams user:

1. Click **Connect**, sign in to Trakt as that person, click **Open Trakt** and approve.
2. Trakt redirects to your redirect URI, which may show an error. Copy the full address from the address bar (it contains `?code=...`), paste it in the form and click **Finish**.

Each user has one button: **Connect**, **Disconnect** (unlinks the user) or **Reconnect** (shown when Trakt rejected the saved login). Users who share the primary user's history use the primary user's account.

## Files

- `data/tokens.json`: the Trakt logins. Back it up; losing it means reconnecting everyone.
- `data/cache.json`: speeds up restarts. Safe to delete.

## Troubleshooting

- **`invalid_redirect`:** `TRAKT_REDIRECT_URI` must be `https://` and match the Trakt app exactly.
- **"Expired or invalid" after pasting:** the Connect link lasts 15 minutes. Click **Connect** and try again.
- **`/auth` shows an AIOStreams error:** check `AIOSTREAMS_URL`, `AIOSTREAMS_UUID` and `AIOSTREAMS_PASSWORD`.
- **Tracker shows "Failed":** wait a few minutes and check `docker compose logs`.
- **Health check:** `GET /healthz`.

---

Unofficial project. Not affiliated with or endorsed by Trakt or AIOStreams. MIT licensed.

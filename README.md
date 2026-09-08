# Yijian Liu — Personal Homepage

A focused, static personal site for Yijian Liu. It presents research in lattice cryptography alongside a more personal cultural layer: music, Manchester City, snooker, and animation.

## Run locally

Open `index.html` directly in a browser, or serve this directory with any static-file server. The record shelf lives at `soundness.html`; selecting an album updates the compact Spotify player, with a direct Spotify link as fallback.

## Update content

- Academic copy and publications: `index.html`
- Record shelf and album links: `soundness.html`
- Visual design and responsive behavior: `styles.css`
- Navigation, album playback, reveals, and email copying: `script.js`
- Anonymous public album recommendations: `recommendations.js`; API and database: `recommendations/`

## Album recommendations

The last record sleeve links to a form for an album, artist, optional note, and optional name. Recommendations are public and saved in D1 through a small Sites-hosted Worker; visitors do not need accounts. The rest of the site remains on GitHub Pages.

The API URL is set on the `data-recommendations-api` attribute in `soundness.html`. The client displays submitted text as text, and only reports success after the API confirms a saved record. The API validates fields, limits request size, and permits one post per minute per daily keyed IP hash. Raw IP addresses are not stored or exposed.

For local development, run `npm ci` and `npm run dev` inside `recommendations/`, then serve this site's root at `http://127.0.0.1:4173`. The local frontend uses the local API at port 8787. Local records persist in `recommendations/.dev-data/` and are separate from production. Run `npm test` in `recommendations/` for persistence, pagination, validation, and cooldown checks.

The API's Sites project is recorded in `recommendations/.openai/hosting.json`. Set `RATE_LIMIT_SECRET` as a Sites secret before publishing. Schema changes go through `db/schema.ts` and `npm run db:generate`; keep the generated migrations. `npm run build` produces the Worker for the Sites packaging flow. Publish API updates separately from GitHub Pages changes.

### Spotify album autocomplete

The form can search Spotify by artist and partial album title, show covers and release years, and fill the album/artist fields from a selected result. Recommendations optionally retain the Spotify album ID and show a link to that record. Visitors do not sign in; the server uses Spotify's Client Credentials flow. Search appears only when the service has both credentials, and manual recommendations remain available during search failures or rate limits.

1. Sign in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app. Spotify currently requires the app owner to have Premium. Suggested name: **Soundness**; description: **Album search for the public recommendation wall at icarid-liu.me**; website: `https://icarid-liu.me`; API: **Web API**. If a Redirect URI is required, `http://127.0.0.1:3000` is the placeholder used in Spotify's getting-started guide; this app does not use a login callback.
2. Open the app's Settings to obtain the Client ID and Client Secret. For local development, copy `recommendations/.env.example` to `recommendations/.env.local` and fill `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. That file is ignored by Git. Never place either value in frontend files or commit the secret.
3. For production, configure those two values as secrets in the existing Sites service and publish a new deployment. `SPOTIFY_MARKET` is optional and defaults to `HK`; it controls which regional catalog Spotify returns. `/api/spotify/status` exposes only an enabled boolean, never credentials.

The search waits 350 ms after typing and supports Chinese input composition, arrow keys, Enter, and Escape. The service caches app tokens and results, retries authorization once, and respects Spotify's `Retry-After`. Development-mode quotas still apply. `npm test` checks catalog response handling with a mock Spotify service, plus real local D1 persistence of selected and manual recommendations. Full catalog access must also be checked with the configured application before considering search activated.

References: [Client Credentials](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow), [Search](https://developer.spotify.com/documentation/web-api/reference/search), [Creating an app](https://developer.spotify.com/documentation/web-api/tutorials/getting-started), [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

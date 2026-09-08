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

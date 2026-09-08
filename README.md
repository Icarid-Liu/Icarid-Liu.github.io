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

### Free album autocomplete

The browser queries the public **iTunes Search API** directly (the endpoint permits cross-origin GET requests) by artist and partial album title. No music account, API key, Premium subscription, or developer app is required. Selected records fill the album and artist fields and retain an optional Apple Music album ID. Public recommendations link to that album and can also open a Spotify search; existing Spotify album links remain supported. Catalog results show text metadata (album, artist, year).

Search uses the Hong Kong storefront. Coverage and spelling depend on that catalog, so manual entry is always available. Combined queries that miss a short title (such as `王菲 寓`) fall back to an artist search and filter its returned titles. Cached artist results also support refining an album title without another catalog request.

The frontend waits for a pause in typing and spaces requests by at least 3.2 seconds. Each page coalesces identical requests, caches up to 100 queries for ten minutes, budgets at most 18 upstream calls per rolling minute, and respects upstream `Retry-After`. Direct browser queries avoid sharing the hosting service’s outbound catalog quota. Provider limits and shared visitor IP addresses can still affect availability. The manual form still works during search outages or quota exhaustion.

Run `npm test` inside `recommendations/` for catalog normalization, partial-title fallback, caching, failure handling, and database migration/persistence checks. Publish the API and GitHub Pages frontend separately. No music secrets need configuring.

Reference: [Apple's iTunes Search API documentation](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html).

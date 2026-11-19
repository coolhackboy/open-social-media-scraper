# Contributing

Thanks for helping improve Open Social Media Scraper! Bug reports, endpoint fixes, UI polish and docs are all welcome.

## Develop

```bash
git clone https://github.com/coolhackboy/open-social-media-scraper.git
cd open-social-media-scraper
npm install
npm run dev            # http://localhost:5173
```

Open `http://localhost:5173/?mock=1` to use **demo mode**: submit, status, files and account are served locally from
the documented example responses, so you can work on the UI without an API key or spending credits. An input value
containing "fail" produces a failed task. Demo mode keeps its own IndexedDB databases.

Before opening a PR:

```bash
npm run lint
npm test               # cost estimate + catalog reference tests (Node 22.6+)
npm run catalog:check  # validates src/data/catalog.json and fixtures.json
npm run build          # type-checks and builds
```

## Where things live

| Path | What |
| --- | --- |
| `src/ui/` | Generic primitives (Button, Dialog, Menu, Segmented, Toggle…). No product logic. |
| `src/index.css` | Design tokens (colors, type, shadows) for the light and dark themes. |
| `src/components/` | Screens: console (endpoint browser, request form), results, listening, templates, history, settings. |
| `src/lib/api.ts` | The only module that knows the SocQ wire format. |
| `src/lib/mock.ts` | Demo-mode backend, loaded only with `?mock=1`. |
| `src/lib/runner.ts` | Submit, poll with backoff, paging, resume after reload. |
| `src/lib/schema.ts` | JSON Schema → form fields, validation and request body. |
| `src/lib/cost.ts` | Credit estimates for every billing mode. |
| `src/lib/normalize.ts` | Reads normalized result items into table columns. |
| `src/config.ts` | Brand and backend configuration (read from `VITE_*` env vars). |
| `src/data/catalog.json` | Generated endpoint catalog (schemas, docs examples, billing). |
| `src/data/fixtures.json` | Generated demo responses (documented examples, nothing invented). |

## Updating the catalog

The catalog is generated, never edited by hand:

```bash
# apis.json: endpoint names, categories and billing; agent-api.json: the public OpenAPI file
node scripts/build-catalog.mjs --apis apis.json --openapi agent-api.json --docs ../socq-docs
node scripts/build-fixtures.mjs --docs ../socq-docs
npm run catalog:check -- --live     # optional: compare with the public GET https://api.socq.ai/v1/catalog
node scripts/readme-platforms.mjs   # refresh the README table
```

Each source can also be read from a git ref (`--apis-git <repo>@<ref>:<path>`, `--docs-git <repo>@<ref>`).
`build-catalog.mjs` prints every mismatch between the metadata and the OpenAPI paths.

## Guidelines

- Keep `src/ui` free of SocQ- or endpoint-specific code so it stays reusable.
- Use the design tokens (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent-strong`…) instead of raw colors.
- Label controls, keep focus rings, and test with Tab and Esc.
- Never log the key, persist it outside `localStorage`, or send it anywhere except the configured API base.
- Do not add requests to other hosts. If a feature needs one, make it opt-in and list it in the README's Privacy section.
- Only public data. No wording or features about bypassing logins, rate limits or detection.

## Reporting issues

Use the issue templates. For API errors include the endpoint id, the request (use **Copy as cURL**; it never contains
your key), the task id and the error message shown in the app.

By contributing you agree that your contributions are licensed under the MIT License.

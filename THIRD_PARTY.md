# Third-party notices

The application code is MIT-licensed (see [LICENSE](LICENSE)). It bundles or depends on the following third-party
assets and packages.

## Fonts (self-hosted, bundled into the build)

| Font | Package | License |
| --- | --- | --- |
| IBM Plex Sans (400, 500, 600; Latin subset) | [`@fontsource/ibm-plex-sans`](https://github.com/fontsource/font-files/tree/main/fonts/google/ibm-plex-sans) | SIL Open Font License 1.1, © IBM Corp. ([source](https://github.com/IBM/plex)) |
| IBM Plex Mono (400, 500; Latin subset) | [`@fontsource/ibm-plex-mono`](https://github.com/fontsource/font-files/tree/main/fonts/google/ibm-plex-mono) | SIL Open Font License 1.1, © IBM Corp. ([source](https://github.com/IBM/plex)) |

Fonts are served from the same origin as the app; no font CDN is contacted.

## Icons

| Icons | Package | License |
| --- | --- | --- |
| Lucide | [`lucide-react`](https://github.com/lucide-icons/lucide) | ISC (portions derived from Feather, MIT) |

Platform badges in the app are plain text monograms (for example "TT", "YT"); no third-party logos are included.
The app mark (`public/favicon.svg`) is original to this project.

## Runtime npm dependencies

| Package | License |
| --- | --- |
| react, react-dom, scheduler | MIT |
| zustand | MIT |
| idb-keyval | Apache-2.0 |
| clsx | MIT |
| lucide-react | ISC |
| @fontsource/ibm-plex-sans, @fontsource/ibm-plex-mono | OFL-1.1 |

Build tooling (Vite, Tailwind CSS, TypeScript, ESLint and their dependencies) is used only at build time. None of the
npm dependencies, runtime or build-time, is GPL or AGPL licensed.

## Data

`src/data/catalog.json` (endpoint names, descriptions, input schemas, billing) and `src/data/fixtures.json` (demo
responses) are generated from SocQ's public API documentation and OpenAPI file. The demo responses are the documented
example responses (string values over 300 characters are shortened); they contain public sample data shown on
docs.socq.ai.

# ⚡ Stroom — Belgian Dynamic Electricity Price Watchdog

A mobile-first PWA that tracks Belgian (Belpex day-ahead) hourly electricity
prices, alerts you via push notifications when prices are negative or
expensive, and overlays your actual consumption from a Fluvius digital-meter
export so you can see what each hour really cost you.

## Features

- **Hourly price chart** — colour-coded bars (green = you earn money,
  blue = below zero, amber = cheap, red = expensive) with configurable
  thresholds, day navigation back to 2022, and a fullscreen landscape mode.
- **Live price card** — shows the current hour's price and alert level.
- **Push notifications** — twice-daily cron checks the current price and
  notifies subscribers when it crosses their personal thresholds.
- **Fluvius import** — drop in a *kwartiertotalen* CSV export from
  [mijn.fluvius.be](https://mijn.fluvius.be); consumption/injection is
  aggregated per hour, stored locally (localStorage — it never leaves your
  device), and drawn on the chart's right axis.
- **Period overview** — day/week/month totals: consumption, injection,
  actual cost vs. a fixed-price reference, savings and average price.
- **PWA** — installable, offline shell via a service worker.

## Tech stack

[SvelteKit 2](https://kit.svelte.dev) (Svelte 5 runes) · TypeScript ·
Tailwind CSS 4 · Chart.js · Vercel (functions, KV, cron) · web-push.

## Price sources

Prices are fetched server-side with a fallback chain:

1. **Eneco BE** dynamic pricing API (primary, no auth)
2. **APX Group** REST API (fallback, no auth)
3. **ENTSO-E** Transparency Platform (fallback, needs `ENTSOE_API_KEY`)

Day-ahead prices for past days never change, so the API responses are
edge-cached for a week; today/tomorrow use a 1-hour TTL (tomorrow's prices
publish around 13:00 CET).

## Getting started

```bash
npm install            # also installs the git hooks via husky
cp .env.example .env   # fill in the variables — see comments in the file
npm run dev
```

| Script            | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Start the dev server                           |
| `npm run build`   | Production build (Vercel adapter)              |
| `npm run preview` | Preview the production build                   |
| `npm run check`   | `svelte-check` type checking (also runs pre-push) |
| `npm run icons`   | Regenerate PWA icons from `static/icons/icon.svg` |
| `npm run deploy`  | Release (auto minor bump + changelog + tag) and push `dev` |
| `npm run release:dry` | Preview the next release (version bump + changelog) without changing anything |

### Environment variables

See [.env.example](.env.example) for the full annotated list: VAPID keys for
web push, optional `ENTSOE_API_KEY`, `CRON_SECRET`, and Vercel KV credentials
(auto-injected on Vercel; an in-memory fallback is used locally).

## Project structure

```
src/
├── lib/
│   ├── apiParser.ts          # Eneco / APX / ENTSO-E fetchers + parsers
│   ├── fluviusParser.ts      # Fluvius CSV → hourly consumption/injection
│   ├── priceUtils.ts         # Belgian time/date helpers, thresholds, formatting
│   ├── stores.svelte.ts      # user settings (thresholds), localStorage-backed
│   ├── meterStore.svelte.ts  # imported meter data, localStorage-backed
│   ├── notifications.ts      # client-side push subscribe/unsubscribe
│   ├── server/subscriptions.ts  # push subscriptions in Vercel KV
│   └── components/           # PriceChart, CurrentPriceCard, AlertBadge
├── routes/
│   ├── +page.svelte          # main chart + period overview
│   ├── settings/             # thresholds, notifications, Fluvius import
│   └── api/
│       ├── prices/           # GET ?date=YYYY-MM-DD (single day)
│       ├── prices/range/     # GET ?from=…&to=… (≤ 31 days)
│       ├── subscribe/        # POST/DELETE push subscriptions
│       ├── notify/test/      # POST test notification
│       └── cron/notify/      # cron-invoked price alert dispatch
└── service-worker.ts         # offline shell + push event handling
```

## Deployment (Vercel)

- **Functions** are pinned to `fra1` (Frankfurt) — closest region to both
  the users and the Belgian price APIs.
- **Cron jobs** (`vercel.json`) hit `/api/cron/notify` twice a day; the
  endpoint is protected by `CRON_SECRET` (Vercel sends it automatically as a
  bearer token). Crons only run on the production deployment.
- **Vercel KV** stores push subscriptions and per-hour notification
  de-duplication keys.
- Every push to any branch gets a **preview deployment**; the production
  branch (set in Vercel → Settings → Git) deploys to production.

## Branching, versioning & releases

This repo uses [Conventional Commits](https://www.conventionalcommits.org)
with [semantic versioning](https://semver.org), designed to run entirely on
**free GitHub + free Vercel** — no GitHub Actions, no paid CI:

- Commit messages are enforced locally by git hooks (husky + commitlint);
  `pre-push` runs the type check.
- Release with `npm run deploy`: it bumps the **minor** version, updates
  `CHANGELOG.md` from the commit messages since the last release, commits,
  tags `vx.y.z`, and pushes `dev` with tags — the version number is computed
  automatically, no manual tagging.
- Deploy to production by merging `dev` into `main` (PR) — Vercel builds the
  release commit with the new version baked in.
- The deployed version (e.g. `v0.2.0`) shows in the settings-page footer,
  and the changelog is readable in-app at `/changelog`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and
commit-message examples.

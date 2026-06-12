# Contributing

This project is set up to run on the **free tiers** of GitHub and Vercel.
Quality gates run locally via git hooks, Vercel's build is the deploy check,
and a single GitHub Actions workflow cuts releases automatically on merge to
`main`.

## Branching strategy

- **`dev`** is the default branch; **`main`** is the release branch (point
  Vercel's Production Branch at it).
- Develop on short-lived feature branches and open a PR into `dev`; every
  branch push gets a free Vercel **preview deployment** to click around in
  before merging.
- Promote `dev → main` via a PR to release — the release workflow takes it
  from there (see below).

## Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
and drive the version number computed at release time:

| Example                                      | Release (pre-1.0) |
| -------------------------------------------- | ----------------- |
| `fix(chart): align kWh axis zero`            | patch             |
| `perf(api): cache past days for a week`      | patch             |
| `feat(settings): add weekly summary toggle`  | patch¹            |
| `feat(api)!: drop v1 prices endpoint`        | minor¹            |
| `docs: …` / `chore: …` / `test: …`           | none              |

¹ While the version is below 1.0.0, bumps are automatically lowered one
level (`feat` → patch, breaking → minor), per semver's "anything may change
in 0.x" convention. From 1.0.0 on: `feat` → minor, breaking → major.

Format: `type(scope?): imperative summary` — lower-case type, no trailing
period. Add a body when the *why* isn't obvious. Breaking changes need `!`
after the type/scope or a `BREAKING CHANGE:` footer.

Common scopes in this repo: `chart`, `api`, `parser`, `settings`, `push`,
`pwa`, `deps`.

## Git hooks (installed automatically by `npm install`)

| Hook         | Runs                           | Purpose                           |
| ------------ | ------------------------------ | --------------------------------- |
| `commit-msg` | `commitlint`                   | rejects non-conventional messages |
| `pre-push`   | `npm run check` (svelte-check) | keeps `dev` type-clean            |

Bypass in an emergency with `git commit --no-verify` / `git push --no-verify`.

## Cutting a release / deploying

**Versioning rule: every release is a minor bump** (`0.1.0 → 0.2.0 → 0.3.0`),
regardless of commit types — commit types still determine how entries are
grouped in the changelog.

Releases are automatic: merge `dev` into `main` (via a PR) and the release
workflow ([.github/workflows/release.yml](.github/workflows/release.yml))
does the rest:

1. `commit-and-tag-version` reads the conventional commits since the last
   tag, bumps `package.json`/`package-lock.json`, and prepends the release
   notes to `CHANGELOG.md`;
2. the result is committed as `chore(release): x.y.z`, tagged `vx.y.z`, and
   pushed to `main` — which triggers the production deployment of the
   release commit;
3. the release commit is merged back into `dev` so versions stay in sync
   (best effort — merge `main` into `dev` manually if that step reports a
   conflict).

To preview what the next release would look like, run locally:

```bash
npm run release:dry    # version bump + changelog preview, changes nothing
```

The deployment bakes the new version into the app — it appears in the
settings-page footer as `v0.2.0 · build <sha>`, and the full `CHANGELOG.md`
is rendered in-app at `/changelog` ("Wat is er nieuw", linked from the
settings footer).

## Vercel (Hobby plan) notes

- **Cron jobs**: Hobby allows up to 2 cron jobs, each triggered once per
  day — `vercel.json` defines exactly 2 daily schedules. Don't add more
  without upgrading.
- **Functions** are pinned to one region (`fra1`), which is the Hobby limit.
- **KV / Redis**: provision the free Upstash Redis integration from the
  Vercel Marketplace and link it to the project; the `KV_REST_API_*`
  variables are injected automatically.
- Preview deployments (every branch push) are free and unlimited for
  personal use.

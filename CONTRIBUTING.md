# Contributing

This project is set up to run entirely on the **free tiers** of GitHub and
Vercel: there are no GitHub Actions workflows. Quality gates run locally via
git hooks, releases are cut locally, and Vercel's build is the deploy check.

## Branching strategy

- **`dev`** is the default branch *and* the Vercel production branch — the
  simplest setup that works on the free tier.
- Optional: develop on short-lived feature branches and open a PR into
  `dev`; every branch push gets a free Vercel **preview deployment** to
  click around in before merging.
- Optional later upgrade: create a `main` branch, point Vercel's Production
  Branch at it, and promote `dev → main` when releasing. Nothing in the
  tooling needs to change for that.

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

## Cutting a release

Releases are local — run them from an up-to-date `dev` on your own machine:

```bash
npm run release:dry    # preview: version bump + changelog, changes nothing
npm run release:beta   # prerelease: 0.1.1-beta.0, -beta.1, …
npm run release        # stable:     0.1.1
git push --follow-tags origin dev
```

`commit-and-tag-version` reads the conventional commits since the last tag,
bumps `package.json`/`package-lock.json`, prepends the release notes to
`CHANGELOG.md`, commits (`chore(release): x.y.z`) and tags `vx.y.z`.

The push triggers a Vercel deployment of the release commit, which bakes the
new version into the app — it appears in the settings-page footer as
`v0.1.1 · build <sha>`. `CHANGELOG.md` is the release-notes record (GitHub's
Releases page isn't used, since publishing there would require CI or manual
steps).

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

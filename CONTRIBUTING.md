# Contributing

This project is set up to run entirely on the **free tiers** of GitHub and
Vercel: there are no GitHub Actions workflows. Quality gates run locally via
git hooks, releases are cut locally, and Vercel's build is the deploy check.

## Branching strategy

- **`dev`** is the default branch; **`main`** is the release branch (point
  Vercel's Production Branch at it).
- Develop on short-lived feature branches and open a PR into `dev`; every
  branch push gets a free Vercel **preview deployment** to click around in
  before merging.
- Promote `dev → main` via a PR to deploy a release to production (see
  below).

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

The version number is computed automatically from the commits — never edit
it or create tags by hand. Run the release from an up-to-date `dev` on your
own machine:

```bash
npm run deploy         # release + push dev in one go
```

or step by step:

```bash
npm run release:dry    # preview: version bump + changelog, changes nothing
npm run release:beta   # prerelease of the next minor: 0.2.0-beta.0, -beta.1, …
npm run release        # next minor: 0.2.0
git push --follow-tags origin dev
```

`commit-and-tag-version` reads the conventional commits since the last tag,
bumps `package.json`/`package-lock.json`, prepends the release notes to
`CHANGELOG.md`, commits (`chore(release): x.y.z`) and tags `vx.y.z`.

Then merge `dev` into `main` (PR) to deploy to production. The build bakes
the new version into the app — it appears in the settings-page footer as
`v0.2.0 · build <sha>`, and the full `CHANGELOG.md` is rendered in-app at
`/changelog` ("Wat is er nieuw", linked from the settings footer). GitHub's
Releases page isn't used, since publishing there would require CI or manual
steps.

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

# Contributing

## Branching strategy

```
feature/xyz ──PR──▶ dev ──merge──▶ main
                    │               │
                    ▼               ▼
              beta release    stable release
              (x.y.z-beta.n)  (x.y.z) + production deploy
```

- **`dev`** is the integration branch (and the repo default). All work lands
  here via pull requests from short-lived feature branches.
- **`main`** is the release branch. Promote by merging `dev` into `main`
  (prefer a fast-forward / merge commit — do **not** squash, semantic-release
  reads the individual commit messages).
- Every push to `dev` or `main` triggers the **Release** workflow;
  semantic-release decides from the commit messages whether a release is due,
  bumps `package.json`, writes `CHANGELOG.md`, tags, and publishes GitHub
  release notes. On `dev` these are `-beta.n` prereleases.

### One-time setup (if `main` doesn't exist yet)

```bash
git checkout dev && git pull
git checkout -b main && git push -u origin main
```

Then in **Vercel → Settings → Git** set the Production Branch to `main`.
From that point `dev` pushes give you a stable preview/staging URL and only
`main` reaches production.

## Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
and drive the version number:

| Example                                      | Release  |
| -------------------------------------------- | -------- |
| `fix(chart): align kWh axis zero`            | patch    |
| `perf(api): cache past days for a week`      | patch    |
| `feat(settings): add weekly summary toggle`  | minor    |
| `feat(api)!: drop v1 prices endpoint`        | major    |
| `docs: …` / `chore: …` / `ci: …` / `test: …` | none     |

Format: `type(scope?): imperative summary` — lower-case type, no trailing
period. Add a body when the *why* isn't obvious. Breaking changes need `!`
after the type/scope or a `BREAKING CHANGE:` footer.

Common scopes in this repo: `chart`, `api`, `parser`, `settings`, `push`,
`pwa`, `ci`, `deps`.

## Git hooks (installed automatically by `npm install`)

| Hook         | Runs                          | Purpose                          |
| ------------ | ----------------------------- | -------------------------------- |
| `commit-msg` | `commitlint`                  | rejects non-conventional messages |
| `pre-push`   | `npm run check` (svelte-check) | keeps `dev` type-clean           |

Bypass in an emergency with `git commit --no-verify` / `git push --no-verify`
— CI will still catch you.

## CI

Every PR and every push to `dev`/`main` runs the **CI** workflow:
type check (`svelte-check`) + production build. PRs additionally get their
commit messages linted. The **Release** workflow re-runs the type check
before releasing.

## Releases & Vercel

- The release commit (`chore(release): x.y.z [skip ci]`) is pushed back by
  semantic-release; `[skip ci]` stops it from re-triggering workflows.
  Vercel *does* redeploy on it — intentionally, because the app bakes
  `package.json`'s version into the footer (`__APP_VERSION__` in
  `vite.config.ts`).
- Preview deployments: every branch push. Production: pushes to the
  production branch configured in Vercel.
- Cron jobs and KV are production-only concerns; preview deployments share
  the KV store unless you attach a separate one.

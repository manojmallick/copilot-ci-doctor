# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security
- `fix` and `watch` now stage only the files named in the patch (`git add -- <files>`) instead of `git add -A`. Unrelated local changes and the `.copilot-ci-doctor/` cache folder can no longer end up in a fix commit. If the changed files cannot be determined, nothing is applied.
- Redaction rules grew from 12 to 21: added OpenAI/Anthropic project keys, Slack, Stripe, Google API, GitLab, Azure, AWS secret keys, JSON Web Tokens, Basic auth and passwords inside URLs. The OpenAI rule now matches any `sk-…` key of 20 or more characters, not only the old 48-character form.

### Added
- `action.yml`: an experimental composite GitHub Action that runs `analyze --json` on a failed workflow run and posts (or updates) a pull request comment. See `docs/github-action.md`.
- `docs/examples.md`: three worked examples (missing lockfile, failing test, lint error) and a `docs/github-action.md` guide.
- Options: `analyze --repo/--run-id/--branch`, `explain`/`retry` with the same selectors, `fix --dry-run/--min-confidence/--json`, `watch --max-iterations/--min-confidence/--poll-interval/--poll-timeout/--base/--no-pr/--dry-run/--json`, and `demo --yes/--public`. `--json` prints a single JSON document on stdout with progress on stderr; `--help` lists the exit codes.
- End-to-end tests that run the real CLI against a temporary git repository with a fake `gh`: option validation, `--json`, `--dry-run`, `--min-confidence`, patches that do not apply, and the `demo` confirmation.
- Automated tests (`npm test`, Node's built-in runner): redaction, patch normalisation and file detection, JSON extraction, response contract, helpers and the CLI, plus integration tests that run `git apply` and staging against a real temporary repository.
- GitHub Actions workflow `ci.yml`: syntax check, tests, CLI smoke test and package check on Node 18, 20 and 22 for every push to `main` and every pull request. The npm publish workflow now runs the tests too.

### Changed
- **Behaviour change: exit codes.** Commands now exit `0` when done, `1` on error and `2` when they ran correctly but did not fix anything (confidence too low, patch declined or not applicable, iteration or time limit reached). These cases used to exit `0`. Scripts that treated `0` as "gave up or fixed" should check for `2` as well.
- **Behaviour change: `demo`** now asks before creating a GitHub repository, and creates a **private** one (it used to create a public repository without asking). Use `--yes` to skip the question and `--public` for a public repository. Without a terminal and without `--yes` nothing is created.
- `fix` without `--yes` and without a terminal no longer applies anything.
- Invalid option values are rejected up front with a clear message.
- The duplicated patch-normalising code in `fix.js` and `watch.js` now lives in one module, `src/utils/patch.js`.

### Fixed
- `copilot-ci-doctor --version` now reports the version from `package.json` (it printed a fixed `1.0.0`).
- `watch` now opens its pull request against the repository's default branch instead of always using `main`.

### Documentation
- Documentation site (VitePress, GitHub Pages) built from `docs/` by `scripts/sync-docs.mjs`; deployed by `.github/workflows/docs.yml`. Pull requests only build it, so a dead link fails the PR.
- Added `docs/README.md` (index) and `docs/configuration.md` (defaults, fixed limits, credentials, files written). Corrected the troubleshooting entry that said there is no branch option.
- Corrected the README and hackathon notes, which still said `demo` creates a public repository (it asks first and is private by default since the options update).
- Restructured the README for everyday use and moved the details to `docs/`: commands, how it works, safety and privacy, troubleshooting, releasing.
- Corrected the prerequisites: the `gh-copilot` extension is retired and `gh copilot` now runs the standalone GitHub Copilot CLI.
- Documented what is sent to Copilot, the 12 redaction patterns and their limits, exit behaviour, cache files, and known limitations (`git add -A`, public demo repository).
- Moved the demo GIF to `docs/demo.gif` and referenced it by absolute URL so it renders on npm.
- Added CONTRIBUTING, SECURITY, issue templates and a pull request template.

## [1.1.6]

Last release before this changelog was started. See the [GitHub releases and tags](https://github.com/manojmallick/copilot-ci-doctor/tags) for earlier versions.

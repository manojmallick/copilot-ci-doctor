# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `examples/`: three tested shell scripts (`triage.sh`, `fix-or-hand-off.sh`, `triage-to-markdown.sh`) and three GitHub Actions workflow templates. `test/examples.test.js` runs the scripts against a fake `gh` and checks that the workflows only use inputs `action.yml` defines.

### Documentation
- `docs/recipes.md` (new): ready-to-run scripts and workflows, exit-code handling.
- `docs/examples.md`: six more worked failures (Node version, missing secret, misspelled action, token permissions, Python module, timeout) and a table of which failures `fix` can typically address.
- `docs/commands.md`: a JSON output reference with every `reason` and `outcome` value.
- Documentation site: inline code containing `{{ }}` (for example the `{{EVIDENCE_BUNDLE}}` template name in "How it works") was rendered as an empty element; the sync script now protects it.

## [2.0.0] — 2026-10-24

### Breaking changes and upgrading from 1.x
Three behaviours changed. Everything else in this release only adds things.

| What | 1.x | 2.0.0 | What to do |
|---|---|---|---|
| Exit codes | `0` also when the command ran but did not fix anything (confidence too low, patch declined or not applicable, iteration or time limit reached) | `0` done, `1` error, `2` ran correctly but did not fix | A script or CI step that treated `0` as success must also decide what `2` means. With `set -e` or `&&`, "did not fix" now stops the script. Check `$?` or use `|| true` if you want the old behaviour |
| `demo` | Created a **public** GitHub repository without asking | Asks first and creates a **private** repository. Without a terminal and without `--yes` it creates nothing and fails | Add `--yes` for unattended runs, and `--public` if you want a public repository. Remove it afterwards with `demo --cleanup` |
| `fix` with no terminal | Went to the confirmation prompt | Applies nothing and exits `2` unless `--yes` is given | Add `--yes` in scripts |


### Security
- `fix` and `watch` now stage only the files named in the patch (`git add -- <files>`) instead of `git add -A`. Unrelated local changes and the `.copilot-ci-doctor/` cache folder can no longer end up in a fix commit. If the changed files cannot be determined, nothing is applied.
- Redaction rules grew from 12 to 21: added OpenAI/Anthropic project keys, Slack, Stripe, Google API, GitLab, Azure, AWS secret keys, JSON Web Tokens, Basic auth and passwords inside URLs. The OpenAI rule now matches any `sk-…` key of 20 or more characters, not only the old 48-character form.

### Added
- `demo --cleanup`: removes the local demo project and, after asking, deletes the repository `demo` created. It remembers the name in `.copilot-ci-doctor/demo-repo.json` and only ever deletes a repository named `ci-doctor-demo-<number>`. Needs the `delete_repo` permission for the GitHub part.
- `npm run lint` (ESLint 9), run in CI on Node 22.
- `docs/faq.md`: what is sent, GitHub permissions (including the `workflow` scope for fixes that edit workflow files), exit codes, Windows status and cleanup.
- `action.yml`: an experimental composite GitHub Action that runs `analyze --json` on a failed workflow run and posts (or updates) a pull request comment. See `docs/github-action.md`.
- `docs/examples.md`: three worked examples (missing lockfile, failing test, lint error) and a `docs/github-action.md` guide.
- Options: `analyze --repo/--run-id/--branch`, `explain`/`retry` with the same selectors, `fix --dry-run/--min-confidence/--json`, `watch --max-iterations/--min-confidence/--poll-interval/--poll-timeout/--base/--no-pr/--dry-run/--json`, and `demo --yes/--public`. `--json` prints a single JSON document on stdout with progress on stderr; `--help` lists the exit codes.
- End-to-end tests that run the real CLI against a temporary git repository with a fake `gh`: option validation, `--json`, `--dry-run`, `--min-confidence`, patches that do not apply, and the `demo` confirmation.
- Automated tests (`npm test`, Node's built-in runner): redaction, patch normalisation and file detection, JSON extraction, response contract, helpers and the CLI, plus integration tests that run `git apply` and staging against a real temporary repository.
- GitHub Actions workflow `ci.yml`: syntax check, tests, CLI smoke test and package check on Node 18, 20 and 22 for every push to `main` and every pull request. The npm publish workflow now runs the tests too.

### Changed
- Exit codes are now `0` done, `1` error, `2` ran but did not fix, and `--help` lists them (see the breaking changes above).
- `demo` asks before creating a repository, and it is private by default (see the breaking changes above).
- Invalid option values are rejected up front with a clear message.
- The duplicated patch-normalising code in `fix.js` and `watch.js` now lives in one module, `src/utils/patch.js`.

### Fixed
- `copilot-ci-doctor --version` now reports the version from `package.json` (it printed a fixed `1.0.0`).
- `watch` now opens its pull request against the repository's default branch instead of always using `main`.

### Documentation
- The demo GIF in the README and on the site is 2.4 MB (it was 12 MB): 6 frames per second at 640 px, sped up about 6 times.
- README: platform note (macOS and Linux tested, Windows untested) and the `workflow` scope requirement.
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

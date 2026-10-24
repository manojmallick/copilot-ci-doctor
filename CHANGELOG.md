# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security
- `fix` and `watch` now stage only the files named in the patch (`git add -- <files>`) instead of `git add -A`. Unrelated local changes and the `.copilot-ci-doctor/` cache folder can no longer end up in a fix commit. If the changed files cannot be determined, nothing is applied.
- Redaction rules grew from 12 to 21: added OpenAI/Anthropic project keys, Slack, Stripe, Google API, GitLab, Azure, AWS secret keys, JSON Web Tokens, Basic auth and passwords inside URLs. The OpenAI rule now matches any `sk-…` key of 20 or more characters, not only the old 48-character form.

### Added
- Automated tests (`npm test`, Node's built-in runner): redaction, patch normalisation and file detection, JSON extraction, response contract, helpers and the CLI, plus integration tests that run `git apply` and staging against a real temporary repository.
- GitHub Actions workflow `ci.yml`: syntax check, tests, CLI smoke test and package check on Node 18, 20 and 22 for every push to `main` and every pull request. The npm publish workflow now runs the tests too.

### Changed
- The duplicated patch-normalising code in `fix.js` and `watch.js` now lives in one module, `src/utils/patch.js`.

### Fixed
- `copilot-ci-doctor --version` now reports the version from `package.json` (it printed a fixed `1.0.0`).
- `watch` now opens its pull request against the repository's default branch instead of always using `main`.

### Documentation
- Restructured the README for everyday use and moved the details to `docs/`: commands, how it works, safety and privacy, troubleshooting, releasing.
- Corrected the prerequisites: the `gh-copilot` extension is retired and `gh copilot` now runs the standalone GitHub Copilot CLI.
- Documented what is sent to Copilot, the 12 redaction patterns and their limits, exit behaviour, cache files, and known limitations (`git add -A`, public demo repository).
- Moved the demo GIF to `docs/demo.gif` and referenced it by absolute URL so it renders on npm.
- Added CONTRIBUTING, SECURITY, issue templates and a pull request template.

## [1.1.6]

Last release before this changelog was started. See the [GitHub releases and tags](https://github.com/manojmallick/copilot-ci-doctor/tags) for earlier versions.

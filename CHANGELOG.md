# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

# Contributing

Thanks for helping improve copilot-ci-doctor. Bug reports, ideas and pull requests are welcome.

## Set up

```bash
git clone https://github.com/manojmallick/copilot-ci-doctor.git
cd copilot-ci-doctor
npm install
node src/cli.js --help      # run from source
```

You need Node.js 18 or newer. To exercise the real flow you also need the GitHub CLI signed in and GitHub Copilot CLI available; see the [requirements](README.md#requirements).

## Project layout

See [docs/how-it-works.md](docs/how-it-works.md#code-layout). `src/cli.js` should stay thin; logic belongs in `src/commands/`, `src/copilot/` and `src/evidence/`.

## Making a change

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Create a branch from `main`.
3. Keep changes focused. Update the docs in `README.md` and `docs/` when behaviour changes, and add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
4. Documentation lives in `docs/`; the site in `docs-vp/` is generated from it (`cd docs-vp && npm install && npm run docs:dev` to preview). Add or update tests for the behaviour you changed, then run `npm test`. The tests use Node's built-in runner (`node --test`), need no extra dependencies and do not call GitHub or Copilot.
5. Try the command you changed against a real or demo repository when it touches GitHub, git or Copilot, and say so in the pull request.
6. Open a pull request using the template. CI runs the tests on Node 18, 20 and 22.

## Safety-sensitive areas

Changes to `src/evidence/redact.js` (secret patterns), `src/commands/fix.js` and `src/commands/watch.js` (applying patches, committing, pushing) deserve extra care. Never print or cache unredacted logs, never force-push, never stage files the patch does not touch, and keep the confidence and risk gates. New redaction rules need a test in `test/redact.test.js`; build fake credentials at runtime instead of committing realistic-looking ones.

## Releases

Maintainers publish with a version tag; see [docs/RELEASING.md](docs/RELEASING.md).

# Examples

Runnable scripts and GitHub Actions workflows for `copilot-ci-doctor`. They are explained in [docs/recipes.md](../docs/recipes.md); typical failures and what to expect from them are in [docs/examples.md](../docs/examples.md).

| File | What it does |
|---|---|
| [`scripts/triage.sh`](scripts/triage.sh) | Print the failed run and the ranked causes; changes nothing |
| [`scripts/fix-or-hand-off.sh`](scripts/fix-or-hand-off.sh) | Apply a fix above a confidence threshold, otherwise tell a person (exit `10`) |
| [`scripts/triage-to-markdown.sh`](scripts/triage-to-markdown.sh) | Write the diagnosis to a Markdown file; works without a clone (`REPO=owner/name`) |
| [`workflows/diagnose-on-failure.yml`](workflows/diagnose-on-failure.yml) | Comment the likely cause on the pull request when `CI` fails |
| [`workflows/diagnose-with-token.yml`](workflows/diagnose-with-token.yml) | The same, with a personal access token that has Copilot |
| [`workflows/diagnose-latest-failure-weekly.yml`](workflows/diagnose-latest-failure-weekly.yml) | Weekly report of the latest failure, kept as a build artifact |

The scripts need `copilot-ci-doctor` and `jq` on the `PATH`. They are tested in `test/examples.test.js` against a fake `gh`, so the behaviour described in the docs is checked on every CI run. The workflows are templates: copy one to `.github/workflows/`, adjust the workflow name it watches, and try it on a test repository first (the GitHub Action is experimental).

# Run it in GitHub Actions

`copilot-ci-doctor` ships a composite action (`action.yml` at the repository root) that diagnoses a failed workflow run and posts the ranked hypotheses as a comment on the pull request. It only analyses: it never changes code, pushes or opens pull requests.

> **Status: experimental.** The comment rendering is covered by tests. The end-to-end run in a real workflow depends on GitHub Copilot CLI working with your token on a hosted runner, which has not been verified for every plan and organisation setup. Try it on a test repository first.

## Example workflow

Run it from a `workflow_run` trigger, so it starts after your CI workflow fails:

```yaml
name: Diagnose CI failures

on:
  workflow_run:
    workflows: ["CI"]        # the name of the workflow to watch
    types: [completed]

permissions:
  actions: read              # read the failed run and its logs
  pull-requests: write       # post the comment
  contents: read
  copilot-requests: write    # let the token call Copilot CLI (see below)

jobs:
  diagnose:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: ubuntu-latest
    steps:
      - uses: manojmallick/copilot-ci-doctor@main   # better: pin a release tag, e.g. @v2.0.0, once that tag is published
```

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `run-id` | the triggering `workflow_run` | The failed run to diagnose |
| `github-token` | `github.token` | Token for `gh` and Copilot CLI |
| `version` | `latest` | npm version of `copilot-ci-doctor` to run |
| `comment` | `true` | Post the pull request comment |
| `pr-number` | first pull request of the run | Comment on this pull request instead |

Output: `result-file`, the path of the JSON written by `analyze --json`, for later steps.

## Copilot authentication

Copilot CLI needs a token that is allowed to use Copilot. GitHub documents two routes, see [Use Copilot CLI in Actions](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions) and [Authenticating Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli):

- the built-in `GITHUB_TOKEN` with the `copilot-requests: write` permission (the default here), which needs your organisation's policy to allow Copilot CLI usage; or
- a personal access token from a user with Copilot, stored as a secret and passed as `github-token`. The action exports it as `COPILOT_GITHUB_TOKEN` as well as `GH_TOKEN`.

If the token cannot use Copilot, the step still finishes and the comment shows the error, so you can see what went wrong.

## What it sends and posts

- The same redacted evidence bundle as the CLI (see [safety and privacy](safety-and-privacy.md)) is sent to Copilot. Redaction is pattern-based and best effort.
- The comment contains the run link, a table of hypotheses with confidence and evidence IDs, and the top explanation. It is updated in place on later failures instead of adding new comments.
- The comment is only posted if the failed run has an associated pull request (or you pass `pr-number`); otherwise the step logs the result and stops.

## Limitations

- GitHub Actions only, one failed run at a time.
- Hypotheses come from a language model. Treat the comment as a lead, not a verdict.
- To get a patch, run `copilot-ci-doctor fix --dry-run` in a clone.

# Recipes

Ready-to-run ways to use `copilot-ci-doctor` from the terminal, from scripts and from GitHub Actions. The scripts and workflows live in [`examples/`](https://github.com/manojmallick/copilot-ci-doctor/tree/main/examples); the scripts are covered by automated tests that run them against a fake `gh`, so what is described here is what they do. For typical failures and what to expect from each, see the [worked examples](examples.md).

Scripts need `copilot-ci-doctor` and [`jq`](https://jqlang.github.io/jq/) on the `PATH` and are run from a clone with a failed Actions run. Install the tool with `npm install -g copilot-ci-doctor` (or call it through `npx`).

## Quick reference

| I want to... | Run |
|---|---|
| Diagnose the latest failure, change nothing | `copilot-ci-doctor analyze` |
| Diagnose an older run | `copilot-ci-doctor analyze --run-id 1234567890` |
| Diagnose a failure on another branch | `copilot-ci-doctor analyze --branch release/1.4` |
| Diagnose a repository I have not cloned | `copilot-ci-doctor analyze --repo octocat/hello-world` |
| See the patch without applying it | `copilot-ci-doctor fix --dry-run` |
| Apply only when very confident | `copilot-ci-doctor fix --min-confidence 90` |
| Run unattended with tight limits | `copilot-ci-doctor watch --max-iterations 2 --min-confidence 90 --no-pr` |
| Re-run a flaky failure | `copilot-ci-doctor retry --run-id 1234567890` |
| Use the result in a script | add `--json` and read the exit code |

## Recipe 1: Triage a failure without changing anything

[`examples/scripts/triage.sh`](https://github.com/manojmallick/copilot-ci-doctor/blob/main/examples/scripts/triage.sh) prints the failed run and the ranked causes:

```bash
examples/scripts/triage.sh                              # latest failed run
RUN_ID=1234567890 examples/scripts/triage.sh            # a specific run
BRANCH=release/1.4 examples/scripts/triage.sh           # latest failure on a branch
```

```
Failed run: CI #100 on main
  1. npm ci needs a lockfile  [90%]  evidence: E4
```

It exits `0` when a diagnosis was printed and `1` when the tool failed (for example `No failed GitHub Actions runs found in this repository.` on stderr).

## Recipe 2: Fix when confident, hand off when not

[`examples/scripts/fix-or-hand-off.sh`](https://github.com/manojmallick/copilot-ci-doctor/blob/main/examples/scripts/fix-or-hand-off.sh) runs `analyze`, then `fix --yes --min-confidence` and turns the tool's exit codes into a decision a pipeline can branch on:

```bash
examples/scripts/fix-or-hand-off.sh                     # threshold 85
MIN_CONFIDENCE=95 examples/scripts/fix-or-hand-off.sh
DRY_RUN=1 examples/scripts/fix-or-hand-off.sh           # preview only
```

| Script exit | Meaning | What your pipeline does |
|---|---|---|
| `0` | A fix was applied on a new `ci-fix/*` branch (with `DRY_RUN=1`: the patch applies cleanly) | Push the branch and open a pull request |
| `10` | No safe automatic fix: confidence below the threshold, high risk, or the patch does not apply. The proposal is in `.copilot-ci-doctor/cache/proposed.patch` | Ask a person |
| `1` | The tool itself failed | Fail the job |

The tool never pushes from `fix`; the script does not either. Review the branch before pushing it.

## Recipe 3: Handle the exit codes yourself

Since 2.0.0 the tool exits `0` done, `1` error and `2` ran but did not fix. In your own scripts:

```bash
copilot-ci-doctor fix --dry-run --min-confidence 90 --json > fix.json
case $? in
  0) echo "patch applies: $(jq -r '.files | join(", ")' fix.json)" ;;
  2) echo "no automatic fix: $(jq -r '.reason' fix.json)" ;;   # low-confidence, high-risk, does-not-apply, ...
  *) echo "tool error: $(jq -r '.error' fix.json)" >&2; exit 1 ;;
esac
```

Do not put a bare `copilot-ci-doctor fix` in a `set -e` script and expect it to succeed when the answer is "no fix": that case exits `2` and stops the script. The JSON fields and every `reason` value are listed in [commands](commands.md#json-output).

## Recipe 4: Write the diagnosis to a Markdown file

[`examples/scripts/triage-to-markdown.sh`](https://github.com/manojmallick/copilot-ci-doctor/blob/main/examples/scripts/triage-to-markdown.sh) turns the diagnosis into a table for an issue, a chat message or a job summary. It works on a repository you have not cloned:

```bash
examples/scripts/triage-to-markdown.sh triage.md
RUN_ID=1234567890 REPO=octocat/hello-world examples/scripts/triage-to-markdown.sh triage.md
```

In GitHub Actions you can append the file to the job summary with `cat triage.md >> "$GITHUB_STEP_SUMMARY"`.

## Recipe 5: Review a patch before it exists on a branch

```bash
copilot-ci-doctor analyze
copilot-ci-doctor fix --dry-run --json | jq -r '.patch'
```

`--dry-run` shows the diff and checks that it applies with `git apply --check`. No branch, commit or push is made. The same patch is saved as `.copilot-ci-doctor/cache/proposed.patch`.

## Recipe 6: Unattended `watch` with tight limits

```bash
copilot-ci-doctor watch --max-iterations 2 --min-confidence 90 --no-pr
```

`watch` pushes fix branches, so run it only where that is acceptable (a fork, a throwaway branch, a repository where you can delete `ci-fix/*` branches). `--no-pr` stops it from opening a pull request; `--dry-run` shows what it would do without pushing. See [safety and privacy](safety-and-privacy.md).

## Recipe 7: GitHub Actions workflows

Three workflows in [`examples/workflows/`](https://github.com/manojmallick/copilot-ci-doctor/tree/main/examples/workflows) use the [GitHub Action](github-action.md) (experimental). All of them only analyse; none changes code.

| File | When it runs | Result |
|---|---|---|
| `diagnose-on-failure.yml` | After your `CI` workflow fails | A comment on the pull request, updated on later failures. Uses the built-in token with `copilot-requests: write` |
| `diagnose-with-token.yml` | Same | Same, but with a personal access token of a user who has Copilot, stored as a secret. Use it when the built-in token cannot use Copilot CLI |
| `diagnose-latest-failure-weekly.yml` | Mondays, or on demand | No comment; the JSON diagnosis of the latest failed run is kept as a build artifact |

Copy a file to `.github/workflows/`, change the `workflows: ["CI"]` name to the workflow you want to watch, and pin the action to a release tag instead of `@main` once you have chosen a version. Test it on a repository you do not mind experimenting on first: the Action has not been verified on every Copilot plan and organisation setup.

## Tips

- **Keep the checkout clean.** `fix` and `watch` apply the patch to your working tree; start from a clean checkout of the failing commit.
- **Check what is sent.** Open `.copilot-ci-doctor/cache/latest-evidence.json` after `analyze` to see exactly what Copilot receives.
- **Treat confidence as a hint.** It is the model's own estimate. Raise `--min-confidence` when the cost of a wrong fix is high.

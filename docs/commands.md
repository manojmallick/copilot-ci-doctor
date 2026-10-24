# Commands

All commands run **inside a git clone** of a GitHub repository, using your signed-in `gh` account. Run `copilot-ci-doctor --help` or `copilot-ci-doctor <command> --help` for the built-in help, and `copilot-ci-doctor --version` for the installed version.

## `analyze`

```bash
copilot-ci-doctor analyze
copilot-ci-doctor analyze --repo octocat/hello-world --branch main
copilot-ci-doctor analyze --run-id 1234567890 --json
```

| Option | Meaning |
|---|---|
| `--repo <owner/name>` | Inspect this repository instead of the one you are in |
| `--run-id <id>` | Use this failed run instead of the latest failure |
| `--branch <name>` | Use the latest failed run on this branch |
| `--json` | Print one JSON document on stdout (see [Scripting](#scripting-and---json)) |

Finds a failed GitHub Actions run (the latest by default), collects the evidence bundle (E1 to E5, see [how it works](how-it-works.md)), asks Copilot for ranked root-cause hypotheses with confidence scores, and caches the results.

Writes: `latest-evidence.json`, `latest-hypotheses.json`.

## `explain`

```bash
copilot-ci-doctor explain
copilot-ci-doctor explain --json
```

Explains the failure in plain English, including why it might pass locally and what probably changed. It reuses the evidence cached by `analyze`; if there is none it tells you to run `analyze` first and exits with status 1.

Writes: `latest-explain.json`.

## `fix`

```bash
copilot-ci-doctor fix          # preview, ask, apply
copilot-ci-doctor fix --yes    # skip the confirmation prompt
copilot-ci-doctor fix --dry-run                 # show the diff, check it applies, change nothing
copilot-ci-doctor fix --min-confidence 85       # refuse patches below 85%
copilot-ci-doctor fix --auto   # full loop, identical to `watch`
```

| Option | Meaning |
|---|---|
| `--yes` | Apply without asking. Without it, and without a terminal (CI, a pipe), nothing is applied |
| `--dry-run` | Show the diff and run `git apply --check`; no branch, commit or push |
| `--min-confidence <percent>` | Refuse patches below this confidence (default 60; `watch` default 80) |
| `--json` | Print one JSON document on stdout |
| `--auto` | Run the full loop; accepts the `watch` options below |

Asks Copilot for a minimal patch and then:

1. Refuses to continue automatically if confidence is below 60% or the risk level is HIGH (the patch is saved for manual review).
2. Normalises the patch's `@@` hunk headers, shows the diff (truncated at 400 lines in the terminal) and asks for confirmation unless `--yes` is given.
3. Runs `git apply --check`.
4. Creates a branch named `ci-fix/<YYYYMMDD-HHMMSS>`, applies the patch and commits it with the message `CI Doctor: <description>`.

`fix` does not push. Push the branch and open a PR yourself, or use `watch`.

Writes: `latest-patch.json`, `proposed.patch`, and on failure `git-apply-error.txt`.

> Only the files named in the patch are staged and committed (`git add -- <files>`), so unrelated local changes and the `.copilot-ci-doctor/` cache folder are not included in the fix commit. Applying the patch still needs the affected files to match the failed commit, so a clean checkout of it works best.

## `watch`

```bash
copilot-ci-doctor watch
copilot-ci-doctor watch --max-iterations 3 --min-confidence 90 --no-pr
copilot-ci-doctor watch --dry-run
```

| Option | Default | Meaning |
|---|---|---|
| `--max-iterations <n>` | 5 | Give up after this many fix attempts |
| `--min-confidence <percent>` | 80 | Do not apply a fix below this confidence |
| `--poll-interval <seconds>` | 10 | Seconds between CI status checks |
| `--poll-timeout <seconds>` | 180 | Seconds to wait for a CI run to start or finish |
| `--base <branch>` | repository default branch | Open the pull request against this branch |
| `--no-pr` | | Do not open a pull request when CI is fixed |
| `--dry-run` | | Show the diff and check that it applies; change nothing |
| `--json` | | Print one JSON document on stdout |

Monitors the pipeline and fixes failures in a loop, using one combined Copilot call per iteration:

1. Collect the evidence bundle from the failed run.
2. One combined call returns hypotheses, explanation and patch.
3. Normalise and apply the patch on a `ci-fix/<timestamp>` branch and commit.
4. Push the branch (a normal push, never forced).
5. Poll for the new CI run (every 10 s, up to 180 s).
6. If CI still fails, go back to step 1.

It stops when:

- CI passes, in which case it opens a pull request against the repository's **default branch** with the fix, confidence, root cause, explanation, iteration count and token estimate;
- the fix confidence is below `--min-confidence` (80% by default);
- `--max-iterations` (5 by default) have run;
- applying the patch or pushing fails, or polling times out.

A scoreboard with estimated token usage is printed at the end.

## `retry`

```bash
copilot-ci-doctor retry
copilot-ci-doctor retry --run-id 1234567890 --repo octocat/hello-world
```

Re-runs a failed workflow run (`gh run rerun --failed`): the latest failure by default, or the one given by `--run-id`, `--branch` and `--repo` (same meaning as for `analyze`).

## `demo`

```bash
copilot-ci-doctor demo          # asks before creating anything on GitHub
copilot-ci-doctor demo --yes    # create a private repository without asking
copilot-ci-doctor demo --yes --public
```

Creates a small project with a deliberately broken workflow in `.copilot-ci-doctor/demo-run/`, pushes it to trigger CI, waits for the failure and hands over to `watch`.

> **Side effect:** if the demo project cannot be pushed to an existing remote, the command offers to run `gh repo create ci-doctor-demo-<timestamp> --private` and push there. It asks first; `--yes` answers for you, and without a terminal and without `--yes` the demo stops and creates nothing. The repository is **private** unless you pass `--public`. Delete it when you are done (`gh repo delete <name>`).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Done: analysis printed, patch applied (or, with `--dry-run`, checked), or CI fixed |
| `1` | Error: invalid option, missing tool, no failed run, no cached evidence, or a GitHub, Copilot or git failure |
| `2` | Ran correctly but did not fix: confidence too low, risk HIGH, patch declined or not applicable, or the iteration or time limit was reached |

Invalid option values (for example `--run-id abc` or `--min-confidence 150`) are rejected with exit `1` before any command runs.

## Scripting and `--json`

With `--json`, stdout holds exactly one JSON document and all progress text goes to stderr. Every document has `ok` and `command`:

```bash
copilot-ci-doctor analyze --json | jq '.hypotheses[0]'
copilot-ci-doctor fix --dry-run --json | jq '{files, confidence, reason}'
copilot-ci-doctor fix --yes --min-confidence 90 --json; echo "exit $?"
```

Errors look like `{"ok": false, "command": "fix", "error": "..."}`. For `fix` and `watch`, `applied` says whether anything changed and `reason` explains why not (`dry-run`, `low-confidence`, `declined`, `does-not-apply`).

## Cache files

Everything is stored in `.copilot-ci-doctor/cache/` in the directory where you run the command:

| File | Contents |
|---|---|
| `latest-evidence.json` | The redacted evidence bundle |
| `latest-hypotheses.json`, `latest-explain.json`, `latest-patch.json` | The parsed Copilot responses |
| `proposed.patch` | The patch that was or would be applied |
| `git-apply-error.txt` | Output of a failed `git apply --check` |
| `copilot-raw-output-debug.txt` | Raw Copilot output (redacted), saved when the reply could not be parsed |

Delete the folder at any time; it is rebuilt on the next run.

# Commands

All commands run **inside a git clone** of a GitHub repository, using your signed-in `gh` account. Run `copilot-ci-doctor --help` or `copilot-ci-doctor <command> --help` for the built-in help, and `copilot-ci-doctor --version` for the installed version.

## `analyze`

```bash
copilot-ci-doctor analyze
```

Finds the latest failed GitHub Actions run, collects the evidence bundle (E1 to E5, see [how it works](how-it-works.md)), asks Copilot for ranked root-cause hypotheses with confidence scores, and caches the results.

Writes: `latest-evidence.json`, `latest-hypotheses.json`.

## `explain`

```bash
copilot-ci-doctor explain
```

Explains the failure in plain English, including why it might pass locally and what probably changed. It reuses the evidence cached by `analyze`; if there is none it tells you to run `analyze` first and exits with status 1.

Writes: `latest-explain.json`.

## `fix`

```bash
copilot-ci-doctor fix          # preview, ask, apply
copilot-ci-doctor fix --yes    # skip the confirmation prompt
copilot-ci-doctor fix --auto   # full loop, identical to `watch`
```

Asks Copilot for a minimal patch and then:

1. Refuses to continue automatically if confidence is below 60% or the risk level is HIGH (the patch is saved for manual review).
2. Normalises the patch's `@@` hunk headers, shows the diff (truncated at 400 lines in the terminal) and asks for confirmation unless `--yes` is given.
3. Runs `git apply --check`.
4. Creates a branch named `ci-fix/<YYYYMMDD-HHMMSS>`, applies the patch and commits it with the message `CI Doctor: <description>`.

`fix` does not push. Push the branch and open a PR yourself, or use `watch`.

Writes: `latest-patch.json`, `proposed.patch`, and on failure `git-apply-error.txt`.

> **Start from a clean working tree.** The commit is made with `git add -A`, so any other uncommitted or untracked files in the repository, including the `.copilot-ci-doctor/` cache folder unless your repository ignores it, are included in the fix commit. Add `.copilot-ci-doctor/` to your `.gitignore`.

## `watch`

```bash
copilot-ci-doctor watch
```

Monitors the pipeline and fixes failures in a loop, using one combined Copilot call per iteration:

1. Collect the evidence bundle from the failed run.
2. One combined call returns hypotheses, explanation and patch.
3. Normalise and apply the patch on a `ci-fix/<timestamp>` branch and commit.
4. Push the branch (a normal push, never forced).
5. Poll for the new CI run (every 10 s, up to 180 s).
6. If CI still fails, go back to step 1.

It stops when:

- CI passes, in which case it opens a pull request against the repository's **default branch** with the fix, confidence, root cause, explanation, iteration count and token estimate;
- the fix confidence is below 80%;
- 5 iterations have run;
- applying the patch or pushing fails, or polling times out.

A scoreboard with estimated token usage is printed at the end.

## `retry`

```bash
copilot-ci-doctor retry
```

Re-runs the most recent failed workflow run (`gh run rerun --failed`).

## `demo`

```bash
copilot-ci-doctor demo
```

Creates a small project with a deliberately broken workflow in `.copilot-ci-doctor/demo-run/`, pushes it to trigger CI, waits for the failure and hands over to `watch`.

> **Side effect:** if the demo project cannot be pushed to an existing remote, the command runs `gh repo create ci-doctor-demo-<timestamp> --public` and pushes there. That is a **public repository on your GitHub account**. Delete it when you are done (`gh repo delete <name>`).

## Exit behaviour

| Situation | Exit status |
|---|---|
| Normal completion | `0` |
| Error (for example `gh` missing, no evidence cached for `explain`, `watch` or `demo` failing with an exception, fatal error in the CLI) | `1` |
| Stopped because confidence was too low, the patch was declined or risk was HIGH | `0` |

Because the last row is `0`, scripts cannot rely on the exit status alone to know whether CI was fixed.

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

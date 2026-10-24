# Troubleshooting

## "GitHub CLI (gh) is not installed or not in PATH"

Install the [GitHub CLI](https://cli.github.com) and run `gh auth login`. Check with `gh --version` and `gh auth status`.

## "Copilot CLI invocation failed"

`copilot-ci-doctor` runs `gh copilot -p ... -s`. The old `gh-copilot` extension is retired; current `gh` versions run the standalone GitHub Copilot CLI behind `gh copilot` and ask to install it the first time.

1. Update `gh` to a current version.
2. Run `gh copilot` once on its own, accept the install and sign in.
3. Confirm you have an active GitHub Copilot subscription that includes Copilot CLI.
4. Test with `gh copilot -p "say hello" -s`. If that fails, the problem is outside this tool.

The error text from Copilot is included in the message, so read it for the real cause (authentication, plan, network).

## "Could not retrieve repo info"

Run the command from inside a git clone of a GitHub repository, and make sure `gh auth status` shows you are signed in with access to it.

## No failed run found

By default the tool works on the latest failed GitHub Actions run of the current repository (it looks at the 20 most recent failures). Check `gh run list --status failure --limit 3`. If the failure is on another branch, pass `--branch <name>`; to pick one run use `--run-id <id>`, and to look at a different repository use `--repo OWNER/NAME` (`analyze`, `explain`, `retry`). With `--json` the problem is reported as `{"ok": false, "error": ...}` and exit code 1.

## "No cached evidence bundle found" (explain)

Run `copilot-ci-doctor analyze` first. Evidence is cached in `.copilot-ci-doctor/cache/` in the current directory, so run the commands from the same folder.

## "git apply --check failed"

The patch from the model did not apply cleanly to your working tree, often because the tree has local changes or differs from the failed commit. Details are saved to `.copilot-ci-doctor/cache/git-apply-error.txt` and the patch to `proposed.patch`. Try `git apply --3way .copilot-ci-doctor/cache/proposed.patch`, or fix by hand. Start from a clean checkout of the failing commit.

## "Confidence too low" or "Risk level is HIGH"

This is a safety gate, not an error (exit code 2). The threshold is 60% for `fix` and 80% for `watch`; change it with `--min-confidence`. The proposal is saved in `.copilot-ci-doctor/cache/latest-patch.json` for you to review manually.

## The reply could not be parsed

Look at `.copilot-ci-doctor/cache/copilot-raw-output-debug.txt` (redacted). Running the command again often helps, because model output varies.

## `watch` stops after one iteration

Typical reasons: confidence below 80%, the fix could not be applied or pushed, or CI did not finish within 180 seconds. The scoreboard at the end says which. A push can fail if your account cannot push branches to the repository.

## "Could not determine which files the patch changes"

The model's reply was not a valid unified diff (no `---`/`+++` file headers), so nothing was applied. The proposal is in `.copilot-ci-doctor/cache/proposed.patch`. Run the command again.

## The demo created a repository

When `demo` cannot push elsewhere and you agree (or pass `--yes`), it creates `ci-doctor-demo-<timestamp>`: private by default, public only with `--public`. Remove it with `gh repo delete <name>`. If you answered no, or there was no terminal and no `--yes`, nothing was created.

## `fix` did nothing and exited with 2

Exit code 2 means the command ran but did not fix. Read the last lines of the output or, with `--json`, the `reason` field: `low-confidence` (the patch is below `--min-confidence`; review it by hand, or lower the threshold only if you accept the risk), `declined` (no `--yes` and no terminal, or you answered no), or `does-not-apply` (see "git apply --check failed" above).

## Still stuck?

[Open an issue](https://github.com/manojmallick/copilot-ci-doctor/issues/new/choose) with the command you ran, the output (remove secrets) and the output of `copilot-ci-doctor --version`, `gh --version` and `node --version`.

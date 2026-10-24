# FAQ

## What leaves my machine?

The evidence bundle only: repository name and default branch, metadata of the failed run and its failed jobs and steps, the last 200 log lines and the workflow YAML, after secret redaction. Your source code is not sent, unless it appears in those log lines. You can read exactly what was collected in `.copilot-ci-doctor/cache/latest-evidence.json`. Details and the limits of redaction: [safety and privacy](safety-and-privacy.md).

## Does it work without GitHub Copilot?

No. The reasoning step is `gh copilot -p ... -s`, so you need Copilot CLI access on your plan. Without it, nothing is analysed. See [requirements](../README.md#requirements) and [troubleshooting](troubleshooting.md#copilot-cli-invocation-failed).

## Will it push to my default branch?

No. `fix` and `watch` work on a new `ci-fix/<timestamp>` branch, never force-push, and `watch` opens a pull request against the default branch (or `--base`). `fix` alone does not push at all. `--dry-run` changes nothing.

## Which GitHub permissions does it need?

Short version: read Actions runs, push a branch, open a pull request, and the `workflow` scope if the fix edits files under `.github/workflows/`. The full table is in [Permissions in detail](#permissions-in-detail).

## Can it change my workflow files?

Yes, that is often the fix (a wrong command, a missing step). GitHub only lets a token push changes to `.github/workflows/` if it has the `workflow` permission. With the default `gh auth login` token the push may be refused; run `gh auth refresh -s workflow` and try again.

## Why does it sometimes refuse to apply a patch?

Safety gates, by design. `fix` stops below 60% confidence, `watch` below 80% (change with `--min-confidence`), and neither applies a patch whose risk is HIGH or that fails `git apply --check`. The command then exits with code `2`. The proposal is still saved for you to read: `.copilot-ci-doctor/cache/latest-patch.json` and `proposed.patch`.

## What do the exit codes mean?

`0` done, `1` error, `2` ran correctly but did not fix. See [commands](commands.md#exit-codes).

## Is the answer always the same?

No. A language model produces the hypotheses and the patch, so two runs can differ, and the confidence numbers are the model's own estimate. Run again, or compare with the logs yourself. Treat it as a lead, never as a verdict, and review every patch and pull request.

## Does it fix flaky tests or failures that need my source code?

Only as far as the log and the workflow file allow. It cannot see your application code, so for a failing assertion expect an explanation and a suggestion rather than an applicable patch. See [worked examples](examples.md).

## Does it support other CI systems, or other runs than the latest failure?

GitHub Actions only. By default it takes the latest failed run (looking at the 20 most recent failures); pick another with `--run-id`, `--branch` or `--repo`. There is no option to choose a workflow by name.

## Can it run in CI?

Yes, experimentally: the [GitHub Action](github-action.md) diagnoses a failed run and comments on the pull request. It only analyses; it never changes code.

## What does it cost?

The tool itself is free (MIT). Copilot requests count against your Copilot plan. The token numbers it prints are rough estimates (about 4 characters per token), not billing figures.

## Does it run on Windows?

It is developed and tested on macOS and Linux, and CI runs on Ubuntu only. Windows is untested: if you hit path or quoting problems, use WSL or Git Bash and please [open an issue](https://github.com/manojmallick/copilot-ci-doctor/issues/new/choose) with the details. The end-to-end tests skip on Windows.

## How do I clean up?

Delete `.copilot-ci-doctor/` (cache, rebuilt on demand). To remove the demo project and the repository `demo` created, run `copilot-ci-doctor demo --cleanup` from the directory where you ran `demo`. It asks before deleting anything on GitHub.

## Permissions in detail

| Used for | `gh` token scope (classic) | Fine-grained token |
|---|---|---|
| Read runs, jobs and logs | `repo` (public repositories work without it) | Actions: read |
| `watch`: push the fix branch | `repo` | Contents: write |
| `watch`: open the pull request | `repo` | Pull requests: write |
| Fix edits `.github/workflows/*` | `workflow` | Workflows: write |
| `demo`: create the repository | `repo` | account-level repository creation |
| `demo --cleanup`: delete it | `delete_repo` | not available to every token type |

Check what you have with `gh auth status`; add a scope with `gh auth refresh -h github.com -s <scope>`. Corporate or organisation rules (SSO, branch protection) can add requirements. These are the usual GitHub requirements, not checks this tool performs itself.

# Safety and privacy

## Guarantees the code enforces

- **Secret redaction** runs on all evidence before it is displayed, cached or sent to Copilot (see the patterns below).
- **Confirmation.** `fix` shows the diff and asks before applying, unless you pass `--yes` or `--auto`.
- **Gates.** `fix` does not apply a patch whose confidence is below 60% or whose risk is HIGH. `watch` stops when confidence falls below 80%.
- **New branch.** Changes are committed on a new `ci-fix/<YYYYMMDD-HHMMSS>` branch, not on your current branch's history directly.
- **Pre-flight check.** `git apply --check` runs before a patch is applied; hunk headers are recounted first because language models often get them wrong.
- **No force-push.** `watch` only runs a normal `git push -u origin <branch>`.
- **PR for review.** When CI passes, `watch` opens a pull request against the repository's default branch. It does not merge it.
- **Bounded loop.** At most 5 iterations; each Copilot call has a 180 s timeout.

## What is sent to GitHub Copilot

For every Copilot call the prompt contains the evidence bundle:

| Item | Content |
|---|---|
| E1 | Repository name (`owner/name`), default branch, URL |
| E2 | Failed run metadata: run ID, workflow name, branch, event, conclusion |
| E3 | Failed jobs and steps |
| E4 | The last 200 lines of the failed log, redacted |
| E5 | The matching workflow YAML file, redacted |

Your source files are not attached by this tool, but log lines and YAML can still contain sensitive information. Copilot is invoked with `--no-custom-instructions`, so your `AGENTS.md`-style custom instructions are not loaded.

## Redaction patterns

`src/evidence/redact.js` replaces matches of these patterns with `[REDACTED]`:

| Pattern |
|---|
| GitHub personal access tokens (`ghp_…`), OAuth tokens (`gho_…`), fine-grained tokens (`github_pat_…`), app installation tokens (`ghs_…`), refresh tokens (`ghr_…`) |
| `Bearer <token>` |
| `token: …` or `token=…` followed by 20 or more token characters |
| `password: …` or `password=…` followed by 8 or more characters |
| PEM private key blocks |
| AWS access key IDs (`AKIA…`) |
| OpenAI-style keys of the form `sk-` plus 48 characters |
| npm tokens (`npm_…`) |

That is 12 patterns. Redaction is **best effort**. It does not currently cover, for example, newer OpenAI `sk-proj-…` keys, Slack, Stripe or Google API keys, JWTs, or secrets that appear without a recognisable prefix. Do not rely on it as the only protection: keep secrets out of CI logs (use GitHub's secret masking) and review what a run prints.

## Known gaps to be aware of

- **`git add -A`.** `fix` and `watch` commit with `git add -A`. Other uncommitted or untracked files in the repository, and the `.copilot-ci-doctor/` cache folder (which holds the redacted evidence) are staged too unless your repository ignores them. Start from a clean working tree and add `.copilot-ci-doctor/` to your `.gitignore`.
- **Model output.** Patches are written by a language model. Treat every patch and every pull request like code from an unknown contributor: read it before merging.
- **`demo`** creates a public repository on your account in some cases; see [commands](commands.md#demo).

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md).

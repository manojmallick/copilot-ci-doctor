# Safety and privacy

## Guarantees the code enforces

- **Secret redaction** runs on all evidence before it is displayed, cached or sent to Copilot (see the patterns below).
- **Confirmation.** `fix` shows the diff and asks before applying, unless you pass `--yes` or `--auto`.
- **Gates.** `fix` does not apply a patch whose confidence is below 60% or whose risk is HIGH. `watch` stops when confidence falls below 80%.
- **New branch.** Changes are committed on a new `ci-fix/<YYYYMMDD-HHMMSS>` branch, not on your current branch's history directly.
- **Only the patched files are committed.** After applying a patch, only the files named in the patch are staged (`git add -- <files>`). Other uncommitted or untracked files, and the `.copilot-ci-doctor/` cache folder, are never added to a fix commit. If the files a patch changes cannot be determined, nothing is applied.
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

| Kind | Examples |
|---|---|
| GitHub and GitLab | personal access tokens (`ghp_…`), OAuth (`gho_…`), fine-grained (`github_pat_…`), app installation (`ghs_…`), refresh (`ghr_…`), GitLab (`glpat-…`) |
| Cloud and API providers | AWS access key IDs (`AKIA…`, `ASIA…`) and `aws_secret_access_key` values, Azure `AccountKey=…`, Google API keys (`AIza…`), OpenAI and Anthropic keys (`sk-…`, `sk-proj-…`, `sk-ant-…`), Stripe keys (`sk_live_…`, `rk_test_…`), Slack tokens (`xox…`), npm tokens (`npm_…`) |
| Generic | JSON Web Tokens, `Bearer <token>`, `Basic <base64>`, the password inside a URL (`scheme://user:PASSWORD@host`, host and user are kept), `token: …` / `token=…` with 20 or more characters, `password: …` / `password=…` with 8 or more characters, PEM private key blocks |

That is 21 rules. Redaction is **best effort**: it recognises credential *formats*. It cannot recognise a secret that has no recognisable prefix or label (for example a bare random password printed on its own line). Do not rely on it as the only protection: keep secrets out of CI logs (use GitHub's secret masking) and review what a run prints. The rules are covered by tests in `test/redact.test.js`.

## Known gaps to be aware of

- **Model output.** Patches are written by a language model. Treat every patch and every pull request like code from an unknown contributor: read it before merging.
- **`demo`** creates a public repository on your account in some cases; see [commands](commands.md#demo).

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md).

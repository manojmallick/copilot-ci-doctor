# copilot-ci-doctor 🩺

**From red CI to a green pull request, with evidence, confidence scores and safe fixes.**

[![npm version](https://img.shields.io/npm/v/copilot-ci-doctor)](https://www.npmjs.com/package/copilot-ci-doctor)
[![CI](https://github.com/manojmallick/copilot-ci-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/manojmallick/copilot-ci-doctor/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/copilot-ci-doctor)](https://github.com/manojmallick/copilot-ci-doctor/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/copilot-ci-doctor)](https://nodejs.org)

![copilot-ci-doctor demo](https://raw.githubusercontent.com/manojmallick/copilot-ci-doctor/main/docs/demo.gif)

`copilot-ci-doctor` is a command-line tool that diagnoses failing **GitHub Actions** runs. It collects evidence from the failed run, asks **GitHub Copilot CLI** for ranked root-cause hypotheses, a plain-English explanation and a minimal patch, applies the patch on a new branch, and can loop until CI is green and open a pull request.

It is not a log summariser: every claim is tied to numbered pieces of evidence, every fix is a small `git apply`-checked diff with a confidence score and risk level, and nothing is applied without passing safety gates.

## Quick start

You need Node.js 18 or newer, the [GitHub CLI](https://cli.github.com) (`gh`) signed in, and a GitHub Copilot subscription. See [Requirements](#requirements) for details.

```bash
# Try the end-to-end demo (see the warning about what it creates)
npx copilot-ci-doctor demo

# Or use it in your own repository, from inside a clone with a failed Actions run
npm install -g copilot-ci-doctor
copilot-ci-doctor analyze      # evidence + ranked hypotheses
copilot-ci-doctor explain      # plain-English explanation
copilot-ci-doctor fix          # preview the patch, confirm, apply on a ci-fix/* branch
```

> **`demo` may create a repository on your GitHub account** (named `ci-doctor-demo-<timestamp>`, private unless you pass `--public`) if it cannot push the demo project elsewhere. It asks first; `--yes` skips the question. Delete the repository afterwards.

<details>
<summary>Example output of a <code>watch</code> run</summary>

```
━━━ Iteration 1 ━━━
  Analyze → npm ci requires package-lock.json [95%]
  Fix → Replace 'npm ci' with 'npm install' [95%] → pushed → CI still failing

━━━ Iteration 2 ━━━
  Analyze → Missing test.js file [95%]
  Fix → Create test.js [95%] → pushed → CI passing!

─── Scoreboard ───
  Iterations: 2
  Total time: 126.3s
  Token Usage (estimated): ~3,442 tokens
  CI before: ✖ FAILED → after fix: ✓ PASSING
  🔗 Pull Request: https://github.com/your-org/your-repo/pull/1
```

</details>

## Commands

| Command | What it does |
|---|---|
| `analyze` | Finds the latest failed run, collects evidence and generates ranked root-cause hypotheses with confidence scores |
| `explain` | Explains the failure in plain English (reuses the cached evidence from `analyze`) |
| `fix` | Generates a minimal patch, shows the diff, asks for confirmation and applies it on a new `ci-fix/*` branch. `--yes` skips the prompt, `--dry-run` only previews, `--min-confidence` sets the threshold; `--auto` runs the full loop (same as `watch`) |
| `watch` | Loop: analyze, explain, fix, push, wait for CI. Stops when CI passes (then opens a PR), when confidence drops below 80%, or after 5 iterations (`--min-confidence`, `--max-iterations`, `--no-pr`, `--dry-run` change that) |
| `retry` | Re-runs the most recent failed workflow run |
| `demo` | Creates a deliberately broken demo project and runs `watch` on it. Asks before creating a (private) GitHub repository; `--yes` skips the question |

Useful options: `--repo`, `--run-id` and `--branch` pick the run to inspect; `--json` prints machine-readable output; exit code `0` means done, `1` error, `2` ran but did not fix.

Details, flags and examples: [docs/commands.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/commands.md).

## Use it in CI

The repository ships a composite GitHub Action that diagnoses a failed run and comments on the pull request. It is experimental; read [docs/github-action.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/github-action.md) for the permissions and the Copilot token it needs.

## How it works

1. **Evidence bundle.** Five tagged items are collected with `gh`: repo info (E1), failed run metadata (E2), failed jobs and steps (E3), the last 200 log lines (E4) and the workflow YAML (E5). Everything is passed through secret redaction first.
2. **Copilot CLI.** The bundle is rendered into a prompt and sent with `gh copilot -p "<prompt>" -s --no-custom-instructions`. The reply must be JSON in a strict `CI_DOCTOR_RESPONSE_V1` format that cites evidence IDs.
3. **Safe apply.** The patch is normalised, checked with `git apply --check`, previewed, applied on a new branch and committed.
4. **Watch loop.** The fix is pushed, the new CI run is awaited and the cycle repeats if needed. One combined Copilot call per iteration keeps token use about a third of a naive three-call flow.

Full walkthrough: [docs/how-it-works.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/how-it-works.md).

## Safety and privacy

- Fixes need confirmation unless you pass `--yes` or `--auto`; with no terminal and no `--yes`, nothing is applied. `--dry-run` previews without changing anything. Patches with confidence below 60% or HIGH risk are never auto-applied, and `watch` stops below 80%.
- Changes always go on a new `ci-fix/<timestamp>` branch, never directly on your default branch, and only the files the patch touches are committed. When CI passes, a PR is opened against the repository's default branch.
- No force-pushes.
- **What leaves your machine:** the evidence bundle (repo name and default branch, failed run and job metadata, 200 redacted log lines, the workflow YAML) is sent to GitHub Copilot as part of the prompt. Redaction is pattern-based and best-effort; it does not catch every possible secret.

## npm scripts (for contributors)

| Command | What it does |
|---|---|
| `npm start` | Run the CLI from source (`node src/cli.js`) |
| `npm run test:bin` | Smoke test: runs `src/cli.js --help` |
| `npm run prepublishOnly` | Runs `test:bin` automatically before `npm publish` |

## 🧠 How GitHub Copilot CLI is used (core requirement)

## Requirements

- **Node.js 18 or newer**
- **[GitHub CLI](https://cli.github.com)** (`gh`), authenticated with `gh auth login`
- **GitHub Copilot access.** The old `gh-copilot` extension has been retired. Current versions of `gh` run the standalone GitHub Copilot CLI through `gh copilot` and offer to install it on first use. This tool calls `gh copilot -p … -s`, so run `gh copilot` once on its own to complete that setup and sign in, and check that it works before using `copilot-ci-doctor`. Copilot CLI availability depends on your Copilot plan; see GitHub's [Copilot CLI documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli).
- Run commands **inside a git clone** of a GitHub repository that has a failed Actions run. Your `gh` account needs permission to push branches and open pull requests there.

## Limitations

- GitHub Actions only (no other CI systems).
- By default it works on the **latest failed run**; `--run-id`, `--branch` and `--repo` select another. `fix` and `watch` always apply the patch to the clone you are in, so use `--repo` only with `analyze`, `explain` and `retry`.
- There is no flag to pick a workflow by name.
- Fixes are generated by a language model. Review every patch and pull request before merging.

## Troubleshooting

Common problems (Copilot CLI not found, `gh` not authenticated, patches that fail `git apply --check`, no failed run found) are covered in [docs/troubleshooting.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/troubleshooting.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/commands.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/commands.md) | Every command, flags, examples, exit behaviour, cache files |
| [docs/how-it-works.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/how-it-works.md) | Evidence bundle, Copilot usage, JSON contract, patch handling, token savings, code layout |
| [docs/README.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/README.md) | Index of all documentation and where to find answers |
| [docs/configuration.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/configuration.md) | Option defaults, fixed limits, credentials, files written |
| [docs/github-action.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/github-action.md) | Run it in CI: post a diagnosis as a pull request comment |
| [docs/examples.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/examples.md) | Worked examples: missing lockfile, failing test, lint error |
| [docs/safety-and-privacy.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/safety-and-privacy.md) | Guarantees, what is sent to Copilot, redaction patterns |
| [docs/troubleshooting.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/troubleshooting.md) | Fixes for common problems |
| [docs/HACKATHON.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/HACKATHON.md) | Notes written for the hackathon judges |
| [docs/RELEASING.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/docs/RELEASING.md) | How maintainers publish to npm |
| [CHANGELOG.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/CHANGELOG.md) | Release notes |

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/CONTRIBUTING.md). Report security problems privately as described in [SECURITY.md](https://github.com/manojmallick/copilot-ci-doctor/blob/main/SECURITY.md).

## License

[MIT](https://github.com/manojmallick/copilot-ci-doctor/blob/main/LICENSE)

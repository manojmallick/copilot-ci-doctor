# How it works

## 1. Evidence bundle

Five items are collected with the `gh` CLI. Each has a tag so that the model can cite it.

| Tag | Content | Source |
|---|---|---|
| E1 | Repository info: `owner/name`, default branch, URL | `gh repo view` |
| E2 | Failed run metadata: run ID, workflow, branch, event, conclusion | `gh run list` / `gh run view` |
| E3 | Failed jobs and steps | `gh run view --json jobs`, filtered to failures |
| E4 | Last 200 lines of the failed log, redacted | `gh run view --log-failed`, falling back to `--log` |
| E5 | The workflow YAML, matched by workflow name from `.github/workflows/` | local files |

All text goes through [secret redaction](safety-and-privacy.md) before it is cached, shown or sent.

## 2. Copilot CLI

The evidence is inserted into a prompt template (`{{EVIDENCE_BUNDLE}}`) and sent to GitHub Copilot CLI:

```bash
gh copilot -p "<rendered prompt>" -s --no-custom-instructions
```

| Flag | Meaning |
|---|---|
| `-p` | Run the prompt non-interactively and exit when finished |
| `-s` | Silent: only the model's reply, without usage statistics |
| `--no-custom-instructions` | Do not load `AGENTS.md`-style custom instructions, for more predictable output |

Each call has a 180 second timeout.

Four prompt templates live in `prompts/`:

| Mode | File | Purpose |
|---|---|---|
| `hypotheses` | `prompts/hypotheses.txt` | Ranked root-cause hypotheses |
| `explain` | `prompts/explain.txt` | Plain-English explanation |
| `patch` | `prompts/patch.txt` | Minimal unified diff |
| `combined` | `prompts/combined.txt` | All three in one call (used by `watch`) |

## 3. JSON contract

Copilot must answer with JSON in the `CI_DOCTOR_RESPONSE_V1` format. The tool:

1. extracts the JSON from a fenced block, or the first `{ ... }` block in the reply;
2. checks that `version` is `CI_DOCTOR_RESPONSE_V1` and `mode` is one of the four modes above;
3. runs mode-specific checks: a non-empty hypotheses array, confidence between 0 and 100, a valid patch string, references to evidence IDs (E1, E2, ...); `combined` validates all three parts.

If parsing or validation fails, the raw reply is redacted and saved to `.copilot-ci-doctor/cache/copilot-raw-output-debug.txt` for debugging.

## 4. Patch handling

Language models often write wrong line counts in diff hunk headers. Before applying, the tool recounts the old and new lines of every hunk and rewrites the `@@` headers. It then runs `git apply --check`, applies the patch on a new `ci-fix/<timestamp>` branch, stages only the files named in the patch, and commits with a `CI Doctor:` message. See [safety and privacy](safety-and-privacy.md) for the gates.

## 5. Watch loop

`watch` repeats: evidence, one combined Copilot call, apply, commit, push, wait for the new CI run (10 s polling, 180 s timeout by default). It stops when CI passes (a PR is opened against the default branch), when confidence is below the threshold, after the maximum number of iterations, or when applying or pushing fails. The defaults (80%, 5 iterations, 10 s, 180 s) can be changed with `--min-confidence`, `--max-iterations`, `--poll-interval` and `--poll-timeout`.

## Token savings

| Approach | Calls per iteration | Evidence sent | Estimated tokens per iteration |
|---|---|---|---|
| Three calls (analyze, explain, fix) | 3 | 3 times | about 5,400 |
| One combined call (`watch`) | 1 | once | about 1,800 |

The combined reply is split into `latest-hypotheses.json`, `latest-explain.json` and `latest-patch.json`, so the standalone commands keep working. Token counts shown by the tool are estimates (about 4 characters per token), not billing figures. In one recorded two-iteration demo the estimate was about 3,442 tokens in total, roughly half of what the three-call flow would have used.

## Code layout

```
src/
├── cli.js                 Entry point (commander); keeps logic out of this file
├── commands/              analyze, explain, fix, watch, retry, demo (incl. demo --cleanup)
├── copilot/
│   ├── invoke.js          Runs `gh copilot -p ... -s` with a timeout
│   ├── index.js           Prompt, invoke, extract JSON, validate
│   └── contract.js        CI_DOCTOR_RESPONSE_V1 validation
├── evidence/
│   ├── bundle.js          Builds and caches E1 to E5
│   ├── githubActions.js   Runs, jobs and logs via gh
│   ├── githubRepo.js      Repository info via gh
│   └── redact.js          Secret redaction
├── prompts/loadPrompt.js  Template loader
└── utils/
    ├── options.js         Option parsers and the exit codes (0, 1, 2)
    ├── output.js          --json mode: one JSON document on stdout
    ├── patch.js           Hunk-header normalisation; files touched by a patch
    ├── paths.js           Path and cache helpers
    ├── print.js           Terminal output
    └── prompt.js          Yes/no confirmation (declines without a terminal)
prompts/                   The four prompt templates
action/                    render-comment.js: builds the pull request comment (used by action.yml)
action.yml                 Composite GitHub Action (experimental)
scripts/sync-docs.mjs      Builds the docs site pages from docs/
docs-vp/                   VitePress site (config, landing page); guide pages are generated
test/                      Unit, git integration and end-to-end tests (node --test); helpers/ has a fake gh
```

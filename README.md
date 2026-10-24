# copilot-ci-doctor 🩺  
**From Red CI to Green PR — with Evidence, Confidence, and Safe Fixes**

## 🎬 40-Second Demo (End-to-End)

![copilot-ci-doctor demo](./demo_1.5x.gif)

> One command → failing CI → Copilot reasoning → safe fixes → green CI → PR

**copilot-ci-doctor** is a CLI tool that diagnoses **GitHub Actions CI failures** using **GitHub Copilot CLI as its core reasoning engine**.

Instead of manually digging through logs, Copilot CLI:
- analyzes CI evidence,
- explains *why* a pipeline failed in plain English,
- proposes **minimal, safe patch diffs** with confidence scores,
- **iteratively fixes** CI failures until the pipeline is green,
- and **opens a Pull Request** against `main` with the fix — link included.

This is **not** log summarization.  
It's **evidence-based reasoning for CI failures**.

---

## ✨ Why this exists

CI failures are one of the biggest productivity drains in software development:
- logs are noisy,
- root causes are unclear,
- fixes often rely on trial and error.

**copilot-ci-doctor** turns CI failures into a guided flow:

> **failure → evidence → reasoning → safe fix → green CI → PR**

---

## 📦 Install

```bash
# Run directly (no install needed)
npx copilot-ci-doctor demo

# Or install globally
npm install -g copilot-ci-doctor
copilot-ci-doctor analyze
```

---

## 🚀 What it does

Given a failed GitHub Actions run, the tool:

- 📦 Collects an **Evidence Bundle** with 5 tagged items:  
  - **E1** repo info, **E2** failed run metadata, **E3** failed jobs & steps, **E4** log excerpt (last 200 lines, redacted), **E5** workflow YAML

- 🧠 Uses **GitHub Copilot CLI** to generate:
  - ranked root-cause hypotheses (with confidence scores)
  - plain-English explanations
  - minimal, git-apply-compatible patch diffs

- 🛡️ Applies fixes **safely**:
  - shows a diff preview
  - asks for confirmation
  - applies on a new `ci-fix/*` branch
  - never touches secrets or `main`

- 🔁 **Watch mode** — iterates automatically:
  - analyze → explain → fix → push → wait for CI result
  - loops until CI passes or confidence drops below 80%
  - **single Copilot call per iteration** (~0.33x token usage vs naive approach)
  - prints a final scoreboard with token usage estimates
  - **opens a PR** against `main` when CI is green

Without **GitHub Copilot CLI**, this tool does not work — all reasoning and patch generation comes directly from Copilot.

---

## 🎬 Quick Demo (Recommended)

The fastest way to see the full flow is the judge-mode demo:

```bash
npx copilot-ci-doctor demo
```

This will:

1. Create a demo repo with an intentionally broken GitHub Actions workflow
2. Push and trigger a failing CI run ❌
3. **Watch loop kicks in** — automatically iterates:
   - Analyze the failure
   - Explain the root cause in plain English
   - Propose a safe fix with confidence score
   - Apply, commit, and push the fix
   - Wait for CI to re-run
4. Repeat until CI is green ✅
5. Print a final scoreboard

Example output:

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

  Token Usage (estimated):
    Input:  ~2,358 tokens
    Output: ~1,084 tokens
    Total:  ~3,442 tokens
    Savings: ~51% vs 3-call mode

  CI before: ✖ FAILED → after fix: ✓ PASSING
🎉 CI is fixed!

  🔗 Pull Request: https://github.com/your-org/your-repo/pull/1
```

### ⏱ For Judges (60 seconds)

**Prerequisites:** `gh auth login` + GitHub Copilot subscription enabled.

**What `demo` does:** creates a throwaway demo repo → pushes broken CI → enters fix loop → opens a PR when green. It does **not** touch any of your existing repos.

**Where files go:** all cache, patches, and debug output live under `.copilot-ci-doctor/cache/` inside the demo repo — this directory is `.gitignore`d and never committed.

---

## 🧪 Commands

### `analyze` — Diagnose the failure

```bash
copilot-ci-doctor analyze
```

Collects evidence from the latest failed GitHub Actions run and generates ranked root-cause hypotheses with confidence scores.

### `explain` — Plain-English explanation

```bash
copilot-ci-doctor explain
```

Explains the CI failure in plain English, including why it might pass locally and what likely changed. Reuses the cached evidence bundle from `analyze`.

### `fix` — Generate and apply a patch

```bash
# Interactive: shows diff, asks for confirmation
copilot-ci-doctor fix

# Auto-confirm (for scripting)
copilot-ci-doctor fix --yes

# Full auto-fix mode: iterates until CI is green
copilot-ci-doctor fix --auto
```

Generates a minimal patch diff, previews it, and applies it on a new `ci-fix/*` branch.

**`--auto` mode** delegates directly to the `watch` command — it runs the same iterative loop: analyze → explain → fix → push → wait for CI → repeat until passing or confidence drops below 80%.

### `watch` — Monitor and auto-fix

```bash
copilot-ci-doctor watch
```

Continuously monitors the CI pipeline using **single-call mode** (1 Copilot call per iteration instead of 3). When a failure is detected:
1. Collects evidence bundle from the failed run
2. Makes **one combined Copilot call** → returns hypotheses + explanation + patch
3. Normalizes patch hunk headers and applies with `git apply`
4. Commits and pushes on a `ci-fix/<timestamp>` branch
5. Polls for new CI run (10s interval, 180s timeout)
6. If CI still fails, loops back to step 1

Stops when:
- CI passes ✅ → **automatically creates a PR** against `main` with fix details (description, confidence, root cause, explanation, iterations, token usage, and elapsed time)
- Fix confidence drops below 80%
- Max 5 iterations reached

Token usage is estimated at ~4 chars/token and displayed after each Copilot call.

### `retry` — Re-run failed workflow

```bash
copilot-ci-doctor retry
```

Re-runs the most recent failed GitHub Actions workflow run.

### `demo` — End-to-end demonstration

```bash
copilot-ci-doctor demo
```

Creates a broken demo repo, pushes to trigger CI, then hands off to `watch` for fully automated diagnosis and repair.

---

## npm scripts (for contributors)

| Command | What it does |
|---|---|
| `npm start` | Run the CLI from source (`node src/cli.js`) |
| `npm run test:bin` | Smoke test: runs `src/cli.js --help` |
| `npm run prepublishOnly` | Runs `test:bin` automatically before `npm publish` |

## 🧠 How GitHub Copilot CLI is used (core requirement)

GitHub Copilot CLI is the **reasoning engine** of this project.

All reasoning is invoked via:
```bash
gh copilot -p "<rendered prompt>" -s --no-custom-instructions
```

- `-p` sends the full prompt (evidence bundle + instructions) non-interactively
- `-s` produces silent, scriptable output
- `--no-custom-instructions` ensures deterministic behavior
- Each call has a **180-second timeout**

It is used to:
- analyze CI evidence and propose **ranked hypotheses**
- explain failures in **plain English** (including why CI fails but local passes)
- generate **minimal patch diffs** with confidence and risk levels

Four prompt modes are supported:
| Mode | Prompt file | Description |
|---|---|---|
| `hypotheses` | `prompts/hypotheses.txt` | Ranked root-cause hypotheses |
| `explain` | `prompts/explain.txt` | Plain-English explanation |
| `patch` | `prompts/patch.txt` | Minimal unified diff patch |
| `combined` | `prompts/combined.txt` | All three in a single call (watch mode) |

To keep this reliable, every Copilot response is:
- constrained by a **strict JSON contract**
- validated against the `CI_DOCTOR_RESPONSE_V1` schema (modes: `hypotheses`, `explain`, `patch`, `combined`)
- required to reference evidence IDs (E1, E2, …)
- parsed from raw output with JSON fence extraction and fallback
- on parse failure, raw output is saved (redacted) to `.copilot-ci-doctor/cache/copilot-raw-output-debug.txt`

This ensures Copilot is doing **reasoned analysis**, not free-form guessing.

---

## 🧱 How it works (internals)

1. **Evidence Bundle**  
   Collects 5 evidence items via `gh` CLI:
   - **E1** — repo info (`gh repo view`): owner/name, default branch, URL
   - **E2** — failed run metadata: run ID, workflow, branch, event, conclusion
   - **E3** — failed jobs & steps: filtered from `gh run view --json jobs`
   - **E4** — log excerpt: last 200 lines from `gh run view --log-failed` (falls back to `--log`), redacted
   - **E5** — workflow YAML: matched by workflow name from `.github/workflows/`

2. **Copilot CLI**  
   Evidence is rendered into prompt templates (`{{EVIDENCE_BUNDLE}}` placeholder) and sent via `gh copilot -p "<prompt>" -s --no-custom-instructions` with a 180s timeout.

3. **JSON Extraction**  
   Raw Copilot output is parsed by extracting JSON from markdown fences (` ```json ... ``` `) or finding the first `{…}` block. On failure, the redacted raw output is saved for debugging.

4. **Contract Validation**  
   Every Copilot response is validated for:
   - `version` must equal `CI_DOCTOR_RESPONSE_V1`
   - `mode` must match one of: `hypotheses`, `explain`, `patch`, `combined`
   - mode-specific checks: non-empty hypotheses array, confidence 0–100, valid patch string, evidence refs
   - `combined` mode validates all three sub-schemas

5. **Patch Normalization**  
   LLMs frequently emit incorrect `@@` hunk line counts. Before applying, the tool recounts old/new line counts in each hunk and rewrites the `@@` headers to produce a valid unified diff.

6. **Safe Apply**  
   Patches are checked with `git apply --check`, previewed (truncated at 400 lines), applied on a new `ci-fix/<timestamp>` branch, and committed with a `CI Doctor:` prefix message.

7. **Watch Loop**  
   After applying a fix, the tool pushes, waits for a new CI run (10s poll interval, 180s timeout), and re-analyzes if still failing. Stops when:
   - CI passes → creates a PR against `main`
   - Fix confidence drops below 80%
   - Max 5 iterations reached

---

## ⚡ Token Savings Strategy

| Approach | Calls/iter | Evidence sends | Est. tokens/iter |
|---|---|---|---|
| **3-call mode** (analyze + explain + fix) | 3 | 3× | ~5,400 |
| **Single-call mode** (combined) | 1 | 1× | ~1,800 |
| **Savings** | | | **~67%** |

- **One prompt, one response** — `combined.txt` asks Copilot to return hypotheses + explanation + patch in a single JSON reply. The evidence bundle (~1,200 tokens) is sent once instead of three times.
- **Response splitting** — the combined response is cached as `latest-hypotheses.json`, `latest-explain.json`, `latest-patch.json` so standalone commands still work.
- **Measured:** a real 2-iteration demo used ~3,442 total tokens (~51% savings vs 3-call mode). Per-iteration estimates are shown in the scoreboard.

---

## 🛡️ Safety guarantees

- **Secret redaction** — 11 pattern types are stripped before display or Copilot input:
  GitHub PATs (`ghp_`), OAuth tokens (`gho_`), fine-grained PATs (`github_pat_`), app installation tokens (`ghs_`), refresh tokens (`ghr_`), Bearer tokens, generic token/password values, private keys (RSA/DSA/EC/OPENSSH), AWS access key IDs (`AKIA`), OpenAI API keys (`sk-`), and npm tokens (`npm_`)
- Fixes always require confirmation (unless explicitly overridden with `--yes` or `--auto`)
- Low-confidence (<60%) or **HIGH-risk** patches are never auto-applied
- Watch/auto mode stops if fix confidence drops below 80%
- All changes go on a new `ci-fix/<YYYYMMDD-HHMMSS>` branch — `main` is never modified directly
- When CI passes, a PR is created against `main` for review before merging
- `git apply --check` runs before any patch is applied
- **Patch normalization** — hunk `@@` headers are recounted before apply (LLMs often emit wrong line counts)
- Diffs are truncated at 400 lines in terminal preview (full patch saved to cache)
- `.gitignore` excludes `node_modules/`, `.copilot-ci-doctor/`, `.ci-doctor/`, `*.patch`, and `copilot-raw-output-debug.txt`
- **No force-pushes** — `watch` and `demo` only push to the repo you explicitly run them in (demo creates its own throwaway repo) and always use regular `git push`

---

## 📁 Architecture

```
copilot-ci-doctor/
├── package.json
├── package-lock.json
├── .gitignore
├── LICENSE
├── README.md
├── .github/
│   └── workflows/
│       └── publish-npm.yml     ← npm publish on version tag push
├── src/
│   ├── cli.js                  ← CLI entrypoint (commander-based)
│   ├── copilot/
│   │   ├── index.js            ← askCopilot() — prompt → invoke → extract JSON → validate
│   │   ├── invoke.js           ← gh copilot -p … -s wrapper (180s timeout)
│   │   └── contract.js         ← CI_DOCTOR_RESPONSE_V1 schema validation
│   ├── evidence/
│   │   ├── bundle.js           ← evidence bundle builder (E1–E5)
│   │   ├── githubActions.js    ← fetch runs, jobs, logs via gh CLI
│   │   ├── githubRepo.js       ← repo metadata via gh repo view
│   │   └── redact.js           ← 11-pattern secret redaction
│   ├── prompts/
│   │   └── loadPrompt.js       ← template loader ({{EVIDENCE_BUNDLE}} injection)
│   ├── utils/
│   │   ├── paths.js            ← path, cache dir & file helpers
│   │   └── print.js            ← chalk formatting (diffs, evidence, confidence)
│   └── commands/
│       ├── analyze.js           ← collect evidence + hypotheses
│       ├── explain.js           ← plain-English explanation
│       ├── fix.js               ← generate + normalize + apply patch
│       ├── watch.js             ← iterative auto-fix loop + scoreboard + PR
│       ├── retry.js             ← re-run failed workflow (gh run rerun --failed)
│       └── demo.js              ← create broken repo → watch → auto-fix
└── prompts/
    ├── hypotheses.txt          ← standalone analyze prompt
    ├── explain.txt             ← standalone explain prompt
    ├── patch.txt               ← standalone fix prompt
    └── combined.txt            ← single-call prompt (watch mode)
```

---

## 🧰 Prerequisites

- **Node.js** ≥ 18
- **GitHub CLI** (`gh`) — https://cli.github.com
  ```bash
  gh auth login
  ```
- **GitHub Copilot** subscription (required for `gh copilot` CLI extension)
- **GitHub Copilot CLI** extension installed and working:
  ```bash
  gh extension install github/gh-copilot
  gh copilot --help   # verify it works
  ```
- **Permissions** — your `gh` account must be able to create repos and open PRs (`demo` creates a throwaway repo). If org restrictions prevent this, run `watch` inside an existing repo instead.

### Dependencies

| Package | Purpose |
|---|---|
| `commander` ^12.1.0 | CLI argument parsing & sub-commands |
| `chalk` ^5.3.0 | Terminal colors & formatting |
| `execa` ^9.5.2 | Shell command execution (`gh`, `git`) |

---

## 📤 Publishing (maintainers)

This package is published to npm automatically via GitHub Actions when a version tag is pushed.

```bash
# 1. Bump the version in package.json
npm version patch   # or minor / major

# 2. Push the commit and the tag
git push origin main --follow-tags
```

The workflow at `.github/workflows/publish-npm.yml` will:
- verify the tag matches `package.json` version
- install dependencies (`npm ci`)
- run a sanity check (`node src/cli.js --help`)
- pack and inspect the package contents
- verify npm auth token is set
- publish to npm with provenance (`--provenance --access public`)

> ⚠️ Never publish manually with `npm publish` — always use the tag-based workflow.

---

## 📄 License

MIT

# copilot-ci-doctor 🩺  
**From Red CI to Green PR — with Evidence, Confidence, and Safe Fixes**

**copilot-ci-doctor** is a CLI tool that diagnoses **GitHub Actions CI failures** using **GitHub Copilot CLI as its core reasoning engine**.

Instead of manually digging through logs, Copilot CLI:
- analyzes CI evidence,
- explains *why* a pipeline failed in plain English,
- proposes **minimal, safe patch diffs** with confidence scores,
- and **iteratively fixes** CI failures until the pipeline is green — safely and transparently.

This is **not** log summarization.  
It's **evidence-based reasoning for CI failures**.

---

## ✨ Why this exists

CI failures are one of the biggest productivity drains in software development:
- logs are noisy,
- root causes are unclear,
- fixes often rely on trial and error.

**copilot-ci-doctor** turns CI failures into a guided flow:

> **failure → evidence → reasoning → safe fix → green CI**

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

- 📦 Collects an **Evidence Bundle**  
  (workflow YAML, failed logs, repo metadata — all redacted and tagged as E1, E2, …)

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
```

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

**`--auto` mode** runs the full iterative loop (like the demo): analyze → explain → fix → push → wait for CI → repeat until passing or confidence drops below 80%.

### `watch` — Monitor and auto-fix

```bash
copilot-ci-doctor watch
```

Continuously monitors the CI pipeline using **single-call mode** (1 Copilot call per iteration instead of 3). When a failure is detected:
1. Collects evidence bundle from the failed run
2. Makes **one combined Copilot call** → returns hypotheses + explanation + patch
3. Applies the patch, commits, and pushes
4. Waits for CI to re-run
5. If CI still fails, loops back to step 1

Stops when:
- CI passes ✅
- Fix confidence drops below 80%
- Max 5 iterations reached

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

## 🧠 How GitHub Copilot CLI is used (core requirement)

GitHub Copilot CLI is the **reasoning engine** of this project.

It is used to:
- analyze CI evidence and propose **ranked hypotheses**
- explain failures in **plain English**
- generate **minimal patch diffs** with confidence and risk levels
- answer follow-up questions (e.g. *"Why does this pass locally?"*)

To keep this reliable, every Copilot response is:
- constrained by a **strict JSON contract**
- validated against the `CI_DOCTOR_RESPONSE_V1` schema
- required to reference evidence IDs (E1, E2, …)

This ensures Copilot is doing **reasoned analysis**, not free-form guessing.

---

## 🧱 How it works (internals)

1. **Evidence Bundle**  
   Collects repo info, failed run metadata, redacted logs, and workflow YAML.  
   Each item is tagged with an evidence ID (E1, E2, …).

2. **Copilot CLI**  
   Evidence is sent to Copilot via `gh copilot suggest` using strict prompts.

3. **Contract Validation**  
   Every Copilot response is validated for:
   - schema correctness
   - confidence ranges
   - presence of evidence references

4. **Safe Apply**  
   Patches are checked with `git apply --check`, previewed, applied on a new branch, and committed with a clear message.

5. **Watch Loop**  
   After applying a fix, the tool pushes, waits for CI, and re-analyzes if still failing. Stops when CI passes or confidence is too low.

---

## ⚡ Token Savings Strategy

The naive approach makes **3 separate Copilot calls** per iteration (analyze, explain, fix), each sending the full evidence bundle:

| Approach | Calls/iter | Evidence sends | Est. tokens/iter |
|---|---|---|---|
| **3-call mode** (analyze + explain + fix) | 3 | 3× | ~5,400 |
| **Single-call mode** (combined) | 1 | 1× | ~1,800 |
| **Savings** | | | **~67%** |

### How it works

1. **Combined prompt** — A single `combined.txt` prompt asks Copilot to return hypotheses, explanation, and patch in one JSON response. The evidence bundle is sent only once.

2. **Response splitting** — The combined response is split and cached as separate files (`latest-hypotheses.json`, `latest-explain.json`, `latest-patch.json`) so individual commands (`analyze`, `explain`, `fix`) still work standalone.

3. **Measured results** from a real 2-iteration demo run:
   ```
   Iteration 1: ~1,851 tokens (evidence + combined response)
   Iteration 2: ~1,591 tokens (new evidence + combined response)
   Total:       ~3,442 tokens
   Savings:     ~51% vs 3-call mode
   ```

4. **Per-iteration tracking** — Token estimates are displayed after each Copilot call and summarized in the final scoreboard, so you always know the cost.

> The evidence bundle is the dominant cost (~1,200 tokens). Sending it once instead of three times is the single biggest optimization.

---

## 🛡️ Safety guarantees

- Secrets are redacted from all logs **before** display or Copilot input
- Fixes always require confirmation (unless explicitly overridden with `--yes` or `--auto`)
- Low-confidence (<60%) or **HIGH-risk** patches are never auto-applied
- Watch/auto mode stops if fix confidence drops below 80%
- All changes go on a new `ci-fix/*` branch — `main` is never modified
- `git apply --check` runs before any patch is applied
- `.gitignore` excludes `.copilot-ci-doctor/cache/**` from commits

---

## 📁 Architecture

```
copilot-ci-doctor/
├── package.json
├── package-lock.json
├── .gitignore
├── LICENSE
├── README.md
├── src/
│   ├── cli.js                  ← CLI entrypoint
│   ├── copilot/
│   │   ├── index.js            ← askCopilot() main entry
│   │   ├── invoke.js           ← gh copilot CLI wrapper
│   │   └── contract.js         ← JSON response validation
│   ├── evidence/
│   │   ├── bundle.js           ← evidence bundle builder
│   │   ├── githubActions.js    ← fetch runs & logs
│   │   ├── githubRepo.js       ← repo metadata
│   │   └── redact.js           ← secret redaction
│   ├── prompts/
│   │   └── loadPrompt.js       ← template loader
│   ├── utils/
│   │   ├── paths.js            ← path & cache helpers
│   │   └── print.js            ← formatting helpers
│   └── commands/
│       ├── analyze.js           ← collect evidence + hypotheses
│       ├── explain.js           ← plain-English explanation
│       ├── fix.js               ← generate + apply patch
│       ├── watch.js             ← iterative auto-fix loop
│       ├── retry.js             ← re-run failed workflow
│       └── demo.js              ← end-to-end demo
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
- **GitHub Copilot** subscription (required for Copilot CLI)

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
- run a sanity check (`node src/cli.js --help`)
- publish to npm with provenance

> ⚠️ Never publish manually with `npm publish` — always use the tag-based workflow.

---

## 📄 License

MIT

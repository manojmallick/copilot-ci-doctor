# copilot-ci-doctor 🩺  
**From Red CI to Green PR — with Evidence, Confidence, and Safe Fixes**

**copilot-ci-doctor** is a CLI tool that diagnoses **GitHub Actions CI failures** using **GitHub Copilot CLI as its core reasoning engine**.

Instead of manually digging through logs, Copilot CLI:
- analyzes CI evidence,
- explains *why* a pipeline failed in plain English,
- proposes **minimal, safe patch diffs** with confidence scores,
- and helps you fix CI failures on a **new branch** — safely and transparently.

This is **not** log summarization.  
It’s **evidence-based reasoning for CI failures**.

---

## ✨ Why this exists

CI failures are one of the biggest productivity drains in software development:
- logs are noisy,
- root causes are unclear,
- fixes often rely on trial and error.

**copilot-ci-doctor** turns CI failures into a guided flow:

> **failure → evidence → reasoning → safe fix → green CI**

---

## � Install

```bash
# Run directly (no install needed)
npx copilot-ci-doctor demo

# Or install globally
npm install -g copilot-ci-doctor
copilot-ci-doctor analyze
```

---

## �🚀 What it does

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

- 🔁 Re-runs CI after the fix

Without **GitHub Copilot CLI**, this tool does not work — all reasoning and patch generation comes directly from Copilot.

---

## 🎬 Quick Demo (Recommended)

The fastest way to see the full flow is the judge-mode demo:

```bash
npx copilot-ci-doctor demo
```

In under a minute, this will:

1. Clone a demo repo with a broken GitHub Actions workflow  
2. Trigger a failing CI run ❌  
3. Analyze the failure using Copilot CLI  
4. Propose a **safe fix** with a diff preview  
5. Apply the fix on a new branch  
6. Re-run CI and succeed ✅  

Example output:

```
🎬 Demo scenario: node-version-mismatch
Before: CI ❌
After:  CI ✅
Confidence: 92%
Files changed: 1
Estimated time saved: 35–60 minutes
```

---

## 🧪 Manual Usage

Run inside any GitHub repository with failed Actions runs:

```bash
# Diagnose: collect evidence + generate ranked hypotheses
npx copilot-ci-doctor analyze

# Explain: plain-English explanation (reuses cached evidence)
npx copilot-ci-doctor explain

# Fix: generate a patch and apply safely on a new branch
npx copilot-ci-doctor fix

# Retry: re-run the failed workflow
npx copilot-ci-doctor retry
```

> 💡 Tip: If you are working from source (local clone), you can also run  
> `node src/cli.js <command>` — but **`npx` is recommended** for demos and judges.

---

## 🧠 How GitHub Copilot CLI is used (core requirement)

GitHub Copilot CLI is the **reasoning engine** of this project.

It is used to:
- analyze CI evidence and propose **ranked hypotheses**
- explain failures in **plain English**
- generate **minimal patch diffs** with confidence and risk levels
- answer follow-up questions (e.g. *“Why does this pass locally?”*)

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

---

## 🛡️ Safety guarantees

- Secrets are redacted from all logs **before** display or Copilot input
- Fixes always require confirmation (unless explicitly overridden)
- Low-confidence (<60%) or **HIGH-risk** patches are never auto-applied
- All changes go on a new `ci-fix/*` branch — `main` is never modified
- `git apply --check` runs before any patch is applied

---

## 📦 Architecture

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
│       ├── analyze.js
│       ├── explain.js
│       ├── fix.js
│       ├── retry.js
│       └── demo.js
└── prompts/
    ├── hypotheses.txt
    ├── explain.txt
    └── patch.txt
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

## � Publishing (maintainers)

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

## �📄 License

MIT

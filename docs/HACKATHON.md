# Notes for hackathon judges

This project was built for a GitHub Copilot CLI hackathon. These notes were part of the original README; the main README now targets everyday users.

## 60-second run

**Prerequisites:** `gh auth login`, and GitHub Copilot with Copilot CLI available (see the [README requirements](../README.md#requirements)).

```bash
npx copilot-ci-doctor demo
```

What `demo` does: creates a throwaway project with an intentionally broken GitHub Actions workflow, pushes it so CI fails, then runs the `watch` loop (analyze, explain, fix, push, wait) until CI is green, and opens a pull request. It does not touch your existing repositories.

> `demo` can create a repository named `ci-doctor-demo-<timestamp>` on your account. It asks first (or needs `--yes`) and it is private unless you pass `--public`. Delete it afterwards with `gh repo delete`.

Cache files, patches and debug output are written under `.copilot-ci-doctor/cache/` inside the demo project, which the demo's own `.gitignore` excludes.

## Example output

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

## How GitHub Copilot CLI is used

GitHub Copilot CLI is the reasoning engine. Every call is:

```bash
gh copilot -p "<rendered prompt>" -s --no-custom-instructions
```

It is used for ranked hypotheses, plain-English explanations and minimal patch diffs. Responses must follow a strict JSON contract that cites evidence IDs. See [how it works](how-it-works.md) for the details and [safety and privacy](safety-and-privacy.md) for the guard rails.

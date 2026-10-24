---
layout: home
title: Diagnose and fix failing GitHub Actions runs
description: A CLI that collects evidence from a failed GitHub Actions run, asks GitHub Copilot CLI for ranked root causes and a minimal patch, and applies it safely on a new branch.

hero:
  name: copilot-ci-doctor
  text: From red CI to a green pull request
  tagline: Evidence-backed diagnosis, confidence scores and safe, reviewable fixes for failing GitHub Actions runs.
  image:
    src: /demo.gif
    alt: copilot-ci-doctor demo
  actions:
    - theme: brand
      text: Commands →
      link: /guide/commands
    - theme: alt
      text: Worked examples
      link: /guide/examples
    - theme: alt
      text: GitHub
      link: https://github.com/manojmallick/copilot-ci-doctor

features:
  - icon: 🔎
    title: Every claim cites evidence
    details: Repo info, run metadata, failed steps, the last 200 log lines and the workflow YAML are collected, redacted and numbered E1 to E5. Hypotheses must point at them.
    link: /guide/how-it-works
    linkText: How it works →
  - icon: 🛡️
    title: Safe by default
    details: Patches are git apply-checked, shown as a diff and applied on a new ci-fix/* branch only after you confirm. Low confidence or HIGH risk is never auto-applied. No force-pushes.
    link: /guide/safety-and-privacy
    linkText: Safety and privacy →
  - icon: ⚙️
    title: Built for scripts
    details: "--json prints one document on stdout, --dry-run changes nothing, and exit codes tell fixed (0), error (1) and ran-but-not-fixed (2) apart."
    link: /guide/commands
    linkText: Options and exit codes →
  - icon: 🤖
    title: Runs in GitHub Actions
    details: An experimental composite action diagnoses a failed workflow run and posts the likely cause as a pull request comment.
    link: /guide/github-action
    linkText: GitHub Action →
---

## Install

```bash
# Try the end-to-end demo (asks before creating a repository)
npx copilot-ci-doctor demo

# Or use it in your own repository, from inside a clone with a failed Actions run
npm install -g copilot-ci-doctor
copilot-ci-doctor analyze      # evidence + ranked hypotheses
copilot-ci-doctor fix --dry-run  # preview the patch, change nothing
```

You need Node.js 18 or newer, the [GitHub CLI](https://cli.github.com) signed in, and a GitHub Copilot subscription.
Generated fixes come from a language model: review every patch before merging.

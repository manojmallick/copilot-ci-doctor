#!/usr/bin/env node

/**
 * cli.js — CLI entrypoint for copilot-ci-doctor
 *
 * Registers all sub-commands and delegates to the appropriate handler.
 * This file should be kept thin — all logic lives in the command modules.
 */

import { createRequire } from "node:module";
import { Command } from "commander";
import chalk from "chalk";
import { analyzeCommand } from "./commands/analyze.js";
import { explainCommand } from "./commands/explain.js";
import { fixCommand } from "./commands/fix.js";
import { retryCommand } from "./commands/retry.js";
import { watchCommand } from "./commands/watch.js";
import { demoCommand } from "./commands/demo.js";
import { WATCH_DEFAULTS } from "./commands/watch.js";
import { enableJsonMode } from "./utils/output.js";
import { intInRange, numberInRange, parseRepo, parseRunId, parseBranch } from "./utils/options.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("copilot-ci-doctor")
  .description(
    "Diagnose GitHub Actions CI failures using GitHub Copilot CLI as the reasoning engine"
  )
  .version(version);

// ── shared option definitions ────────────────────────────────────────────────
const optJson = ["--json", "Print one JSON document on stdout; progress goes to stderr"];
const optRepo = ["--repo <owner/name>", "Inspect this repository instead of the current one", parseRepo];
const optRunId = ["--run-id <id>", "Use this failed run instead of the latest failure", parseRunId];
const optBranch = ["--branch <name>", "Use the latest failed run on this branch", parseBranch];
const optDryRun = ["--dry-run", "Show the diff and check that it applies, but change nothing (no branch, commit or push)"];
const optMaxIterations = ["--max-iterations <n>", `Give up after this many fix attempts (default ${WATCH_DEFAULTS.maxIterations})`, intInRange(1, 20)];
const optMinConfidence = ["--min-confidence <percent>", "Do not apply a fix below this confidence (fix default 60, watch default 80)", intInRange(0, 100)];
const optPollInterval = ["--poll-interval <seconds>", `Seconds between CI status checks (default ${WATCH_DEFAULTS.pollIntervalSeconds})`, numberInRange(0.05, 600)];
const optPollTimeout = ["--poll-timeout <seconds>", `Seconds to wait for a CI run to start or finish (default ${WATCH_DEFAULTS.pollTimeoutSeconds})`, numberInRange(1, 7200)];
const optBase = ["--base <branch>", "Open the pull request against this branch (default: the repository default branch)", parseBranch];
const optNoPr = ["--no-pr", "Do not open a pull request when CI is fixed"];

/** Switch to JSON output before a command runs, if --json was given. */
function prepare(options) {
  if (options.json) enableJsonMode();
  return options;
}

// ── analyze ──────────────────────────────────────────────────────────────────
program
  .command("analyze")
  .description(
    "Find a failed CI run (the latest by default), collect evidence, and generate ranked root-cause hypotheses"
  )
  .option(...optRepo)
  .option(...optRunId)
  .option(...optBranch)
  .option(...optJson)
  .action(async (options) => {
    await analyzeCommand(prepare(options));
  });

// ── explain ──────────────────────────────────────────────────────────────────
program
  .command("explain")
  .description(
    "Explain the latest CI failure in plain English (reuses cached evidence bundle)"
  )
  .option(...optJson)
  .action(async (options) => {
    await explainCommand(prepare(options));
  });

// ── fix ──────────────────────────────────────────────────────────────────────
program
  .command("fix")
  .description(
    "Generate a minimal patch to fix the CI failure and apply it on a new branch"
  )
  .option("--yes", "Apply without asking for confirmation (for scripting)")
  .option("--auto", "Full auto-fix mode: iterate analyze → explain → fix → push until CI passes (same as `watch`)")
  .option(...optDryRun)
  .option(...optMinConfidence)
  .option(...optMaxIterations)
  .option(...optPollInterval)
  .option(...optPollTimeout)
  .option(...optBase)
  .option(...optNoPr)
  .option(...optJson)
  .action(async (options) => {
    prepare(options);
    if (options.auto) {
      await watchCommand(options);
    } else {
      await fixCommand(options);
    }
  });

// ── retry ────────────────────────────────────────────────────────────────────
program
  .command("retry")
  .description("Re-run a failed GitHub Actions workflow run (the latest failure by default)")
  .option(...optRepo)
  .option(...optRunId)
  .option(...optBranch)
  .option(...optJson)
  .action(async (options) => {
    await retryCommand(prepare(options));
  });

// ── watch ────────────────────────────────────────────────────────────────────
program
  .command("watch")
  .description(
    "Watch the CI pipeline: analyze, explain, fix and push until CI passes or a limit is reached"
  )
  .option(...optMaxIterations)
  .option(...optMinConfidence)
  .option(...optPollInterval)
  .option(...optPollTimeout)
  .option(...optBase)
  .option(...optNoPr)
  .option(...optDryRun)
  .option(...optJson)
  .action(async (options) => {
    await watchCommand(prepare(options));
  });

// ── demo ─────────────────────────────────────────────────────────────────────
program
  .command("demo")
  .description(
    "Run an end-to-end demo: create broken repo → watch CI → auto-fix → verify passing"
  )
  .option("--yes", "Create the demo GitHub repository without asking")
  .option("--public", "Make the demo repository public (default: private)")
  .action(async (options) => {
    await demoCommand(options);
  });

program.addHelpText(
  "after",
  `
Exit codes:
  0  Done: analysis printed, patch applied, or CI fixed
  1  Error: bad input, missing tool, or a GitHub, Copilot or git failure
  2  Ran correctly but did not fix: confidence too low, patch declined or not
     applicable, or the iteration or time limit was reached

Docs: https://github.com/manojmallick/copilot-ci-doctor#readme`
);

// ── Parse & run ──────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(`\nFatal error: ${err.message}`));
  process.exit(1);
});

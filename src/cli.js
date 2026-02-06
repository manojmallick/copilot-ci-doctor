#!/usr/bin/env node

/**
 * cli.js — CLI entrypoint for copilot-ci-doctor
 *
 * Registers all sub-commands and delegates to the appropriate handler.
 * This file should be kept thin — all logic lives in the command modules.
 */

import { Command } from "commander";
import chalk from "chalk";
import { analyzeCommand } from "./commands/analyze.js";
import { explainCommand } from "./commands/explain.js";
import { fixCommand } from "./commands/fix.js";
import { retryCommand } from "./commands/retry.js";
import { watchCommand } from "./commands/watch.js";
import { demoCommand } from "./commands/demo.js";

const program = new Command();

program
  .name("copilot-ci-doctor")
  .description(
    "Diagnose GitHub Actions CI failures using GitHub Copilot CLI as the reasoning engine"
  )
  .version("1.0.0");

// ── analyze ──────────────────────────────────────────────────────────────────
program
  .command("analyze")
  .description(
    "Find the latest failed CI run, collect evidence, and generate ranked root-cause hypotheses"
  )
  .action(async () => {
    await analyzeCommand();
  });

// ── explain ──────────────────────────────────────────────────────────────────
program
  .command("explain")
  .description(
    "Explain the latest CI failure in plain English (reuses cached evidence bundle)"
  )
  .action(async () => {
    await explainCommand();
  });

// ── fix ──────────────────────────────────────────────────────────────────────
program
  .command("fix")
  .description(
    "Generate a minimal patch to fix the CI failure and apply it on a new branch"
  )
  .option("--yes", "Auto-confirm without prompting (for scripting/demo)")
  .option("--auto", "Full auto-fix mode: iterate analyze → explain → fix → push until CI passes")
  .action(async (options) => {
    if (options.auto) {
      await watchCommand({ autoFix: true });
    } else {
      await fixCommand(options);
    }
  });

// ── retry ────────────────────────────────────────────────────────────────────
program
  .command("retry")
  .description("Re-run the most recent failed GitHub Actions workflow run")
  .action(async () => {
    await retryCommand();
  });

// ── watch ────────────────────────────────────────────────────────────────────
program
  .command("watch")
  .description(
    "Watch CI pipeline: auto-analyze, explain, and fix failures until CI passes or confidence drops below 80%"
  )
  .action(async () => {
    await watchCommand();
  });

// ── demo ─────────────────────────────────────────────────────────────────────
program
  .command("demo")
  .description(
    "Run an end-to-end demo: create broken repo → watch CI → auto-fix → verify passing"
  )
  .action(async () => {
    await demoCommand();
  });

// ── Parse & run ──────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(`\nFatal error: ${err.message}`));
  process.exit(1);
});

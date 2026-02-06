/**
 * explain.js — `copilot-ci-doctor explain`
 *
 * Reuses the cached evidence bundle (from a prior `analyze` run) and
 * calls Copilot CLI with the explain prompt. Prints a plain-English
 * explanation of the CI failure.
 */

import chalk from "chalk";
import { loadCachedBundle } from "../evidence/bundle.js";
import { askCopilot } from "../copilot/index.js";
import { writeCache } from "../utils/paths.js";
import { header, confidenceColor, fail } from "../utils/print.js";

export async function explainCommand() {
  try {
    header("💡", "copilot-ci-doctor explain");

    // Load cached bundle — require analyze to have been run first
    const bundle = loadCachedBundle();
    if (!bundle) {
      console.log(
        chalk.yellow("  No cached evidence bundle found.\n") +
        chalk.dim("  Run `copilot-ci-doctor analyze` first to collect evidence.")
      );
      process.exit(1);
    }
    console.log(chalk.dim("  Using cached evidence bundle.\n"));

    // Call Copilot
    console.log(chalk.dim("🤖 Asking Copilot for an explanation…\n"));
    const response = await askCopilot({ mode: "explain", evidenceBundle: bundle });

    // Cache response
    writeCache("latest-explain.json", response);

    // Display results
    const color = confidenceColor(response.confidence);

    console.log(chalk.bold.underline("Failure Explanation:\n"));
    console.log(`  ${chalk.bold("Summary:")} ${response.summary}`);
    console.log(`  ${chalk.bold("Confidence:")} ${color(`${response.confidence}%`)}`);
    console.log(`\n  ${response.explanation}`);

    // Structured plain-English bullets (if provided)
    if (Array.isArray(response.plain_english) && response.plain_english.length > 0) {
      console.log(chalk.bold("\n  Plain English:"));
      for (const bullet of response.plain_english) {
        console.log(`    • ${bullet}`);
      }
    }

    // Why local differs from CI
    if (response.why_local_differs) {
      console.log(`\n  ${chalk.bold("Why local differs:")} ${response.why_local_differs}`);
    }

    // What changed recently
    if (response.what_changed) {
      console.log(`  ${chalk.bold("What changed:")} ${response.what_changed}`);
    }

    console.log(
      `\n  ${chalk.bold("Evidence:")} ${chalk.cyan(response.evidence_refs.join(", "))}`
    );

    console.log(
      chalk.dim("\nTip: Run `copilot-ci-doctor fix --safe` to generate a patch.")
    );
  } catch (err) {
    fail("Explain", err.message);
  }
}

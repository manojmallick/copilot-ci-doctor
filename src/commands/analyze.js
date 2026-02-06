/**
 * analyze.js — `copilot-ci-doctor analyze`
 *
 * 1. Build evidence bundle from the latest failed GitHub Actions run
 * 2. Cache the evidence bundle
 * 3. Call Copilot CLI with the hypotheses prompt
 * 4. Display ranked root-cause hypotheses + evidence summary
 * 5. Cache Copilot's response
 */

import chalk from "chalk";
import { buildEvidenceBundle, cacheBundle } from "../evidence/bundle.js";
import { askCopilot } from "../copilot/index.js";
import { writeCache } from "../utils/paths.js";
import { header, confidenceColor, printEvidenceSummary, fail } from "../utils/print.js";

export async function analyzeCommand() {
  try {
    header("🔍", "copilot-ci-doctor analyze");

    // Step 1 — Build evidence bundle
    const bundle = await buildEvidenceBundle();
    cacheBundle(bundle);

    // Step 2 — Show evidence summary
    printEvidenceSummary(bundle.evidence);

    // Step 3 — Call Copilot
    console.log(chalk.dim("🤖 Asking Copilot for root-cause hypotheses…\n"));
    const response = await askCopilot({ mode: "hypotheses", evidenceBundle: bundle });

    // Step 4 — Cache Copilot response
    writeCache("latest-hypotheses.json", response);

    // Step 5 — Display results
    console.log(chalk.bold.underline("Root-Cause Hypotheses:\n"));

    for (const h of response.hypotheses) {
      const color = confidenceColor(h.confidence);
      console.log(
        `  ${chalk.bold(`#${h.rank}`)} ${h.title}  ${color(`[${h.confidence}%]`)}`
      );
      console.log(`     ${chalk.dim(h.explanation)}`);
      console.log(
        `     Evidence: ${chalk.cyan(h.evidence_refs.join(", "))}\n`
      );
    }

    console.log(
      chalk.dim("Tip: Run `copilot-ci-doctor explain` for a plain-English breakdown.")
    );
  } catch (err) {
    fail("Analyze", err.message);
  }
}

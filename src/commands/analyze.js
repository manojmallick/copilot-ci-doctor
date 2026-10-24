/**
 * analyze.js — `copilot-ci-doctor analyze`
 *
 * 1. Build evidence bundle from a failed GitHub Actions run (latest, or --run-id / --branch / --repo)
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
import { emitJson } from "../utils/output.js";

/**
 * @param {object} [options]
 * @param {string} [options.repo]   OWNER/NAME to inspect instead of the current repository.
 * @param {string} [options.runId]  Diagnose this run instead of the latest failure.
 * @param {string} [options.branch] Latest failure on this branch.
 * @param {boolean} [options.json]  Print one JSON document on stdout.
 */
export async function analyzeCommand(options = {}) {
  try {
    header("🔍", "copilot-ci-doctor analyze");

    // Step 1 — Build evidence bundle
    const bundle = await buildEvidenceBundle({
      repo: options.repo,
      runId: options.runId,
      branch: options.branch,
    });
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

    const runEvidence = bundle.evidence.find((e) => e.type === "failed_run");
    emitJson({
      ok: true,
      command: "analyze",
      run: runEvidence ? runEvidence.data : null,
      hypotheses: response.hypotheses,
    });
  } catch (err) {
    fail("Analyze", err.message);
  }
}

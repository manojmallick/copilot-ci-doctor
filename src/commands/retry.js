/**
 * retry.js — `copilot-ci-doctor retry`
 *
 * Re-runs the most recent failed GitHub Actions workflow run.
 * Uses the cached evidence bundle's run ID if available,
 * otherwise queries for the latest failed run.
 */

import chalk from "chalk";
import { execa } from "execa";
import { loadCachedBundle } from "../evidence/bundle.js";
import { getLatestFailedRun, getRunHtmlUrl } from "../evidence/githubActions.js";
import { header, fail } from "../utils/print.js";

export async function retryCommand() {
  try {
    header("🔄", "copilot-ci-doctor retry");

    // Try cached run ID first, then query
    let runId;
    let workflowName;

    const bundle = loadCachedBundle();
    if (bundle) {
      const runEvidence = bundle.evidence.find((e) => e.type === "failed_run");
      if (runEvidence) {
        runId = runEvidence.data.runId;
        workflowName = runEvidence.data.workflow;
      }
    }

    if (!runId) {
      const failedRun = await getLatestFailedRun();
      if (!failedRun) {
        console.log(chalk.yellow("  No failed runs found to retry."));
        console.log(chalk.dim("  Run `copilot-ci-doctor analyze` first."));
        return;
      }
      runId = failedRun.databaseId;
      workflowName = failedRun.workflowName;
    }

    console.log(chalk.dim(`  Re-running: ${workflowName} (#${runId})`));

    // Trigger re-run
    await execa("gh", ["run", "rerun", String(runId), "--failed"]);

    // Get the URL for the user
    let htmlUrl;
    try {
      htmlUrl = await getRunHtmlUrl(runId);
    } catch {
      htmlUrl = `https://github.com/…/actions/runs/${runId}`;
    }

    console.log(chalk.green("\n  ✓ Re-run triggered successfully!"));
    console.log(chalk.dim(`  Watch progress: ${htmlUrl}`));
    console.log(chalk.dim("  Or run: gh run watch"));
  } catch (err) {
    fail("Retry", err.message);
  }
}

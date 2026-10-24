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
import { getLatestFailedRun, getRunById, getRunHtmlUrl, repoArgs } from "../evidence/githubActions.js";
import { header, fail } from "../utils/print.js";
import { emitJson } from "../utils/output.js";

/**
 * @param {object} [options]
 * @param {string} [options.repo]   OWNER/NAME instead of the current repository.
 * @param {string} [options.runId]  Re-run this run.
 * @param {string} [options.branch] Re-run the latest failure on this branch.
 * @param {boolean} [options.json]  Print one JSON document on stdout.
 */
export async function retryCommand(options = {}) {
  try {
    header("🔄", "copilot-ci-doctor retry");

    // Try cached run ID first, then query
    let runId;
    let workflowName;

    // An explicit --run-id / --branch / --repo always wins over the cached run.
    const explicitTarget = Boolean(options.runId || options.branch || options.repo);
    const bundle = explicitTarget ? null : loadCachedBundle();
    if (bundle) {
      const runEvidence = bundle.evidence.find((e) => e.type === "failed_run");
      if (runEvidence) {
        runId = runEvidence.data.runId;
        workflowName = runEvidence.data.workflow;
      }
    }

    if (!runId) {
      const failedRun = options.runId
        ? await getRunById(options.runId, { repo: options.repo })
        : await getLatestFailedRun({ repo: options.repo, branch: options.branch });
      if (!failedRun) {
        console.log(chalk.yellow("  No failed runs found to retry."));
        console.log(chalk.dim("  Run `copilot-ci-doctor analyze` first."));
        emitJson({ ok: false, command: "retry", error: "No failed runs found to retry." });
        return;
      }
      runId = failedRun.databaseId;
      workflowName = failedRun.workflowName;
    }

    console.log(chalk.dim(`  Re-running: ${workflowName} (#${runId})`));

    // Trigger re-run
    await execa("gh", ["run", "rerun", String(runId), "--failed", ...repoArgs(options.repo)]);

    // Get the URL for the user
    let htmlUrl;
    try {
      htmlUrl = await getRunHtmlUrl(runId, { repo: options.repo });
    } catch {
      htmlUrl = `https://github.com/…/actions/runs/${runId}`;
    }

    console.log(chalk.green("\n  ✓ Re-run triggered successfully!"));
    console.log(chalk.dim(`  Watch progress: ${htmlUrl}`));
    console.log(chalk.dim("  Or run: gh run watch"));
    emitJson({ ok: true, command: "retry", runId: String(runId), workflow: workflowName, url: htmlUrl });
  } catch (err) {
    fail("Retry", err.message);
  }
}

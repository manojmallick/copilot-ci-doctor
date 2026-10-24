/**
 * githubActions.js — Fetch GitHub Actions run data and logs
 *
 * All `gh` CLI calls related to Actions runs live here.
 */

import { execa } from "execa";
import { redact } from "./redact.js";

/**
 * Extra `gh` arguments that target another repository (`-R OWNER/NAME`).
 * Empty when no repository is given, so `gh` uses the current clone.
 *
 * @param {string} [repo]
 * @returns {string[]}
 */
export function repoArgs(repo) {
  return repo ? ["-R", repo] : [];
}

const RUN_FIELDS = "databaseId,workflowName,headBranch,event,conclusion,createdAt,url";

/**
 * Find the most recent failed GitHub Actions workflow run.
 *
 * @param {object} [opts]
 * @param {string} [opts.repo]   OWNER/NAME; defaults to the current repository.
 * @param {string} [opts.branch] Only consider runs on this branch.
 * @returns {Promise<object|null>} Run metadata or null if none found.
 */
export async function getLatestFailedRun({ repo, branch } = {}) {
  const args = ["run", "list", "--status", "failure", "--limit", "20", "--json", RUN_FIELDS];
  if (branch) args.push("--branch", branch);
  const { stdout } = await execa("gh", [...args, ...repoArgs(repo)]);
  const runs = JSON.parse(stdout);
  // Pick the most recent failure (list is sorted by recency)
  const failed = runs.find((r) => r.conclusion === "failure");
  return failed ?? null;
}

/**
 * Fetch one specific run by ID and make sure it failed.
 *
 * @param {string|number} runId
 * @param {object} [opts]
 * @param {string} [opts.repo]
 * @returns {Promise<object>} Run metadata (same shape as getLatestFailedRun).
 * @throws {Error} If the run does not exist or did not fail.
 */
export async function getRunById(runId, { repo } = {}) {
  let run;
  try {
    const { stdout } = await execa("gh", [
      "run", "view", String(runId), "--json", RUN_FIELDS, ...repoArgs(repo),
    ]);
    run = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Could not load run #${runId}: ${redact(err.stderr || err.message)}`);
  }
  if (run.conclusion !== "failure") {
    throw new Error(
      `Run #${runId} did not fail (conclusion: ${run.conclusion || "still running"}), so there is nothing to diagnose.`
    );
  }
  return run;
}

/**
 * Get the failed jobs for a given run ID.
 *
 * @param {number} runId
 * @param {object} [opts]
 * @param {string} [opts.repo]
 * @returns {Promise<object[]>}
 */
export async function getFailedJobs(runId, { repo } = {}) {
  const { stdout } = await execa("gh", [
    "run", "view", String(runId),
    "--json", "jobs",
    ...repoArgs(repo),
  ]);
  const { jobs } = JSON.parse(stdout);
  return jobs.filter((j) => j.conclusion === "failure");
}

/**
 * Get the HTML URL for a run (for printing to user).
 *
 * @param {number} runId
 * @param {object} [opts]
 * @param {string} [opts.repo]
 * @returns {Promise<string>}
 */
export async function getRunHtmlUrl(runId, { repo } = {}) {
  const { stdout } = await execa("gh", [
    "run", "view", String(runId),
    "--json", "url",
    ...repoArgs(repo),
  ]);
  return JSON.parse(stdout).url;
}

/**
 * Download log output for a failed run.
 * Keeps only the last N lines and redacts secrets.
 *
 * @param {number} runId
 * @param {number} [tailLines=200]
 * @param {object} [opts]
 * @param {string} [opts.repo]
 * @returns {Promise<string>} Redacted log excerpt.
 */
export async function getRunLogs(runId, tailLines = 200, { repo } = {}) {
  try {
    const { stdout } = await execa("gh", [
      "run", "view", String(runId), "--log-failed", ...repoArgs(repo),
    ]);
    const lines = stdout.split("\n");
    return redact(lines.slice(-tailLines).join("\n"));
  } catch {
    try {
      const { stdout } = await execa("gh", [
        "run", "view", String(runId), "--log", ...repoArgs(repo),
      ]);
      const lines = stdout.split("\n");
      return redact(lines.slice(-tailLines).join("\n"));
    } catch {
      return "[Could not retrieve logs]";
    }
  }
}

/**
 * Parse the failed step name from log output (best-effort heuristic).
 *
 * @param {string} logText
 * @returns {string|null}
 */
export function parseFailingStep(logText) {
  // GitHub Actions logs prefix lines with the step name
  // e.g. "Run tests  2024-01-01T... Process completed with exit code 1"
  const match = logText.match(/^(.+?)\s+\d{4}-\d{2}.*Process completed with exit code [^0]/m);
  return match ? match[1].trim() : null;
}

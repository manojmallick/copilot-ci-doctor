/**
 * githubActions.js — Fetch GitHub Actions run data and logs
 *
 * All `gh` CLI calls related to Actions runs live here.
 */

import { execa } from "execa";
import { redact } from "./redact.js";

/**
 * Find the most recent failed GitHub Actions workflow run.
 *
 * @returns {Promise<object|null>} Run metadata or null if none found.
 */
export async function getLatestFailedRun() {
  const { stdout } = await execa("gh", [
    "run", "list",
    "--status", "failure",
    "--limit", "20",
    "--json", "databaseId,workflowName,headBranch,event,conclusion,createdAt,url",
  ]);
  const runs = JSON.parse(stdout);
  // Pick the most recent failure (list is sorted by recency)
  const failed = runs.find((r) => r.conclusion === "failure");
  return failed ?? null;
}

/**
 * Get the failed jobs for a given run ID.
 *
 * @param {number} runId
 * @returns {Promise<object[]>}
 */
export async function getFailedJobs(runId) {
  const { stdout } = await execa("gh", [
    "run", "view", String(runId),
    "--json", "jobs",
  ]);
  const { jobs } = JSON.parse(stdout);
  return jobs.filter((j) => j.conclusion === "failure");
}

/**
 * Get the HTML URL for a run (for printing to user).
 *
 * @param {number} runId
 * @returns {Promise<string>}
 */
export async function getRunHtmlUrl(runId) {
  const { stdout } = await execa("gh", [
    "run", "view", String(runId),
    "--json", "url",
  ]);
  return JSON.parse(stdout).url;
}

/**
 * Download log output for a failed run.
 * Keeps only the last N lines and redacts secrets.
 *
 * @param {number} runId
 * @param {number} [tailLines=200]
 * @returns {Promise<string>} Redacted log excerpt.
 */
export async function getRunLogs(runId, tailLines = 200) {
  try {
    const { stdout } = await execa("gh", [
      "run", "view", String(runId), "--log-failed",
    ]);
    const lines = stdout.split("\n");
    return redact(lines.slice(-tailLines).join("\n"));
  } catch {
    try {
      const { stdout } = await execa("gh", [
        "run", "view", String(runId), "--log",
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

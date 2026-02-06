/**
 * bundle.js — Build and manage the Evidence Bundle
 *
 * The Evidence Bundle is the structured JSON object that every Copilot
 * prompt receives. Each piece of evidence has an ID (E1, E2, …) so
 * Copilot can reference them in its response.
 */

import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { getRepoInfo } from "./githubRepo.js";
import { getLatestFailedRun, getFailedJobs, getRunLogs } from "./githubActions.js";
import { redact } from "./redact.js";
import { writeCache, readCache } from "../utils/paths.js";

const EVIDENCE_CACHE_FILE = "latest-evidence.json";

/**
 * Read the workflow YAML file that triggered the run.
 *
 * @param {string} workflowName
 * @returns {string}
 */
function getWorkflowFile(workflowName) {
  const workflowsDir = path.join(process.cwd(), ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) {
    return "[No .github/workflows directory found]";
  }
  const files = fs.readdirSync(workflowsDir).filter((f) =>
    f.endsWith(".yml") || f.endsWith(".yaml")
  );

  for (const file of files) {
    const content = fs.readFileSync(path.join(workflowsDir, file), "utf-8");
    if (
      content.includes(`name: ${workflowName}`) ||
      content.includes(`name: '${workflowName}'`) ||
      content.includes(`name: "${workflowName}"`)
    ) {
      return redact(content);
    }
  }

  if (files.length > 0) {
    return redact(fs.readFileSync(path.join(workflowsDir, files[0]), "utf-8"));
  }

  return "[Could not locate workflow file]";
}

/**
 * Build a complete Evidence Bundle for the latest failed CI run.
 *
 * @returns {Promise<object>} The evidence bundle.
 */
export async function buildEvidenceBundle() {
  console.log(chalk.dim("📦 Building evidence bundle…"));

  // 1 — Repo info
  const repoInfo = await getRepoInfo();

  // 2 — Latest failed run
  const failedRun = await getLatestFailedRun();
  if (!failedRun) {
    throw new Error("No failed GitHub Actions runs found in this repository.");
  }
  console.log(
    chalk.yellow(`  Found failed run: ${failedRun.workflowName} (#${failedRun.databaseId})`)
  );

  // 3 — Failed jobs
  const failedJobs = await getFailedJobs(failedRun.databaseId);

  // 4 — Logs
  const logExcerpt = await getRunLogs(failedRun.databaseId);

  // 5 — Workflow file
  const workflowYaml = getWorkflowFile(failedRun.workflowName);

  // Assemble bundle with evidence IDs
  const bundle = {
    timestamp: new Date().toISOString(),
    evidence: [
      {
        id: "E1",
        type: "repo_info",
        data: {
          nameWithOwner: repoInfo.nameWithOwner,
          defaultBranch: repoInfo.defaultBranch,
          url: repoInfo.url,
        },
      },
      {
        id: "E2",
        type: "failed_run",
        data: {
          runId: failedRun.databaseId,
          workflow: failedRun.workflowName,
          branch: failedRun.headBranch,
          event: failedRun.event,
          conclusion: failedRun.conclusion,
          createdAt: failedRun.createdAt,
          url: failedRun.url,
        },
      },
      {
        id: "E3",
        type: "failed_jobs",
        data: failedJobs.map((j) => ({
          name: j.name,
          conclusion: j.conclusion,
          steps: j.steps
            ?.filter((s) => s.conclusion === "failure")
            .map((s) => ({ name: s.name, conclusion: s.conclusion })),
        })),
      },
      {
        id: "E4",
        type: "log_excerpt",
        data: logExcerpt,
      },
      {
        id: "E5",
        type: "workflow_yaml",
        data: workflowYaml,
      },
    ],
  };

  console.log(chalk.green("  ✓ Evidence bundle ready"));
  return bundle;
}

/**
 * Save the evidence bundle to cache.
 * @param {object} bundle
 */
export function cacheBundle(bundle) {
  writeCache(EVIDENCE_CACHE_FILE, bundle);
  console.log(chalk.dim(`  Cached → .copilot-ci-doctor/cache/${EVIDENCE_CACHE_FILE}`));
}

/**
 * Load a previously cached evidence bundle.
 * @returns {object|null}
 */
export function loadCachedBundle() {
  return readCache(EVIDENCE_CACHE_FILE);
}

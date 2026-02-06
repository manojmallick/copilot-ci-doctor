/**
 * watch.js — `copilot-ci-doctor watch`
 *
 * Continuously monitors the CI pipeline:
 *   1. Poll for the latest run status
 *   2. If it fails → analyze → explain → fix → push → wait for new run
 *   3. Repeat until CI passes OR fix confidence drops below 80%
 *   4. Print a final scoreboard
 */

import chalk from "chalk";
import { execa } from "execa";
import { analyzeCommand } from "./analyze.js";
import { explainCommand } from "./explain.js";
import { fixCommand } from "./fix.js";
import { readCache } from "../utils/paths.js";
import { header, stepDivider, success, warn, dim } from "../utils/print.js";

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 180_000;
const MIN_CONFIDENCE = 80;
const MAX_ITERATIONS = 5;

/**
 * Get the latest CI run (any status).
 * Returns { id, status, conclusion, workflow } or null.
 */
async function getLatestRun() {
  try {
    const { stdout } = await execa("gh", [
      "run", "list", "--limit", "1",
      "--json", "databaseId,status,conclusion,workflowName",
    ]);
    const runs = JSON.parse(stdout);
    if (runs.length === 0) return null;
    return {
      id: runs[0].databaseId,
      status: runs[0].status,
      conclusion: runs[0].conclusion,
      workflow: runs[0].workflowName,
    };
  } catch {
    return null;
  }
}

/**
 * Wait for a run to complete (success or failure). Returns the final conclusion.
 */
async function waitForRunCompletion(knownRunId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    process.stdout.write(chalk.dim("."));

    const run = await getLatestRun();
    if (!run) continue;

    // If the run is completed, return its conclusion
    if (run.status === "completed") {
      console.log("");
      return run.conclusion;
    }
  }

  console.log("");
  return "timeout";
}

/**
 * Wait for a NEW run to appear (different from previousRunId) and complete.
 */
async function waitForNewRunToComplete(previousRunId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  // First wait for a new run to appear
  dim("Waiting for new CI run to start…");
  let newRunId = null;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    process.stdout.write(chalk.dim("."));

    const run = await getLatestRun();
    if (run && run.id !== previousRunId) {
      newRunId = run.id;
      console.log("");
      dim(`New run detected: ${run.workflow} (#${run.id})`);
      break;
    }
  }

  if (!newRunId) {
    console.log("");
    return "timeout";
  }

  // Now wait for the new run to complete
  dim("Waiting for run to complete…");
  const completionDeadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < completionDeadline) {
    await sleep(POLL_INTERVAL_MS);
    process.stdout.write(chalk.dim("."));

    try {
      const { stdout } = await execa("gh", [
        "run", "view", String(newRunId),
        "--json", "status,conclusion",
      ]);
      const data = JSON.parse(stdout);
      if (data.status === "completed") {
        console.log("");
        return data.conclusion;
      }
    } catch {
      // run may not be queryable yet
    }
  }

  console.log("");
  return "timeout";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function watchCommand(options = {}) {
  const startTime = Date.now();
  let iteration = 0;
  const history = []; // track each iteration's results

  try {
    header("👁", "copilot-ci-doctor watch");
    dim("Monitoring CI pipeline — will analyze, explain, and fix failures automatically.");
    dim(`Minimum fix confidence: ${MIN_CONFIDENCE}% | Max iterations: ${MAX_ITERATIONS}\n`);

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(chalk.bold(`\n━━━ Iteration ${iteration} ━━━\n`));

      // Check current pipeline status
      dim("Checking pipeline status…");
      const run = await getLatestRun();

      if (!run) {
        warn("No CI runs found. Waiting for a run…\n");
        const conclusion = await waitForRunCompletion(null);
        if (conclusion === "timeout") {
          warn("Timed out waiting for a CI run.");
          break;
        }
        if (conclusion === "success") {
          success("CI passed!");
          history.push({ iteration, outcome: "success" });
          break;
        }
      } else if (run.status !== "completed") {
        dim(`Run in progress: ${run.workflow} (#${run.id}) — waiting…`);
        const conclusion = await waitForRunCompletion(run.id);
        if (conclusion === "timeout") {
          warn("Timed out waiting for run to complete.");
          break;
        }
        if (conclusion === "success") {
          success("CI passed!");
          history.push({ iteration, outcome: "success" });
          break;
        }
        dim(`Run failed (${conclusion}). Starting diagnosis…\n`);
      } else if (run.conclusion === "success") {
        success(`CI is passing! (${run.workflow} #${run.id})`);
        history.push({ iteration, outcome: "success" });
        break;
      } else {
        dim(`Latest run failed: ${run.workflow} (#${run.id})\n`);
      }

      // Step A — Analyze
      stepDivider("A", "Analyze");
      await analyzeCommand();

      // Step B — Explain
      stepDivider("B", "Explain");
      await explainCommand();

      // Step C — Fix
      stepDivider("C", "Fix");
      await fixCommand({ yes: true });

      // Check fix confidence
      const patch = readCache("latest-patch.json");
      const confidence = patch ? patch.confidence : 0;

      if (confidence < MIN_CONFIDENCE) {
        warn(`Fix confidence (${confidence}%) is below threshold (${MIN_CONFIDENCE}%). Stopping.`);
        history.push({ iteration, outcome: "low-confidence", confidence });
        break;
      }

      // Push the fix
      try {
        const branch = (await execa("git", ["branch", "--show-current"])).stdout.trim();
        dim(`Pushing fix branch: ${branch}…`);
        await execa("git", ["push", "-u", "origin", branch]);
        success(`Pushed fix branch: ${branch}`);
      } catch (pushErr) {
        warn(`Push failed: ${pushErr.message}`);
        history.push({ iteration, outcome: "push-failed" });
        break;
      }

      history.push({ iteration, outcome: "fix-pushed", confidence });

      // Wait for the new CI run triggered by the push
      const currentRun = await getLatestRun();
      const prevId = currentRun ? currentRun.id : null;
      const newConclusion = await waitForNewRunToComplete(prevId);

      if (newConclusion === "success") {
        success("CI is now passing after the fix!");
        history.push({ iteration: iteration + 0.5, outcome: "success" });
        break;
      } else if (newConclusion === "timeout") {
        warn("Timed out waiting for CI run to complete.");
        history.push({ iteration: iteration + 0.5, outcome: "timeout" });
        break;
      } else {
        warn(`CI still failing (${newConclusion}). Will try another fix…\n`);
      }
    }

    if (iteration >= MAX_ITERATIONS) {
      warn(`Reached max iterations (${MAX_ITERATIONS}). Stopping watch loop.`);
    }

    // Final scoreboard
    printWatchScoreboard(startTime, history);

  } catch (err) {
    console.error(chalk.red(`\n✖ Watch failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Print the final scoreboard for watch mode.
 */
function printWatchScoreboard(startTime, history) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const lastOutcome = history.length > 0 ? history[history.length - 1].outcome : "unknown";
  const fixed = lastOutcome === "success";

  console.log("");
  console.log(chalk.bold("─── Scoreboard ───\n"));

  // Pull data from cached responses
  const hypotheses = readCache("latest-hypotheses.json");
  const explain = readCache("latest-explain.json");
  const patch = readCache("latest-patch.json");

  if (hypotheses) {
    const top = hypotheses.hypotheses[0];
    console.log(`  ${chalk.bold("Top hypothesis:")} ${top.title} [${top.confidence}%]`);
  }

  if (explain) {
    console.log(`  ${chalk.bold("Explanation:")} ${explain.summary}`);
  }

  if (patch) {
    console.log(`  ${chalk.bold("Fix confidence:")} ${patch.confidence}%`);
    console.log(`  ${chalk.bold("Fix:")} ${patch.description}`);
    const filesChanged = (patch.patch.match(/^---\s+a\//gm) || []).length;
    console.log(`  ${chalk.bold("Files changed:")} ${filesChanged}`);
  }

  const iterations = history.filter((h) => Number.isInteger(h.iteration)).length;
  console.log(`\n  ${chalk.bold("Iterations:")} ${iterations}`);
  console.log(`  ${chalk.bold("Total time:")} ${elapsed}s`);

  if (fixed) {
    console.log(chalk.bold.green(`\n  CI before: ✖ FAILED → after fix: ✓ PASSING`));
    console.log(chalk.bold.green("\n🎉 CI is fixed!\n"));
  } else {
    const reason =
      lastOutcome === "low-confidence" ? "confidence too low"
      : lastOutcome === "timeout" ? "timed out"
      : lastOutcome === "push-failed" ? "push failed"
      : "max iterations reached";
    console.log(chalk.yellow(`\n  CI before: ✖ FAILED → after fix: ⏳ ${reason.toUpperCase()}`));
    console.log(chalk.dim("\n  Review the latest patch manually: .copilot-ci-doctor/cache/latest-patch.json\n"));
  }
}

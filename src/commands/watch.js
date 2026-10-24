/**
 * watch.js — `copilot-ci-doctor watch`
 *
 * Continuously monitors the CI pipeline with optimized token usage:
 *   1. Poll for the latest run status
 *   2. If it fails → single combined Copilot call (analyze+explain+fix) → push → wait
 *   3. Repeat until CI passes OR fix confidence drops below 80%
 *   4. Print a final scoreboard with token usage estimates
 *
 * Token optimization: uses a single combined prompt per iteration (~1,800 tokens)
 * instead of 3 separate calls (~5,400 tokens) — approximately 0.33x token usage.
 */

import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs";
import { buildEvidenceBundle, cacheBundle } from "../evidence/bundle.js";
import { askCopilot } from "../copilot/index.js";
import { writeCache, readCache, ensureCacheDir, cachePath } from "../utils/paths.js";
import { header, stepDivider, success, warn, dim, fail, confidenceColor, printDiff, printEvidenceSummary } from "../utils/print.js";
import { redact } from "../evidence/redact.js";
import { getRepoInfo, pickBaseBranch } from "../evidence/githubRepo.js";
import { normalizePatch, patchFilePaths } from "../utils/patch.js";
import { emitJson } from "../utils/output.js";
import { EXIT } from "../utils/options.js";

/** Defaults; every one can be changed with a command-line option. */
export const WATCH_DEFAULTS = Object.freeze({
  maxIterations: 5,
  minConfidence: 80,
  pollIntervalSeconds: 10,
  pollTimeoutSeconds: 180,
});

// Token estimation constants (approximate for GPT-4 class models)
// ~4 chars per token on average for English + JSON
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from a string.
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Get the latest CI run (any status).
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
 * Wait for a run to complete. Returns the final conclusion.
 */
async function waitForRunCompletion(knownRunId, cfg) {
  const deadline = Date.now() + cfg.pollTimeoutMs;
  while (Date.now() < deadline) {
    await sleep(cfg.pollIntervalMs);
    process.stdout.write(chalk.dim("."));
    const run = await getLatestRun();
    if (!run) continue;
    if (run.status === "completed") {
      console.log("");
      return run.conclusion;
    }
  }
  console.log("");
  return "timeout";
}

/**
 * Wait for a NEW run to appear and complete.
 */
async function waitForNewRunToComplete(previousRunId, cfg) {
  const deadline = Date.now() + cfg.pollTimeoutMs;

  dim("Waiting for new CI run to start…");
  let newRunId = null;
  while (Date.now() < deadline) {
    await sleep(cfg.pollIntervalMs);
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

  dim("Waiting for run to complete…");
  const completionDeadline = Date.now() + cfg.pollTimeoutMs;
  while (Date.now() < completionDeadline) {
    await sleep(cfg.pollIntervalMs);
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
    } catch { /* run may not be queryable yet */ }
  }
  console.log("");
  return "timeout";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} [options]
 * @param {number}  [options.maxIterations]  Fix attempts before giving up (default 5).
 * @param {number}  [options.minConfidence]  Stop when a fix is below this confidence (default 80).
 * @param {number}  [options.pollInterval]   Seconds between CI status checks (default 10).
 * @param {number}  [options.pollTimeout]    Seconds to wait for a CI run (default 180).
 * @param {string}  [options.base]           Branch for the pull request (default: the repository default branch).
 * @param {boolean} [options.pr]             Open a pull request when CI is fixed (default true; --no-pr turns it off).
 * @param {boolean} [options.dryRun]         Diagnose and check the patch, but do not branch, commit or push.
 * @param {boolean} [options.json]           Print one JSON document on stdout.
 */
export async function watchCommand(options = {}) {
  const MAX_ITERATIONS = options.maxIterations ?? WATCH_DEFAULTS.maxIterations;
  const MIN_CONFIDENCE = options.minConfidence ?? WATCH_DEFAULTS.minConfidence;
  const cfg = {
    pollIntervalMs: (options.pollInterval ?? WATCH_DEFAULTS.pollIntervalSeconds) * 1000,
    pollTimeoutMs: (options.pollTimeout ?? WATCH_DEFAULTS.pollTimeoutSeconds) * 1000,
  };
  const startTime = Date.now();
  let iteration = 0;
  const history = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    header("👁", "copilot-ci-doctor watch");
    dim("Monitoring CI pipeline — single-call mode (0.33x token usage).");
    dim(`Minimum fix confidence: ${MIN_CONFIDENCE}% | Max iterations: ${MAX_ITERATIONS}\n`);

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(chalk.bold(`\n━━━ Iteration ${iteration} ━━━\n`));

      // ── Check pipeline status ──
      dim("Checking pipeline status…");
      const run = await getLatestRun();

      if (!run) {
        warn("No CI runs found. Waiting for a run…\n");
        const conclusion = await waitForRunCompletion(null, cfg);
        if (conclusion === "timeout") { warn("Timed out waiting for a CI run."); break; }
        if (conclusion === "success") { success("CI passed!"); history.push({ iteration, outcome: "success" }); break; }
      } else if (run.status !== "completed") {
        dim(`Run in progress: ${run.workflow} (#${run.id}) — waiting…`);
        const conclusion = await waitForRunCompletion(run.id, cfg);
        if (conclusion === "timeout") { warn("Timed out waiting for run to complete."); break; }
        if (conclusion === "success") { success("CI passed!"); history.push({ iteration, outcome: "success" }); break; }
        dim(`Run failed (${conclusion}). Starting diagnosis…\n`);
      } else if (run.conclusion === "success") {
        success(`CI is passing! (${run.workflow} #${run.id})`);
        history.push({ iteration, outcome: "success" });
        break;
      } else {
        dim(`Latest run failed: ${run.workflow} (#${run.id})\n`);
      }

      // ── Collect evidence ──
      stepDivider("A", "Evidence");
      console.log(chalk.dim("📦 Building evidence bundle…"));
      const bundle = await buildEvidenceBundle();
      cacheBundle(bundle);
      printEvidenceSummary(bundle.evidence);

      // ── Single combined Copilot call ──
      stepDivider("B", "Diagnose + Fix");
      console.log(chalk.dim("🤖 Single Copilot call: analyze + explain + fix…\n"));

      const response = await askCopilot({ mode: "combined", evidenceBundle: bundle });

      // Estimate tokens for this call
      const bundleJson = JSON.stringify(bundle, null, 2);
      const inputTokens = estimateTokens(bundleJson) + 200; // prompt template overhead
      const outputTokens = estimateTokens(JSON.stringify(response));
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      console.log(chalk.dim(`  Tokens: ~${inputTokens} input + ~${outputTokens} output = ~${inputTokens + outputTokens} total\n`));

      // Cache individual pieces for compatibility
      writeCache("latest-hypotheses.json", {
        version: response.version,
        mode: "hypotheses",
        hypotheses: response.hypotheses,
      });
      writeCache("latest-explain.json", {
        version: response.version,
        mode: "explain",
        confidence: response.confidence,
        summary: response.summary,
        explanation: response.explanation,
        plain_english: response.plain_english,
        why_local_differs: response.why_local_differs,
        what_changed: response.what_changed,
        evidence_refs: response.evidence_refs,
      });
      writeCache("latest-patch.json", {
        version: response.version,
        mode: "patch",
        confidence: response.confidence,
        description: response.description,
        patch: response.patch,
        evidence_refs: response.evidence_refs,
        warnings: response.warnings,
      });

      // Display hypotheses
      console.log(chalk.bold.underline("Root-Cause Hypotheses:\n"));
      for (const h of response.hypotheses) {
        const color = confidenceColor(h.confidence);
        console.log(`  ${chalk.bold(`#${h.rank}`)} ${h.title}  ${color(`[${h.confidence}%]`)}`);
        console.log(`     ${chalk.dim(h.explanation)}`);
        console.log(`     Evidence: ${chalk.cyan(h.evidence_refs.join(", "))}\n`);
      }

      // Display explanation
      console.log(chalk.bold.underline("Explanation:\n"));
      console.log(`  ${chalk.bold("Summary:")} ${response.summary}`);
      if (response.plain_english) {
        for (const bullet of response.plain_english) {
          console.log(`    • ${bullet}`);
        }
      }
      console.log("");

      // Display fix
      const color = confidenceColor(response.confidence);
      console.log(chalk.bold.underline("Proposed Fix:\n"));
      console.log(`  ${chalk.bold("Description:")} ${response.description}`);
      console.log(`  ${chalk.bold("Confidence:")} ${color(`${response.confidence}%`)}`);
      console.log(`  ${chalk.bold("Evidence:")} ${chalk.cyan(response.evidence_refs.join(", "))}`);
      if (response.warnings && response.warnings.length > 0) {
        console.log(`  ${chalk.bold.yellow("Warnings:")}`);
        for (const w of response.warnings) {
          console.log(`    ⚠  ${w}`);
        }
      }

      // Show diff
      console.log(chalk.bold("\n--- Diff ---\n"));
      printDiff(response.patch);
      console.log("");

      // Check confidence threshold
      if (response.confidence < MIN_CONFIDENCE) {
        warn(`Fix confidence (${response.confidence}%) is below threshold (${MIN_CONFIDENCE}%). Stopping.`);
        history.push({ iteration, outcome: "low-confidence", confidence: response.confidence, inputTokens, outputTokens });
        break;
      }

      // Apply the patch
      ensureCacheDir();
      const patchFile = cachePath("proposed.patch");
      const normalizedPatch = normalizePatch(response.patch);
      fs.writeFileSync(patchFile, normalizedPatch, "utf-8");

      // Only these files will be staged after the patch is applied.
      const touched = patchFilePaths(normalizedPatch);
      if (touched.length === 0) {
        warn("Could not determine which files the patch changes. Stopping.");
        history.push({ iteration, outcome: "apply-failed", inputTokens, outputTokens });
        break;
      }

      // Pre-flight check
      try {
        await execa("git", ["apply", "--check", patchFile]);
      } catch (checkErr) {
        const errorMsg = redact(checkErr.stderr || checkErr.message);
        console.error(chalk.red(`\n  ✖ git apply --check failed: ${errorMsg}`));
        warn("Patch could not be applied. Stopping.");
        history.push({ iteration, outcome: "apply-failed", inputTokens, outputTokens });
        break;
      }

      if (options.dryRun) {
        success(`Dry run: the patch applies cleanly to ${touched.length} file(s): ${touched.join(", ")}`);
        dim("Nothing was changed: no branch, no commit, no push.");
        history.push({ iteration, outcome: "dry-run", confidence: response.confidence, files: touched, inputTokens, outputTokens });
        break;
      }

      // Create branch + apply
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const branchName = `ci-fix/${ts}`;
      dim(`Creating branch: ${branchName}`);
      await execa("git", ["checkout", "-b", branchName]);

      try {
        await execa("git", ["apply", patchFile]);
      } catch (applyErr) {
        const errorMsg = redact(applyErr.stderr || applyErr.message);
        console.error(chalk.red(`\n  ✖ git apply failed: ${errorMsg}`));
        await execa("git", ["checkout", "-"]).catch(() => {});
        history.push({ iteration, outcome: "apply-failed", inputTokens, outputTokens });
        break;
      }

      // Stage only the patched files, never unrelated changes or the cache folder.
      await execa("git", ["add", "--", ...touched]);
      const commitMsg = `CI Doctor: ${response.description || "automated fix"}`;
      await execa("git", ["commit", "-m", commitMsg]);
      success(`Patch applied and committed on ${branchName}`);

      // Push
      try {
        dim(`Pushing fix branch: ${branchName}…`);
        await execa("git", ["push", "-u", "origin", branchName]);
        success(`Pushed fix branch: ${branchName}`);
      } catch (pushErr) {
        warn(`Push failed: ${pushErr.message}`);
        history.push({ iteration, outcome: "push-failed", inputTokens, outputTokens });
        break;
      }

      history.push({ iteration, outcome: "fix-pushed", confidence: response.confidence, inputTokens, outputTokens });

      // Wait for new CI run
      const currentRun = await getLatestRun();
      const prevId = currentRun ? currentRun.id : null;
      const newConclusion = await waitForNewRunToComplete(prevId, cfg);

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

    const lastEntry = history[history.length - 1];
    if (iteration >= MAX_ITERATIONS && lastEntry && lastEntry.outcome === "fix-pushed") {
      warn(`Reached max iterations (${MAX_ITERATIONS}). Stopping watch loop.`);
    }

    // Final scoreboard (and the pull request, when CI was fixed)
    const result = await printWatchScoreboard(startTime, history, totalInputTokens, totalOutputTokens, { ...options, maxIterations: MAX_ITERATIONS });

    process.exitCode = result.exitCode;
    emitJson({
      ok: true,
      command: "watch",
      fixed: result.fixed,
      outcome: result.outcome,
      iterations: result.iterations,
      pullRequest: result.prUrl,
      tokens: { inputEstimate: totalInputTokens, outputEstimate: totalOutputTokens },
      history,
    });
  } catch (err) {
    fail("Watch", err.message);
  }
}

/**
 * Print the final scoreboard with token usage.
 * If CI is fixed, create a PR against the repository's default branch and show the link.
 */
async function printWatchScoreboard(startTime, history, totalInputTokens, totalOutputTokens, options = {}) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const lastOutcome = history.length > 0 ? history[history.length - 1].outcome : "unknown";
  // "Fixed" means a fix of ours was pushed and CI then passed. CI that was
  // already green when we started is reported separately, with no PR.
  const fixPushed = history.some((h) => h.outcome === "fix-pushed");
  const fixed = lastOutcome === "success" && fixPushed;
  const alreadyPassing = lastOutcome === "success" && !fixPushed;
  const dryRun = lastOutcome === "dry-run";
  let prUrl = null;

  console.log("");
  console.log(chalk.bold("─── Scoreboard ───\n"));

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
  const totalTokens = totalInputTokens + totalOutputTokens;
  const oldModeTokens = totalInputTokens * 3; // 3 separate calls would send evidence 3x
  const savings = oldModeTokens > 0 ? ((1 - totalTokens / oldModeTokens) * 100).toFixed(0) : 0;

  console.log(`\n  ${chalk.bold("Iterations:")} ${iterations}`);
  console.log(`  ${chalk.bold("Total time:")} ${elapsed}s`);

  // Token usage summary
  console.log(chalk.bold("\n  Token Usage (estimated):"));
  console.log(`    Input:  ~${totalInputTokens.toLocaleString()} tokens`);
  console.log(`    Output: ~${totalOutputTokens.toLocaleString()} tokens`);
  console.log(`    Total:  ~${totalTokens.toLocaleString()} tokens`);
  console.log(`    ${chalk.green(`Savings: ~${savings}% vs 3-call mode`)}`);

  if (alreadyPassing) {
    console.log(chalk.bold.green("\n  CI is already passing: nothing to fix.\n"));
  } else if (dryRun) {
    console.log(chalk.bold.green("\n  Dry run complete: the proposed fix applies cleanly. Nothing was changed.\n"));
  } else if (fixed) {
    console.log(chalk.bold.green(`\n  CI before: ✖ FAILED → after fix: ✓ PASSING`));
    console.log(chalk.bold.green("\n🎉 CI is fixed!\n"));

    // Create a PR against --base, or else the repository's default branch
    let baseBranch = pickBaseBranch(options.base);
    if (!options.base) {
      try {
        baseBranch = pickBaseBranch((await getRepoInfo()).defaultBranch);
      } catch {
        // keep the fallback if the default branch cannot be determined
      }
    }
    if (options.pr === false) {
      const fixBranch = (await execa("git", ["branch", "--show-current"]).catch(() => ({ stdout: "" }))).stdout.trim();
      dim(`Pull request skipped (--no-pr). Fix branch: ${fixBranch || "(unknown)"}`);
    } else try {
      const branch = (await execa("git", ["branch", "--show-current"])).stdout.trim();
      const prTitle = patch
        ? `CI Doctor: ${patch.description}`
        : `CI Doctor: automated CI fix`;
      const prBody = [
        "## CI Doctor — Automated Fix",
        "",
        patch ? `**Fix:** ${patch.description}` : "",
        patch ? `**Confidence:** ${patch.confidence}%` : "",
        hypotheses ? `**Root cause:** ${hypotheses.hypotheses[0].title}` : "",
        explain ? `**Explanation:** ${explain.summary}` : "",
        "",
        `**Iterations:** ${iterations}`,
        `**Total tokens:** ~${totalTokens.toLocaleString()}`,
        `**Time:** ${elapsed}s`,
        "",
        "_Generated by [copilot-ci-doctor](https://www.npmjs.com/package/copilot-ci-doctor)_",
      ].filter(Boolean).join("\n");

      dim(`Creating pull request against ${baseBranch}…`);
      const { stdout: createdUrl } = await execa("gh", [
        "pr", "create",
        "--base", baseBranch,
        "--head", branch,
        "--title", prTitle,
        "--body", prBody,
      ]);

      prUrl = createdUrl.trim();
      console.log(chalk.bold.green(`\n  🔗 Pull Request: ${prUrl}`));
    } catch (prErr) {
      warn(`Could not create PR: ${prErr.message}`);
      dim(`Create it manually: gh pr create --base ${baseBranch}`);
    }
  } else {
    const reason =
      lastOutcome === "low-confidence" ? "confidence too low"
      : lastOutcome === "timeout" ? "timed out"
      : lastOutcome === "push-failed" ? "push failed"
      : lastOutcome === "apply-failed" ? "patch apply failed"
      : `max iterations reached (${options.maxIterations ?? WATCH_DEFAULTS.maxIterations})`;
    console.log(chalk.yellow(`\n  CI before: ✖ FAILED → after fix: ⏳ ${reason.toUpperCase()}`));
    console.log(chalk.dim("\n  Review the latest patch manually: .copilot-ci-doctor/cache/latest-patch.json\n"));
  }

  const succeeded = fixed || alreadyPassing || dryRun;
  return {
    fixed,
    outcome: fixed ? "fixed" : alreadyPassing ? "already-passing" : lastOutcome === "fix-pushed" ? "max-iterations" : lastOutcome,
    iterations,
    prUrl,
    exitCode: succeeded ? EXIT.OK : EXIT.NOT_FIXED,
  };
}

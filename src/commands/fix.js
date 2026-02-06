/**
 * fix.js — `copilot-ci-doctor fix [--safe] [--yes]`
 *
 * Calls Copilot CLI with the patch prompt, shows the diff to the user,
 * asks for confirmation, and applies the patch on a new git branch.
 *
 * Safety guarantees:
 *   - `git apply --check` before actual apply
 *   - Never auto-applies without showing the diff (unless --yes)
 *   - Always creates a new branch before applying
 *   - Refuses to apply if confidence < 60 or risk == "HIGH"
 *   - Never prints or modifies secrets
 *   - Commits with a clear "CI Doctor:" message
 */

import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs";
import readline from "node:readline";
import { loadCachedBundle } from "../evidence/bundle.js";
import { askCopilot } from "../copilot/index.js";
import { writeCache, writeCacheText, cachePath, ensureCacheDir } from "../utils/paths.js";
import { header, confidenceColor, printDiff, fail } from "../utils/print.js";
import { redact } from "../evidence/redact.js";

/**
 * Normalize a unified diff by recounting hunk line counts.
 * LLMs frequently emit wrong @@ line counts, causing `git apply` to fail
 * with "corrupt patch". This function fixes the headers.
 */
function normalizePatch(patchText) {
  // Strip \r for consistent line endings and trim trailing whitespace/newlines
  // so split("\n") doesn't produce a phantom empty element that fixHunkHeader
  // would mis-count as a context line.
  const lines = patchText.replace(/\r/g, "").trimEnd().split("\n");
  const output = [];
  let hunkStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("@@")) {
      // If we have a previous hunk, fix its header
      if (hunkStart >= 0) {
        fixHunkHeader(output, hunkStart);
      }
      hunkStart = output.length;
      output.push(line);
    } else {
      output.push(line);
    }
  }

  // Fix the last hunk
  if (hunkStart >= 0) {
    fixHunkHeader(output, hunkStart);
  }

  // Ensure the patch always ends with a newline (required by git apply)
  return output.join("\n") + "\n";
}

function fixHunkHeader(lines, hunkIdx) {
  // Parse existing header to get starting line numbers
  const header = lines[hunkIdx];
  const match = header.match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)$/);
  if (!match) return;

  const oldStart = parseInt(match[1], 10);
  const newStart = parseInt(match[2], 10);
  const trailing = match[3] || "";

  let oldCount = 0;
  let newCount = 0;

  for (let i = hunkIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("@@") || l.startsWith("diff ") || l.startsWith("--- ") || l.startsWith("+++ ")) break;
    if (l.startsWith("-")) {
      oldCount++;
    } else if (l.startsWith("+")) {
      newCount++;
    } else {
      // context line (or empty line within hunk)
      oldCount++;
      newCount++;
    }
  }

  lines[hunkIdx] = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${trailing}`;
}

/**
 * Prompt the user for a yes/no confirmation via stdin.
 */
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export async function fixCommand(options) {
  try {
    header("🔧", "copilot-ci-doctor fix");

    // Load cached bundle
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
    console.log(chalk.dim("🤖 Asking Copilot for a fix…\n"));
    const response = await askCopilot({ mode: "patch", evidenceBundle: bundle });

    // Cache response
    writeCache("latest-patch.json", response);

    // Display proposed fix
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

    // Safety gate: refuse to apply low-confidence or HIGH-risk patches
    const risk = (response.risk || "").toUpperCase();
    if (response.confidence < 60) {
      console.log(chalk.red(`\n  ✖ Confidence too low (${response.confidence}%) — not applying automatically.`));
      console.log(chalk.dim("  Review the patch manually. Saved to .copilot-ci-doctor/cache/latest-patch.json"));
      return;
    }
    if (risk === "HIGH") {
      console.log(chalk.red("\n  ✖ Risk level is HIGH — not applying automatically."));
      console.log(chalk.dim("  Review the patch manually. Saved to .copilot-ci-doctor/cache/latest-patch.json"));
      return;
    }

    // Show diff (truncate if > 400 lines)
    const diffLines = response.patch.split("\n");
    const MAX_DIFF_LINES = 400;
    console.log(chalk.bold("\n--- Diff ---\n"));
    if (diffLines.length > MAX_DIFF_LINES) {
      printDiff(diffLines.slice(0, MAX_DIFF_LINES).join("\n"));
      console.log(chalk.yellow(`\n  … diff truncated (${diffLines.length} lines total, showing first ${MAX_DIFF_LINES})`));
      console.log(chalk.dim("  Full patch: .copilot-ci-doctor/cache/proposed.patch"));
    } else {
      printDiff(response.patch);
    }
    console.log("");

    // Confirmation (skip if --yes)
    if (options.yes) {
      console.log(chalk.dim("  Auto-confirmed (--yes flag)."));
    } else {
      const yes = await confirm(chalk.yellow("Apply this patch on a new branch?"));
      if (!yes) {
        console.log(chalk.dim("  Patch not applied."));
        return;
      }
    }

    // Write patch to file (normalize hunk headers first)
    ensureCacheDir();
    const patchFile = cachePath("proposed.patch");
    const normalizedPatch = normalizePatch(response.patch);
    fs.writeFileSync(patchFile, normalizedPatch, "utf-8");

    // Pre-flight: git apply --check
    try {
      await execa("git", ["apply", "--check", patchFile]);
    } catch (checkErr) {
      const errorMsg = redact(checkErr.stderr || checkErr.message);
      writeCacheText("git-apply-error.txt", errorMsg);
      console.error(chalk.red(`\n  ✖ git apply --check failed:`));
      console.error(chalk.dim(`  ${errorMsg}`));
      console.log(chalk.dim("  Error saved to .copilot-ci-doctor/cache/git-apply-error.txt"));
      console.log(chalk.dim("  Try manually: git apply --3way .copilot-ci-doctor/cache/proposed.patch"));
      return;
    }

    // Create new branch (YYYYMMDD-HHMMSS format)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const branchName = `ci-fix/${ts}`;
    console.log(chalk.dim(`\n  Creating branch: ${branchName}`));
    await execa("git", ["checkout", "-b", branchName]);

    // Apply the patch
    try {
      await execa("git", ["apply", patchFile]);
    } catch (applyErr) {
      const errorMsg = redact(applyErr.stderr || applyErr.message);
      writeCacheText("git-apply-error.txt", errorMsg);
      console.error(chalk.red(`\n  ✖ git apply failed: ${errorMsg}`));
      console.log(chalk.dim("  Switching back to previous branch…"));
      await execa("git", ["checkout", "-"]).catch(() => {});
      console.log(chalk.dim("  Try manually: git apply --3way .copilot-ci-doctor/cache/proposed.patch"));
      return;
    }

    // Stage and commit
    await execa("git", ["add", "-A"]);
    const commitMsg = `CI Doctor: ${response.description || "automated fix"}`;
    await execa("git", ["commit", "-m", commitMsg]);

    console.log(chalk.green("\n  ✓ Patch applied and committed!"));
    console.log(chalk.dim(`  Branch: ${branchName}`));
    console.log(chalk.dim(`  Commit: ${commitMsg}`));
    console.log(chalk.dim(`  Push when ready: git push -u origin ${branchName}`));
  } catch (err) {
    fail("Fix", err.message);
  }
}

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
import { normalizePatch, patchFilePaths } from "../utils/patch.js";

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

    // Only these files will be staged after the patch is applied.
    const touched = patchFilePaths(normalizedPatch);
    if (touched.length === 0) {
      console.error(chalk.red("\n  ✖ Could not determine which files the patch changes — not applying."));
      console.log(chalk.dim("  Review it manually: .copilot-ci-doctor/cache/proposed.patch"));
      return;
    }

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

    // Stage only the files the patch touched, so unrelated local changes and
    // the .copilot-ci-doctor/ cache folder never end up in the fix commit.
    await execa("git", ["add", "--", ...touched]);
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

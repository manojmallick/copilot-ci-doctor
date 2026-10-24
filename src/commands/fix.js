/**
 * fix.js — `copilot-ci-doctor fix [--yes] [--dry-run] [--min-confidence <n>] [--json]`
 *
 * Calls Copilot CLI with the patch prompt, shows the diff to the user,
 * asks for confirmation, and applies the patch on a new git branch.
 *
 * Safety guarantees:
 *   - `git apply --check` before actual apply
 *   - Never auto-applies without showing the diff (unless --yes)
 *   - Always creates a new branch before applying
 *   - Refuses to apply if confidence is below the minimum (default 60) or risk == "HIGH"
 *   - --dry-run shows the diff and runs `git apply --check` but changes nothing
 *   - Never prints or modifies secrets
 *   - Commits with a clear "CI Doctor:" message
 */

import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs";
import { loadCachedBundle } from "../evidence/bundle.js";
import { askCopilot } from "../copilot/index.js";
import { writeCache, writeCacheText, cachePath, ensureCacheDir } from "../utils/paths.js";
import { header, confidenceColor, printDiff, fail } from "../utils/print.js";
import { redact } from "../evidence/redact.js";
import { normalizePatch, patchFilePaths } from "../utils/patch.js";
import { confirm } from "../utils/prompt.js";
import { emitJson } from "../utils/output.js";
import { EXIT } from "../utils/options.js";

/** Minimum confidence below which `fix` never applies a patch on its own. */
export const DEFAULT_MIN_CONFIDENCE = 60;

/**
 * @param {object} [options]
 * @param {boolean} [options.yes]           Apply without asking for confirmation.
 * @param {boolean} [options.dryRun]        Show the diff and check it applies; change nothing.
 * @param {number}  [options.minConfidence] Refuse patches below this confidence (default 60).
 * @param {boolean} [options.json]          Print one JSON document on stdout.
 */
export async function fixCommand(options = {}) {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  // Every outcome goes through here: exit status plus the optional JSON document.
  const finish = (exitCode, result) => {
    process.exitCode = exitCode;
    emitJson({ ok: exitCode !== EXIT.ERROR, command: "fix", dryRun: Boolean(options.dryRun), ...result });
  };

  try {
    header("🔧", "copilot-ci-doctor fix");

    // Load cached bundle
    const bundle = loadCachedBundle();
    if (!bundle) {
      console.log(
        chalk.yellow("  No cached evidence bundle found.\n") +
        chalk.dim("  Run `copilot-ci-doctor analyze` first to collect evidence.")
      );
      emitJson({ ok: false, command: "fix", error: "No cached evidence bundle found. Run analyze first." });
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

    const risk = (response.risk || "").toUpperCase();
    const summary = {
      description: response.description,
      confidence: response.confidence,
      risk: risk || null,
      warnings: response.warnings || [],
    };

    // Safety gate: refuse to apply low-confidence or HIGH-risk patches
    if (response.confidence < minConfidence) {
      console.log(chalk.red(`\n  ✖ Confidence too low (${response.confidence}%, minimum ${minConfidence}%) — not applying automatically.`));
      console.log(chalk.dim("  Review the patch manually. Saved to .copilot-ci-doctor/cache/latest-patch.json"));
      return finish(EXIT.NOT_FIXED, { ...summary, applied: false, reason: "low-confidence", patch: response.patch });
    }
    if (risk === "HIGH") {
      console.log(chalk.red("\n  ✖ Risk level is HIGH — not applying automatically."));
      console.log(chalk.dim("  Review the patch manually. Saved to .copilot-ci-doctor/cache/latest-patch.json"));
      return finish(EXIT.NOT_FIXED, { ...summary, applied: false, reason: "high-risk", patch: response.patch });
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
      return finish(EXIT.NOT_FIXED, { ...summary, applied: false, reason: "no-files", patch: response.patch });
    }

    // Pre-flight: git apply --check (also the whole of a dry run)
    try {
      await execa("git", ["apply", "--check", patchFile]);
    } catch (checkErr) {
      const errorMsg = redact(checkErr.stderr || checkErr.message);
      writeCacheText("git-apply-error.txt", errorMsg);
      console.error(chalk.red(`\n  ✖ git apply --check failed:`));
      console.error(chalk.dim(`  ${errorMsg}`));
      console.log(chalk.dim("  Error saved to .copilot-ci-doctor/cache/git-apply-error.txt"));
      console.log(chalk.dim("  Try manually: git apply --3way .copilot-ci-doctor/cache/proposed.patch"));
      return finish(EXIT.NOT_FIXED, { ...summary, files: touched, applied: false, reason: "does-not-apply", error: errorMsg, patch: response.patch });
    }

    if (options.dryRun) {
      console.log(chalk.green(`  ✓ Dry run: the patch applies cleanly to ${touched.length} file(s): ${touched.join(", ")}`));
      console.log(chalk.dim("  Nothing was changed: no branch, no commit. Run without --dry-run to apply it."));
      return finish(EXIT.OK, { ...summary, files: touched, applied: false, reason: "dry-run", patch: response.patch });
    }

    // Confirmation (skip if --yes)
    if (options.yes) {
      console.log(chalk.dim("  Auto-confirmed (--yes flag)."));
    } else {
      const yes = await confirm(chalk.yellow("Apply this patch on a new branch?"));
      if (!yes) {
        console.log(chalk.dim(process.stdin.isTTY ? "  Patch not applied." : "  Patch not applied (not an interactive terminal; pass --yes to apply without asking)."));
        return finish(EXIT.NOT_FIXED, { ...summary, files: touched, applied: false, reason: "declined", patch: response.patch });
      }
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
      return finish(EXIT.NOT_FIXED, { ...summary, files: touched, applied: false, reason: "apply-failed", error: errorMsg, patch: response.patch });
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
    finish(EXIT.OK, { ...summary, files: touched, applied: true, branch: branchName, commit: commitMsg, patch: response.patch });
  } catch (err) {
    fail("Fix", err.message);
  }
}

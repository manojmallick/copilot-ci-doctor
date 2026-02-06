/**
 * invoke.js — Low-level wrapper for calling GitHub Copilot CLI via execa
 *
 * Handles shell execution, timeout, and raw output capture.
 * Does NOT parse or validate JSON — that's the caller's job.
 */

import { execa } from "execa";
import chalk from "chalk";

/**
 * Check that the `gh` CLI is installed and accessible.
 * @throws {Error}
 */
export async function ensureGhCli() {
  try {
    await execa("gh", ["--version"]);
  } catch {
    throw new Error(
      "GitHub CLI (gh) is not installed or not in PATH.\n" +
      "Install it from https://cli.github.com and run `gh auth login`."
    );
  }
}

/**
 * Invoke GitHub Copilot CLI with a prompt in non-interactive mode.
 *
 * Uses `gh copilot -p "<prompt>" -s` for silent, scriptable output.
 *
 * @param {string} promptText - The full rendered prompt.
 * @param {number} [timeoutMs=180000] - Timeout in milliseconds.
 * @returns {Promise<string>} Raw stdout from Copilot CLI.
 */
export async function invokeCopilotCli(promptText, timeoutMs = 180_000) {
  await ensureGhCli();

  console.log(chalk.dim("⏳ Calling Copilot CLI…"));

  try {
    const result = await execa("gh", [
      "copilot",
      "-p", promptText,
      "-s",
      "--no-custom-instructions",
    ], {
      timeout: timeoutMs,
    });
    return result.stdout;
  } catch (err) {
    throw new Error(
      `Copilot CLI invocation failed:\n${err.stderr || err.message}`
    );
  }
}

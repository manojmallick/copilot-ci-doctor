/**
 * print.js — Consistent formatting helpers for CLI output
 *
 * Keeps terminal output uniform across all commands.
 */

import chalk from "chalk";

/**
 * Print a section header.
 * @param {string} emoji
 * @param {string} title
 */
export function header(emoji, title) {
  console.log(chalk.bold(`\n${emoji} ${title}\n`));
}

/**
 * Print a step divider for demo mode.
 * @param {number} step
 * @param {string} label
 */
export function stepDivider(step, label) {
  console.log(chalk.bold(`\n─── Step ${step}: ${label} ───\n`));
}

/**
 * Print a dim info line (secondary info).
 * @param {string} msg
 */
export function dim(msg) {
  console.log(chalk.dim(`  ${msg}`));
}

/**
 * Print a success line.
 * @param {string} msg
 */
export function success(msg) {
  console.log(chalk.green(`  ✓ ${msg}`));
}

/**
 * Print a warning line.
 * @param {string} msg
 */
export function warn(msg) {
  console.log(chalk.yellow(`  ⚠ ${msg}`));
}

/**
 * Print an error and exit.
 * @param {string} label - Command name (e.g. "Analyze")
 * @param {string} message
 */
export function fail(label, message) {
  console.error(chalk.red(`\n✖ ${label} failed: ${message}`));
  process.exit(1);
}

/**
 * Return a chalk color function based on confidence level.
 * @param {number} confidence
 * @returns {Function}
 */
export function confidenceColor(confidence) {
  if (confidence >= 70) return chalk.green;
  if (confidence >= 40) return chalk.yellow;
  return chalk.red;
}

/**
 * Print a colorized unified diff.
 * @param {string} diffText
 */
export function printDiff(diffText) {
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      console.log(chalk.green(line));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      console.log(chalk.red(line));
    } else if (line.startsWith("@@")) {
      console.log(chalk.cyan(line));
    } else {
      console.log(line);
    }
  }
}

/**
 * Print an evidence pack summary (max entries shown).
 * @param {object[]} evidenceArray - Array of { id, type, data } objects
 * @param {number} [maxEntries=6]
 */
export function printEvidenceSummary(evidenceArray, maxEntries = 6) {
  console.log(chalk.bold.underline("Evidence Pack:\n"));
  const entries = evidenceArray.slice(0, maxEntries);
  for (const e of entries) {
    const excerpt = typeof e.data === "string"
      ? e.data.slice(0, 120).replace(/\n/g, " ")
      : JSON.stringify(e.data).slice(0, 120);
    console.log(`  ${chalk.cyan(e.id)} [${e.type}]: ${chalk.dim(excerpt + (excerpt.length >= 120 ? "…" : ""))}`);
  }
  if (evidenceArray.length > maxEntries) {
    console.log(chalk.dim(`  … and ${evidenceArray.length - maxEntries} more entries`));
  }
  console.log("");
}

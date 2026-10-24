/**
 * options.js — command-line option parsers and exit codes.
 *
 * Parsers are plain functions for commander's `.option(flags, desc, parser)`.
 * They throw InvalidArgumentError so commander prints a clean message and
 * exits with status 1 before any command runs.
 */

import { InvalidArgumentError } from "commander";

/** Process exit codes used by every command. */
export const EXIT = Object.freeze({
  /** The command did what was asked (CI fixed, patch applied, analysis printed). */
  OK: 0,
  /** Something went wrong: bad input, missing tool, API or git failure. */
  ERROR: 1,
  /** The command ran correctly but did not reach its goal: confidence too low, patch declined or not applicable, iterations or time used up. */
  NOT_FIXED: 2,
});

/** A whole number between min and max (inclusive). */
export function intInRange(min, max) {
  return (value) => {
    if (!/^-?\d+$/.test(String(value).trim())) {
      throw new InvalidArgumentError(`expected a whole number between ${min} and ${max}.`);
    }
    const n = Number(value);
    if (n < min || n > max) {
      throw new InvalidArgumentError(`must be between ${min} and ${max}.`);
    }
    return n;
  };
}

/** A number (decimals allowed) between min and max (inclusive). */
export function numberInRange(min, max) {
  return (value) => {
    const n = Number(value);
    if (String(value).trim() === "" || !Number.isFinite(n)) {
      throw new InvalidArgumentError(`expected a number between ${min} and ${max}.`);
    }
    if (n < min || n > max) {
      throw new InvalidArgumentError(`must be between ${min} and ${max}.`);
    }
    return n;
  };
}

/** A GitHub Actions run ID: digits only. */
export function parseRunId(value) {
  if (!/^\d+$/.test(String(value).trim())) {
    throw new InvalidArgumentError("a run ID is a number, for example 1234567890.");
  }
  return String(value).trim();
}

/** A repository in OWNER/NAME form. */
export function parseRepo(value) {
  const v = String(value).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)) {
    throw new InvalidArgumentError("use the form OWNER/NAME, for example octocat/hello-world.");
  }
  return v;
}

/** A git branch name that cannot be mistaken for a command-line option. */
export function parseBranch(value) {
  const v = String(value).trim();
  if (!v || v.startsWith("-") || /[\s~^:?*[\\]/.test(v) || v.includes("..")) {
    throw new InvalidArgumentError("not a valid branch name.");
  }
  return v;
}

/**
 * githubRepo.js — Infer repository information
 *
 * Uses `gh` CLI and git to determine the current repo's owner/name.
 */

import { execa } from "execa";

/**
 * Get repository metadata via `gh repo view`.
 *
 * @param {object} [opts]
 * @param {string} [opts.repo] OWNER/NAME; defaults to the current repository.
 * @returns {Promise<object>} { nameWithOwner, defaultBranch, url }
 */
export async function getRepoInfo({ repo } = {}) {
  try {
    const { stdout } = await execa("gh", [
      "repo", "view",
      ...(repo ? [repo] : []),
      "--json", "nameWithOwner,defaultBranchRef,url",
    ]);
    const data = JSON.parse(stdout);
    return {
      nameWithOwner: data.nameWithOwner,
      defaultBranch: data.defaultBranchRef?.name ?? "unknown",
      url: data.url,
    };
  } catch {
    throw new Error(
      repo
        ? `Could not retrieve repo info for ${repo}. Check the name and that \`gh\` is authenticated with access to it.`
        : "Could not retrieve repo info. Make sure you are inside a GitHub repository and `gh` is authenticated."
    );
  }
}

/**
 * Choose the branch to open a pull request against.
 * Uses the repository's default branch when known, otherwise "main".
 *
 * @param {string|null|undefined} defaultBranch
 * @returns {string}
 */
export function pickBaseBranch(defaultBranch) {
  return defaultBranch && defaultBranch !== "unknown" ? defaultBranch : "main";
}

/**
 * Infer owner/repo from git remote origin URL (fallback).
 *
 * @returns {Promise<string|null>} "owner/repo" or null
 */
export async function inferRepoFromGit() {
  try {
    const { stdout } = await execa("git", ["remote", "get-url", "origin"]);
    // Match git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const match = stdout.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

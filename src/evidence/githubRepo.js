/**
 * githubRepo.js — Infer repository information
 *
 * Uses `gh` CLI and git to determine the current repo's owner/name.
 */

import { execa } from "execa";

/**
 * Get repository metadata via `gh repo view`.
 *
 * @returns {Promise<object>} { nameWithOwner, defaultBranch, url }
 */
export async function getRepoInfo() {
  try {
    const { stdout } = await execa("gh", [
      "repo", "view",
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
      "Could not retrieve repo info. Make sure you are inside a GitHub repository and `gh` is authenticated."
    );
  }
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

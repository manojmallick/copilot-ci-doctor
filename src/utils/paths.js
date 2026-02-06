/**
 * paths.js — Helper to resolve project-relative paths consistently
 *
 * All cache, prompt, and temp file paths go through here so we have
 * a single place to change conventions.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root of the copilot-ci-doctor package (one level above src/) */
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/** Directory containing prompt templates */
export const PROMPTS_DIR = path.join(PROJECT_ROOT, "prompts");

/** Cache directory inside the user's working repo */
export function cacheDir() {
  return path.join(process.cwd(), ".copilot-ci-doctor", "cache");
}

/**
 * Ensure the cache directory exists and return its path.
 * @returns {string}
 */
export function ensureCacheDir() {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolve a path inside the cache directory.
 * @param {string} filename
 * @returns {string}
 */
export function cachePath(filename) {
  return path.join(cacheDir(), filename);
}

/**
 * Write JSON to a cache file. Creates the cache dir if needed.
 * @param {string} filename
 * @param {object} data
 */
export function writeCache(filename, data) {
  ensureCacheDir();
  fs.writeFileSync(cachePath(filename), JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Read JSON from a cache file, or return null if it doesn't exist.
 * @param {string} filename
 * @returns {object|null}
 */
export function readCache(filename) {
  const fp = cachePath(filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

/**
 * Write raw text to a cache file (for debug dumps).
 * @param {string} filename
 * @param {string} text
 */
export function writeCacheText(filename, text) {
  ensureCacheDir();
  fs.writeFileSync(cachePath(filename), text, "utf-8");
}

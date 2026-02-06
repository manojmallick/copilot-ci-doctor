/**
 * loadPrompt.js — Load and render prompt templates
 *
 * Reads prompt files from the prompts/ directory and replaces
 * the {{EVIDENCE_BUNDLE_JSON}} placeholder with the actual evidence.
 */

import fs from "node:fs";
import path from "node:path";
import { PROMPTS_DIR } from "../utils/paths.js";

/**
 * Load a prompt template and inject the evidence bundle.
 *
 * @param {"hypotheses"|"explain"|"patch"} mode
 * @param {object} evidenceBundle
 * @returns {string} Fully-rendered prompt string.
 */
export function loadPrompt(mode, evidenceBundle) {
  const promptFile = path.join(PROMPTS_DIR, `${mode}.txt`);
  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt template not found: ${promptFile}`);
  }

  const template = fs.readFileSync(promptFile, "utf-8");

  // Support both placeholder conventions
  return template
    .replace("{{EVIDENCE_BUNDLE_JSON}}", JSON.stringify(evidenceBundle, null, 2))
    .replace("{{EVIDENCE_BUNDLE}}", JSON.stringify(evidenceBundle, null, 2));
}

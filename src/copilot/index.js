/**
 * index.js — Main entry point for the Copilot reasoning engine
 *
 * Provides `askCopilot({ mode, evidenceBundle })` — the single function
 * that all commands use to get AI-powered analysis.
 *
 * Flow:
 *   1. Load and render the prompt template
 *   2. Invoke Copilot CLI
 *   3. Extract JSON from raw output
 *   4. Validate against the CI_DOCTOR contract
 *   5. Return structured response
 */

import { invokeCopilotCli } from "./invoke.js";
import { validateResponse } from "./contract.js";
import { loadPrompt } from "../prompts/loadPrompt.js";
import { writeCacheText } from "../utils/paths.js";

/**
 * Extract a JSON object from Copilot's raw output.
 * Handles markdown fences and surrounding prose.
 *
 * @param {string} raw
 * @returns {object}
 */
function extractJSON(raw) {
  // Try to find JSON inside ```json ... ``` fences first
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(
      `Could not find JSON object in Copilot response:\n${raw.slice(0, 500)}`
    );
  }

  try {
    return JSON.parse(jsonStr.slice(start, end + 1));
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from Copilot response: ${err.message}\nRaw output:\n${raw.slice(0, 500)}`
    );
  }
}

/**
 * Call Copilot CLI with a rendered prompt and return a validated response.
 *
 * @param {object} opts
 * @param {"hypotheses"|"explain"|"patch"} opts.mode
 * @param {object} opts.evidenceBundle - The evidence bundle JSON.
 * @returns {Promise<object>} Validated Copilot response.
 */
export async function askCopilot({ mode, evidenceBundle }) {
  // Step 1 — Render prompt
  const promptText = loadPrompt(mode, evidenceBundle);

  // Step 2 — Invoke Copilot CLI
  const raw = await invokeCopilotCli(promptText);

  if (!raw || raw.trim().length === 0) {
    throw new Error("Copilot CLI returned an empty response.");
  }

  // Step 3 — Extract JSON (with debug dump on failure)
  let parsed;
  try {
    parsed = extractJSON(raw);
  } catch (err) {
    // Save raw output to debug file for inspection (redacted)
    const { redact } = await import("../evidence/redact.js");
    writeCacheText("copilot-raw-output-debug.txt", redact(raw));
    throw new Error(
      `${err.message}\n  Raw output saved to .copilot-ci-doctor/cache/copilot-raw-output-debug.txt`
    );
  }

  // Step 4 — Validate contract
  validateResponse(parsed, mode);

  return parsed;
}

export { extractJSON };

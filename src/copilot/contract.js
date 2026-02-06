/**
 * contract.js — Copilot response contract validation
 *
 * Every Copilot response MUST conform to the CI_DOCTOR_RESPONSE_V1 contract.
 * This module enforces that strictly so no invalid data leaks downstream.
 */

export const RESPONSE_VERSION = "CI_DOCTOR_RESPONSE_V1";
export const VALID_MODES = ["hypotheses", "explain", "patch", "combined"];

/**
 * Validate a parsed Copilot response against the CI_DOCTOR contract.
 *
 * @param {object} response - Parsed JSON response.
 * @param {"hypotheses"|"explain"|"patch"} expectedMode
 * @throws {Error} If validation fails.
 */
export function validateResponse(response, expectedMode) {
  if (!response || typeof response !== "object") {
    throw new Error("Copilot response is not a valid JSON object.");
  }

  if (response.version !== RESPONSE_VERSION) {
    throw new Error(
      `Invalid response version: expected "${RESPONSE_VERSION}", got "${response.version}"`
    );
  }

  if (!VALID_MODES.includes(response.mode)) {
    throw new Error(
      `Invalid response mode: "${response.mode}". Must be one of: ${VALID_MODES.join(", ")}`
    );
  }

  if (response.mode !== expectedMode) {
    throw new Error(
      `Response mode mismatch: expected "${expectedMode}", got "${response.mode}"`
    );
  }

  // Mode-specific checks
  if (expectedMode === "hypotheses") {
    validateHypotheses(response);
  } else if (expectedMode === "explain") {
    validateExplain(response);
  } else if (expectedMode === "patch") {
    validatePatch(response);
  } else if (expectedMode === "combined") {
    validateHypotheses(response);
    validateExplain(response);
    validatePatch(response);
  }
}

function validateHypotheses(response) {
  if (!Array.isArray(response.hypotheses) || response.hypotheses.length === 0) {
    throw new Error("Hypotheses response must contain a non-empty hypotheses array.");
  }
  for (const h of response.hypotheses) {
    if (typeof h.confidence !== "number" || h.confidence < 0 || h.confidence > 100) {
      throw new Error(`Invalid confidence value: ${h.confidence}. Must be 0–100.`);
    }
    if (!h.title || typeof h.title !== "string") {
      throw new Error("Each hypothesis must have a title string.");
    }
    if (!Array.isArray(h.evidence_refs)) {
      throw new Error("Each hypothesis must have an evidence_refs array.");
    }
  }
}

function validateExplain(response) {
  if (typeof response.confidence !== "number" || response.confidence < 0 || response.confidence > 100) {
    throw new Error("Explain response must include a numeric confidence (0–100).");
  }
  if (!response.summary || typeof response.summary !== "string") {
    throw new Error("Explain response must include a summary string.");
  }
  if (!response.explanation || typeof response.explanation !== "string") {
    throw new Error("Explain response must include an explanation string.");
  }
}

function validatePatch(response) {
  if (typeof response.confidence !== "number" || response.confidence < 0 || response.confidence > 100) {
    throw new Error("Patch response must include a numeric confidence (0–100).");
  }
  if (!response.patch || typeof response.patch !== "string") {
    throw new Error("Patch response must include a valid unified diff string.");
  }
  if (!response.description || typeof response.description !== "string") {
    throw new Error("Patch response must include a description string.");
  }
}

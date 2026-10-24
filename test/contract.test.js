import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateResponse, RESPONSE_VERSION, VALID_MODES } from "../src/copilot/contract.js";

const hypotheses = [{ title: "npm ci needs a lockfile", confidence: 90, evidence_refs: ["E4"] }];
const base = (mode, extra) => ({ version: RESPONSE_VERSION, mode, ...extra });
const explain = { confidence: 80, summary: "Lockfile missing", explanation: "npm ci requires package-lock.json (E4)." };
const patch = { confidence: 75, patch: "--- a/x\n+++ b/x\n", description: "Use npm install" };

describe("validateResponse()", () => {
  test("accepts a valid response for each mode", () => {
    assert.doesNotThrow(() => validateResponse(base("hypotheses", { hypotheses }), "hypotheses"));
    assert.doesNotThrow(() => validateResponse(base("explain", explain), "explain"));
    assert.doesNotThrow(() => validateResponse(base("patch", patch), "patch"));
    assert.doesNotThrow(() => validateResponse(base("combined", { hypotheses, ...explain, ...patch }), "combined"));
  });

  test("exposes the four modes and the version string", () => {
    assert.deepEqual(VALID_MODES, ["hypotheses", "explain", "patch", "combined"]);
    assert.equal(RESPONSE_VERSION, "CI_DOCTOR_RESPONSE_V1");
  });

  test("rejects non-objects", () => {
    for (const bad of [null, undefined, "text", 3]) {
      assert.throws(() => validateResponse(bad, "patch"), /not a valid JSON object/);
    }
  });

  test("rejects a wrong version or an unknown mode", () => {
    assert.throws(() => validateResponse({ ...base("patch", patch), version: "V0" }, "patch"), /Invalid response version/);
    assert.throws(() => validateResponse(base("nonsense", patch), "patch"), /Invalid response mode/);
  });

  test("rejects a mode that differs from the one requested", () => {
    assert.throws(() => validateResponse(base("explain", explain), "patch"), /mode mismatch/);
  });

  test("hypotheses: needs a non-empty array with title, confidence 0-100 and evidence_refs", () => {
    const check = (h) => validateResponse(base("hypotheses", { hypotheses: h }), "hypotheses");
    assert.throws(() => check([]), /non-empty/);
    assert.throws(() => check("x"), /non-empty/);
    assert.throws(() => check([{ ...hypotheses[0], confidence: 101 }]), /Invalid confidence/);
    assert.throws(() => check([{ ...hypotheses[0], confidence: -1 }]), /Invalid confidence/);
    assert.throws(() => check([{ ...hypotheses[0], confidence: "high" }]), /Invalid confidence/);
    assert.throws(() => check([{ ...hypotheses[0], title: "" }]), /title/);
    assert.throws(() => check([{ title: "t", confidence: 5 }]), /evidence_refs/);
  });

  test("explain: needs numeric confidence, summary and explanation", () => {
    const check = (x) => validateResponse(base("explain", x), "explain");
    assert.throws(() => check({ ...explain, confidence: 120 }), /confidence/);
    assert.throws(() => check({ ...explain, summary: "" }), /summary/);
    assert.throws(() => check({ ...explain, explanation: undefined }), /explanation/);
  });

  test("patch: needs numeric confidence, a diff string and a description", () => {
    const check = (x) => validateResponse(base("patch", x), "patch");
    assert.throws(() => check({ ...patch, confidence: "75" }), /confidence/);
    assert.throws(() => check({ ...patch, patch: "" }), /unified diff/);
    assert.throws(() => check({ ...patch, patch: 5 }), /unified diff/);
    assert.throws(() => check({ ...patch, description: "" }), /description/);
  });

  test("combined: validates all three parts", () => {
    const full = { hypotheses, ...explain, ...patch };
    assert.throws(() => validateResponse(base("combined", { ...full, hypotheses: [] }), "combined"), /non-empty/);
    assert.throws(() => validateResponse(base("combined", { ...full, summary: "" }), "combined"), /summary/);
    assert.throws(() => validateResponse(base("combined", { ...full, patch: "" }), "combined"), /unified diff/);
  });
});

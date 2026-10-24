import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseFailingStep } from "../src/evidence/githubActions.js";
import { pickBaseBranch } from "../src/evidence/githubRepo.js";
import { loadPrompt } from "../src/prompts/loadPrompt.js";

describe("parseFailingStep()", () => {
  test("finds the step whose log line reports a non-zero exit code", () => {
    const log = [
      "Set up job 2024-05-01T10:00:00.000Z ##[group]Runner",
      "Run tests 2024-05-01T10:00:05.000Z ##[error]Process completed with exit code 1.",
    ].join("\n");
    assert.equal(parseFailingStep(log), "Run tests");
  });

  test("returns null when no failing step is recognisable", () => {
    assert.equal(parseFailingStep("everything is fine"), null);
    assert.equal(parseFailingStep("Build 2024-05-01T10:00:05Z Process completed with exit code 0."), null);
  });
});

describe("pickBaseBranch()", () => {
  test("uses the repository default branch when it is known", () => {
    assert.equal(pickBaseBranch("master"), "master");
    assert.equal(pickBaseBranch("develop"), "develop");
    assert.equal(pickBaseBranch("main"), "main");
  });

  test('falls back to "main" when the default branch is unknown', () => {
    assert.equal(pickBaseBranch(undefined), "main");
    assert.equal(pickBaseBranch(null), "main");
    assert.equal(pickBaseBranch(""), "main");
    assert.equal(pickBaseBranch("unknown"), "main");
  });
});

describe("loadPrompt()", () => {
  const bundle = { evidence: [{ id: "E1", text: "repo info" }] };

  for (const mode of ["hypotheses", "explain", "patch", "combined"]) {
    test(`renders the ${mode} template with the evidence bundle`, () => {
      const out = loadPrompt(mode, bundle);
      assert.ok(!out.includes("{{EVIDENCE_BUNDLE"), "placeholder was not replaced");
      assert.ok(out.includes('"id": "E1"'));
    });
  }

  test("throws for an unknown mode", () => {
    assert.throws(() => loadPrompt("nope", bundle), /Prompt template not found/);
  });
});

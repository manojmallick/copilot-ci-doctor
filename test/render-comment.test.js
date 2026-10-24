import { test } from "node:test";
import assert from "node:assert/strict";
import { renderComment, MARKER } from "../action/render-comment.js";

const ok = {
  ok: true, command: "analyze",
  run: { runId: 100, workflow: "CI", branch: "main", url: "https://github.com/o/r/actions/runs/100" },
  hypotheses: [
    { rank: 1, title: "npm ci | needs a lockfile", confidence: 90, explanation: "No package-lock.json\nin the repo", evidence_refs: ["E4", "E5"] },
    { rank: 2, title: "Node version", confidence: 30, explanation: "x", evidence_refs: [] },
  ],
};

test("renders a table with the marker, run link and top explanation", () => {
  const md = renderComment(ok);
  assert.ok(md.startsWith(MARKER));
  assert.match(md, /\[CI #100\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/100\)/);
  assert.match(md, /\| 1 \| npm ci \\\| needs a lockfile \| 90% \| E4, E5 \|/);
  assert.match(md, /\*\*Top hypothesis:\*\* No package-lock\.json in the repo/);
  assert.match(md, /language model/);
});

test("renders the error when the diagnosis failed", () => {
  const md = renderComment({ ok: false, command: "analyze", error: "No failed GitHub Actions runs found in this repository." });
  assert.ok(md.startsWith(MARKER));
  assert.match(md, /could not be completed/);
  assert.match(md, /No failed GitHub Actions runs/);
});

test("copes with missing or empty output", () => {
  assert.match(renderComment(null), /No output/);
  assert.match(renderComment({ ok: true, run: { runId: 1 }, hypotheses: [] }), /No root-cause hypotheses/);
});

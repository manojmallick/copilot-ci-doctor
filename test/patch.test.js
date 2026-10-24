import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizePatch, patchFilePaths } from "../src/utils/patch.js";

const WRONG_COUNTS = [
  "diff --git a/ci.yml b/ci.yml",
  "--- a/ci.yml",
  "+++ b/ci.yml",
  "@@ -3,99 +3,99 @@ jobs:",
  " steps:",
  "-  - run: npm ci",
  "+  - run: npm install",
  "+  - run: npm test",
  " done",
].join("\n");

describe("normalizePatch()", () => {
  test("recounts the old and new line counts in a hunk header", () => {
    const out = normalizePatch(WRONG_COUNTS);
    // 2 context + 1 removed = 3 old lines; 2 context + 2 added = 4 new lines
    assert.match(out, /^@@ -3,3 \+3,4 @@ jobs:$/m);
  });

  test("keeps the starting line numbers and the trailing section text", () => {
    const out = normalizePatch("--- a/x\n+++ b/x\n@@ -10,1 +12,1 @@ function foo()\n-a\n+b\n");
    assert.match(out, /^@@ -10,1 \+12,1 @@ function foo\(\)$/m);
  });

  test("fixes every hunk independently", () => {
    const text = [
      "--- a/f", "+++ b/f",
      "@@ -1,9 +1,9 @@", " a", "-b", "+c",
      "@@ -20,9 +20,9 @@", " x", "+y", "+z",
    ].join("\n");
    const out = normalizePatch(text).split("\n");
    assert.equal(out.find((l) => l.startsWith("@@ -1,")), "@@ -1,2 +1,2 @@");
    assert.equal(out.find((l) => l.startsWith("@@ -20,")), "@@ -20,1 +20,3 @@");
  });

  test("stops counting at the next file header", () => {
    const text = [
      "--- a/one", "+++ b/one", "@@ -1,5 +1,5 @@", "-a", "+b",
      "--- a/two", "+++ b/two", "@@ -1,5 +1,5 @@", "-c", "+d",
    ].join("\n");
    const out = normalizePatch(text);
    assert.equal((out.match(/^@@ -1,1 \+1,1 @@$/gm) || []).length, 2);
  });

  test("always ends with exactly one newline and strips CR characters", () => {
    const out = normalizePatch("--- a/x\r\n+++ b/x\r\n@@ -1,1 +1,1 @@\r\n-a\r\n+b\r\n\r\n\r\n");
    assert.ok(out.endsWith("+b\n"));
    assert.ok(!out.includes("\r"));
  });

  test("leaves a patch with no hunks unchanged apart from the final newline", () => {
    assert.equal(normalizePatch("not a diff"), "not a diff\n");
  });
});

describe("patchFilePaths()", () => {
  test("lists a modified file once", () => {
    assert.deepEqual(patchFilePaths(WRONG_COUNTS), ["ci.yml"]);
  });

  test("handles new files (/dev/null) and deleted files", () => {
    const text = [
      "--- /dev/null", "+++ b/src/new.js", "@@ -0,0 +1 @@", "+x",
      "--- a/src/old.js", "+++ /dev/null", "@@ -1 +0,0 @@", "-y",
    ].join("\n");
    assert.deepEqual(patchFilePaths(text), ["src/new.js", "src/old.js"]);
  });

  test("includes both sides of a rename", () => {
    const text = ["diff --git a/a.txt b/b.txt", "similarity index 100%", "rename from a.txt", "rename to b.txt"].join("\n");
    assert.deepEqual(patchFilePaths(text), ["a.txt", "b.txt"]);
  });

  test("handles several files and drops duplicates", () => {
    const text = ["--- a/a.js", "+++ b/a.js", "@@ -1 +1 @@", "-1", "+2", "--- a/b/c.js", "+++ b/b/c.js", "@@ -1 +1 @@", "-3", "+4"].join("\n");
    assert.deepEqual(patchFilePaths(text), ["a.js", "b/c.js"]);
  });

  test("ignores trailing timestamps and quotes in headers", () => {
    assert.deepEqual(patchFilePaths('--- a/x.txt\t2024-01-01\n+++ "b/x.txt"\n'), ["x.txt"]);
  });

  test("returns an empty list when there is no file header", () => {
    assert.deepEqual(patchFilePaths("just some text"), []);
    assert.deepEqual(patchFilePaths(""), []);
  });
});

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizePatch, patchFilePaths } from "../src/utils/patch.js";

const gitAvailable = spawnSync("git", ["--version"]).status === 0;

describe("patch handling against real git", { skip: !gitAvailable && "git is not installed" }, () => {
  let dir;
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-doctor-test-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    fs.writeFileSync(path.join(dir, "ci.yml"), "steps:\n  - run: npm ci\ndone\n");
    git("add", "ci.yml");
    git("commit", "-q", "-m", "init");
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // The model's usual mistake: right content, wrong hunk line counts.
  const badPatch = [
    "diff --git a/ci.yml b/ci.yml",
    "--- a/ci.yml",
    "+++ b/ci.yml",
    "@@ -1,50 +1,50 @@",
    " steps:",
    "-  - run: npm ci",
    "+  - run: npm install",
    " done",
  ].join("\n") + "\n";

  test("git rejects the raw patch but accepts the normalised one", () => {
    const raw = path.join(dir, "raw.patch");
    fs.writeFileSync(raw, badPatch);
    assert.throws(() => git("apply", "--check", raw));

    const fixed = path.join(dir, "fixed.patch");
    fs.writeFileSync(fixed, normalizePatch(badPatch));
    assert.doesNotThrow(() => git("apply", "--check", fixed));
  });

  test("staging only the patched files leaves unrelated changes out of the commit", () => {
    // Unrelated local work and the tool's own cache folder.
    fs.writeFileSync(path.join(dir, "notes.txt"), "my local notes\n");
    fs.mkdirSync(path.join(dir, ".copilot-ci-doctor", "cache"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".copilot-ci-doctor", "cache", "latest-evidence.json"), "{}");

    const patch = normalizePatch(badPatch);
    const file = path.join(dir, "fixed2.patch");
    fs.writeFileSync(file, patch);
    git("apply", file);
    fs.rmSync(file);

    git("add", "--", ...patchFilePaths(patch));
    const staged = git("diff", "--cached", "--name-only").trim().split("\n");
    assert.deepEqual(staged, ["ci.yml"]);
    assert.match(git("status", "--short"), /\?\? notes\.txt/);
  });
});

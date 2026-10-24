import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createSandbox, e2eSupported, copilotReplies, BAD_PATCH, FAILED_RUN } from "./helpers/e2e.js";

const opts = { skip: !e2eSupported && "needs a POSIX shell and git" };

function withSandbox(overrides, fn) {
  const sb = createSandbox(overrides);
  try { return fn(sb); } finally { sb.cleanup(); }
}

/** A sandbox where `analyze` has already cached the evidence that `fix` reads. */
function withAnalyzed(overrides, fn) {
  return withSandbox(overrides, (sb) => {
    assert.equal(sb.run(["analyze", "--json"]).status, 0);
    return fn(sb);
  });
}
const ciYml = (sb) => fs.readFileSync(path.join(sb.repo, ".github", "workflows", "ci.yml"), "utf8");

test("option validation fails fast, before any gh call", opts, () => withSandbox({}, (sb) => {
  for (const args of [
    ["analyze", "--run-id", "abc"],
    ["analyze", "--repo", "not-a-repo"],
    ["analyze", "--branch", "--evil"],
    ["fix", "--min-confidence", "150"],
    ["watch", "--max-iterations", "0"],
    ["watch", "--poll-interval", "x"],
  ]) {
    const r = sb.run(args);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, /invalid|error/i, args.join(" "));
  }
  assert.deepEqual(sb.calls(), []);
}));

test("analyze --json prints one JSON document and nothing else", opts, () => withSandbox({}, (sb) => {
  const r = sb.run(["analyze", "--json"]);
  assert.equal(r.status, 0);
  assert.ok(r.json, "stdout must be valid JSON");
  assert.equal(r.json.ok, true);
  assert.equal(r.json.command, "analyze");
  assert.equal(r.json.run.runId, 100);
  assert.equal(r.json.hypotheses[0].title, "npm ci needs a lockfile");
}));

test("analyze --json reports failures as JSON with exit 1", opts, () => withSandbox({ runs: [] }, (sb) => {
  const r = sb.run(["analyze", "--json"]);
  assert.equal(r.status, 1);
  assert.equal(r.json.ok, false);
  assert.equal(r.json.command, "analyze");
  assert.match(r.json.error, /No failed/);
}));

test("analyze --run-id targets that run", opts, () => withSandbox({}, (sb) => {
  const r = sb.run(["analyze", "--json", "--run-id", "100"]);
  assert.equal(r.status, 0);
  assert.ok(sb.calls().some((c) => c[0] === "run" && c[1] === "view" && c[2] === "100"));
  const missing = sb.run(["analyze", "--json", "--run-id", "999"]);
  assert.equal(missing.status, 1);
  assert.equal(missing.json.ok, false);
}));

test("--repo and --branch are passed through to gh", opts, () => withSandbox(
  { runs: [{ ...FAILED_RUN, repo: "octocat/hello", headBranch: "dev" }] },
  (sb) => {
    const r = sb.run(["analyze", "--json", "--repo", "octocat/hello", "--branch", "dev"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const list = sb.calls().find((c) => c[0] === "run" && c[1] === "list");
    assert.ok(list.includes("-R") && list.includes("octocat/hello"));
    assert.equal(list[list.indexOf("--branch") + 1], "dev");
    const wrongBranch = sb.run(["analyze", "--json", "--repo", "octocat/hello", "--branch", "other"]);
    assert.equal(wrongBranch.status, 1);
  }
));

test("fix --dry-run changes nothing and exits 0", opts, () => withAnalyzed({}, (sb) => {
  const before = ciYml(sb);
  const r = sb.run(["fix", "--dry-run", "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.dryRun, true);
  assert.equal(r.json.applied, false);
  assert.deepEqual(r.json.files, [".github/workflows/ci.yml"]);
  assert.equal(ciYml(sb), before);
  assert.deepEqual(sb.branches(), ["main"]);
  assert.equal(sb.git("status", "--porcelain").trim(), "");
}));

test("fix without --yes and without a terminal declines (exit 2, nothing changed)", opts, () => withAnalyzed({}, (sb) => {
  const r = sb.run(["fix", "--json"]);
  assert.equal(r.status, 2);
  assert.equal(r.json.applied, false);
  assert.equal(r.json.reason, "declined");
  assert.deepEqual(sb.branches(), ["main"]);
}));

test("fix --min-confidence above the patch confidence refuses (exit 2)", opts, () => withAnalyzed({}, (sb) => {
  const r = sb.run(["fix", "--yes", "--min-confidence", "95", "--json"]);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "low-confidence");
  assert.deepEqual(sb.branches(), ["main"]);
}));

test("fix --yes applies the patch on a new branch and commits it", opts, () => withAnalyzed({}, (sb) => {
  const r = sb.run(["fix", "--yes", "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.applied, true);
  assert.ok(sb.branches().length === 2, "a fix branch was created");
  assert.match(ciYml(sb), /npm run test:ci/);
  assert.equal(sb.git("status", "--porcelain").trim(), "");
}));

test("fix with a patch that does not apply exits 2 and leaves the repo alone", opts,
  () => withAnalyzed({ copilot: copilotReplies(BAD_PATCH) }, (sb) => {
    const before = ciYml(sb);
    const r = sb.run(["fix", "--yes", "--json"]);
    assert.equal(r.status, 2);
    assert.equal(r.json.applied, false);
    assert.equal(r.json.reason, "does-not-apply");
    assert.equal(ciYml(sb), before);
    assert.deepEqual(sb.branches(), ["main"]);
  }));

test("demo without --yes does not create a GitHub repository", opts, () => withSandbox({ runs: [], watchRuns: [[]] }, (sb) => {
  const r = sb.run(["demo"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr + r.stdout, /no repository was created|--yes/);
  assert.ok(!sb.calls().some((c) => c[0] === "repo" && c[1] === "create"));
}));

test("--help documents the exit codes", opts, () => withSandbox({}, (sb) => {
  const r = sb.run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Exit codes/);
}));

test("watch --dry-run previews the fix and changes nothing", opts, () => withSandbox({}, (sb) => {
  const before = ciYml(sb);
  const r = sb.run(["watch", "--dry-run", "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.command, "watch");
  assert.equal(ciYml(sb), before);
  assert.deepEqual(sb.branches(), ["main"]);
  assert.deepEqual(sb.originBranches(), ["main"]);
}));

test("watch --min-confidence above the patch confidence stops with exit 2", opts, () => withSandbox({}, (sb) => {
  const r = sb.run(["watch", "--min-confidence", "95", "--json"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.deepEqual(sb.branches(), ["main"]);
  assert.deepEqual(sb.originBranches(), ["main"]);
}));

function writeDemoRecord(sb, repo) {
  const dir = path.join(sb.repo, ".copilot-ci-doctor");
  fs.mkdirSync(path.join(dir, "demo-run"), { recursive: true });
  fs.writeFileSync(path.join(dir, "demo-repo.json"), JSON.stringify({ repo }));
  return dir;
}
const deletes = (sb) => sb.calls().filter((c) => c[0] === "repo" && c[1] === "delete");

test("demo --cleanup --yes deletes the recorded demo repo and the local folder", opts, () => withSandbox({}, (sb) => {
  const dir = writeDemoRecord(sb, "octocat/ci-doctor-demo-1700000000000");
  const r = sb.run(["demo", "--cleanup", "--yes"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(deletes(sb).map((c) => c[2]), ["octocat/ci-doctor-demo-1700000000000"]);
  assert.ok(!fs.existsSync(path.join(dir, "demo-run")));
  assert.ok(!fs.existsSync(path.join(dir, "demo-repo.json")));
}));

test("demo --cleanup without --yes and without a terminal keeps the GitHub repo (exit 2)", opts, () => withSandbox({}, (sb) => {
  const dir = writeDemoRecord(sb, "octocat/ci-doctor-demo-1700000000000");
  const r = sb.run(["demo", "--cleanup"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.deepEqual(deletes(sb), []);
  assert.ok(fs.existsSync(path.join(dir, "demo-repo.json")), "record kept so cleanup can be retried");
  assert.ok(!fs.existsSync(path.join(dir, "demo-run")), "local folder is still removed");
}));

test("demo --cleanup never deletes a repository that is not a ci-doctor-demo-<number> repo", opts, () => withSandbox({}, (sb) => {
  for (const repo of ["octocat/important-project", "octocat/ci-doctor-demo-abc", "ci-doctor-demo-123", "../../x"]) {
    writeDemoRecord(sb, repo);
    const r = sb.run(["demo", "--cleanup", "--yes"]);
    assert.equal(r.status, 2, repo);
  }
  assert.deepEqual(deletes(sb), []);
}));

test("demo --cleanup reports a failed delete with the scope hint (exit 1)", opts, () => withSandbox({ failRepoDelete: true }, (sb) => {
  writeDemoRecord(sb, "octocat/ci-doctor-demo-1700000000000");
  const r = sb.run(["demo", "--cleanup", "--yes"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /delete_repo/);
}));

test("demo --cleanup with nothing recorded just succeeds", opts, () => withSandbox({}, (sb) => {
  const r = sb.run(["demo", "--cleanup", "--yes"]);
  assert.equal(r.status, 0);
  assert.deepEqual(deletes(sb), []);
}));

/**
 * End-to-end test helper: runs the real CLI against a temporary git repository
 * with a fake `gh` in front of the PATH. No network, no Copilot, no GitHub.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..");
const CLI = path.join(ROOT, "src", "cli.js");
const FAKE_GH = path.join(here, "fake-gh.cjs");

export const e2eSupported = process.platform !== "win32" && spawnSync("git", ["--version"]).status === 0;

export const jqAvailable = spawnSync("jq", ["--version"]).status === 0;

export const CI_YML = "name: CI\non: push\njobs:\n  build:\n    steps:\n      - run: npm ci\n      - run: npm test\n";

/** A patch for CI_YML with deliberately wrong hunk counts (as models produce). */
export const GOOD_PATCH = [
  "--- a/.github/workflows/ci.yml",
  "+++ b/.github/workflows/ci.yml",
  "@@ -6,9 +6,9 @@ jobs:",
  "       - run: npm ci",
  "-      - run: npm test",
  "+      - run: npm run test:ci",
].join("\n");

/** A patch whose context does not exist in CI_YML. */
export const BAD_PATCH = [
  "--- a/.github/workflows/ci.yml",
  "+++ b/.github/workflows/ci.yml",
  "@@ -1,2 +1,2 @@",
  " this line is not in the file",
  "-nor is this one",
  "+replacement",
].join("\n");

const hypothesis = { rank: 1, title: "npm ci needs a lockfile", confidence: 90, explanation: "No package-lock.json", evidence_refs: ["E4"] };

export function copilotReplies(patch = GOOD_PATCH, confidence = 90) {
  const explain = { confidence: 85, summary: "Lockfile missing", explanation: "npm ci requires package-lock.json.", plain_english: ["CI cannot install"], evidence_refs: ["E4"] };
  const patchPart = { confidence, description: "Run the CI test script", patch, evidence_refs: ["E4"], warnings: [] };
  const v = { version: "CI_DOCTOR_RESPONSE_V1" };
  return {
    hypotheses: { ...v, mode: "hypotheses", hypotheses: [hypothesis] },
    explain: { ...v, mode: "explain", ...explain },
    patch: { ...v, mode: "patch", ...patchPart },
    combined: { ...v, mode: "combined", hypotheses: [hypothesis], ...explain, ...patchPart },
  };
}

export const FAILED_RUN = {
  databaseId: 100, workflowName: "CI", headBranch: "main", event: "push",
  conclusion: "failure", createdAt: "2026-01-01T00:00:00Z", url: "https://github.com/example/repo/actions/runs/100",
};

export function defaultScenario(overrides = {}) {
  return {
    repos: {
      default: { nameWithOwner: "example/repo", defaultBranch: "master", url: "https://github.com/example/repo" },
      "octocat/hello": { nameWithOwner: "octocat/hello", defaultBranch: "trunk", url: "https://github.com/octocat/hello" },
    },
    runs: [FAILED_RUN],
    jobs: { default: [{ name: "build", conclusion: "failure", steps: [{ name: "Run tests", conclusion: "failure" }] }] },
    log: "Run tests 2026-01-01T00:00:05Z Process completed with exit code 1.\n",
    copilot: copilotReplies(),
    // `run list --limit 1` answers for watch: failing now, then a new passing run after the push
    watchRuns: [
      [{ databaseId: 100, status: "completed", conclusion: "failure", workflowName: "CI" }],
      [{ databaseId: 100, status: "completed", conclusion: "failure", workflowName: "CI" }],
      [{ databaseId: 101, status: "completed", conclusion: "success", workflowName: "CI" }],
    ],
    viewById: { 101: { status: "completed", conclusion: "success" } },
    ...overrides,
  };
}

/**
 * Create a sandbox: a git repository with one commit, a bare "origin", a fake
 * gh on the PATH, and helpers to run the CLI and inspect what happened.
 */
export function createSandbox(scenarioOverrides = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ci-doctor-e2e-"));
  const repo = path.join(base, "work");
  const origin = path.join(base, "origin.git");
  const fakeDir = path.join(base, "fake-gh");
  const bin = path.join(base, "bin");
  for (const d of [repo, fakeDir, bin]) fs.mkdirSync(d, { recursive: true });

  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["init", "-q", "--bare", origin]);
  git("init", "-q");
  git("symbolic-ref", "HEAD", "refs/heads/main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  fs.mkdirSync(path.join(repo, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".github", "workflows", "ci.yml"), CI_YML);
  git("add", "-A");
  git("commit", "-q", "-m", "initial");
  fs.appendFileSync(path.join(repo, ".git", "info", "exclude"), ".copilot-ci-doctor/\n");
  git("remote", "add", "origin", origin);
  git("push", "-q", "-u", "origin", "main");

  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nexec "${process.execPath}" "${FAKE_GH}" "$@"\n`, { mode: 0o755 });
  // `copilot-ci-doctor` on the PATH, so the example scripts run exactly as a user would run them
  fs.writeFileSync(path.join(bin, "copilot-ci-doctor"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
  const writeScenario = (overrides) =>
    fs.writeFileSync(path.join(fakeDir, "scenario.json"), JSON.stringify(defaultScenario(overrides)));
  writeScenario(scenarioOverrides);

  const env = { ...process.env, FAKE_GH_DIR: fakeDir, PATH: `${bin}${path.delimiter}${process.env.PATH}`, NO_COLOR: "1", FORCE_COLOR: "0",
    // CI runners have no git identity; commits made by the CLI (and by demo) still need one
    GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" };

  return {
    repo,
    origin,
    git,
    setScenario: writeScenario,
    /** Run the CLI in the sandbox repository (stdin is not a terminal). */
    run(args, { cwd = repo, timeout = 60_000 } = {}) {
      const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: "utf8", timeout, input: "" });
      let json = null;
      try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
      return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
    },
    /** Run any command in the sandbox (for example an example script) with the sandbox PATH. */
    exec(file, args = [], { env: extra = {}, cwd = repo, timeout = 60_000 } = {}) {
      const r = spawnSync(file, args, { cwd, env: { ...env, ...extra }, encoding: "utf8", timeout, input: "" });
      return { status: r.status, stdout: r.stdout, stderr: r.stderr };
    },
    /** Every `gh` call so far, as argument arrays. */
    calls() {
      const f = path.join(fakeDir, "calls.log");
      if (!fs.existsSync(f)) return [];
      return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter(Array.isArray);
    },
    copilotModes() {
      const f = path.join(fakeDir, "calls.log");
      if (!fs.existsSync(f)) return [];
      return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.copilotMode).map((x) => x.copilotMode);
    },
    branches: () => git("branch", "--format=%(refname:short)").trim().split("\n"),
    originBranches: () => execFileSync("git", ["-C", origin, "branch", "--format=%(refname:short)"], { encoding: "utf8" }).trim().split("\n"),
    cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
  };
}

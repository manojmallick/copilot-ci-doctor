import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSandbox, e2eSupported, jqAvailable, copilotReplies, BAD_PATCH } from "./helpers/e2e.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = (name) => path.join(ROOT, "examples", "scripts", name);
const opts = { skip: (!e2eSupported && "needs a POSIX shell and git") || (!jqAvailable && "needs jq") };

function withSandbox(overrides, fn) {
  const sb = createSandbox(overrides);
  try { return fn(sb); } finally { sb.cleanup(); }
}

test("every example script is executable and has valid shell syntax", { skip: !e2eSupported && "POSIX only" }, () => {
  const dir = path.join(ROOT, "examples", "scripts");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sh"));
  assert.ok(files.length >= 3);
  const sb = createSandbox();
  try {
    for (const f of files) {
      assert.ok(fs.statSync(path.join(dir, f)).mode & 0o111, `${f} is executable`);
      const r = sb.exec("sh", ["-n", path.join(dir, f)]);
      assert.equal(r.status, 0, `${f}: ${r.stderr}`);
    }
  } finally {
    sb.cleanup();
  }
});

test("example workflows only use inputs that action.yml defines", () => {
  const action = fs.readFileSync(path.join(ROOT, "action.yml"), "utf8");
  const defined = new Set([...action.slice(0, action.indexOf("outputs:")).matchAll(/^ {2}([a-z-]+):\s*$/gm)].map((m) => m[1]));
  const dir = path.join(ROOT, "examples", "workflows");
  let inputsSeen = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".yml"))) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const steps = text.split(/\n {6}- /).filter((step) => step.includes("uses: manojmallick/copilot-ci-doctor@"));
    assert.ok(steps.length > 0, `${f} uses the action`);
    const used = steps.flatMap((step) => {
      const withBlock = step.split(/\n {8}with:\n/)[1];
      return withBlock ? [...withBlock.matchAll(/^ {10}([a-z-]+):/gm)].map((m) => m[1]) : [];
    });
    inputsSeen += used.length;
    for (const input of used) assert.ok(defined.has(input), `${f} uses unknown input "${input}"`);
  }
  assert.ok(defined.has("run-id") && defined.has("comment") && defined.has("github-token"));
  assert.ok(inputsSeen >= 3, "the examples pass inputs (guards against a regex that matches nothing)");
});

test("triage.sh prints the failed run and ranked causes", opts, () => withSandbox({}, (sb) => {
  const r = sb.exec(script("triage.sh"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Failed run: CI #100 on main/);
  assert.match(r.stdout, /1\. npm ci needs a lockfile {2}\[90%\] {2}evidence: E4/);
}));

test("triage.sh reports a missing failed run on stderr with exit 1", opts, () => withSandbox({ runs: [] }, (sb) => {
  const r = sb.exec(script("triage.sh"));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No failed GitHub Actions runs/);
}));

test("triage.sh passes RUN_ID through", opts, () => withSandbox({}, (sb) => {
  assert.equal(sb.exec(script("triage.sh"), [], { env: { RUN_ID: "100" } }).status, 0);
  assert.ok(sb.calls().some((c) => c[0] === "run" && c[1] === "view" && c[2] === "100"));
  assert.equal(sb.exec(script("triage.sh"), [], { env: { RUN_ID: "999" } }).status, 1);
}));

test("fix-or-hand-off.sh applies a confident fix on a new branch (exit 0)", opts, () => withSandbox({}, (sb) => {
  const r = sb.exec(script("fix-or-hand-off.sh"));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Fix applied on branch ci-fix\//);
  assert.equal(sb.branches().length, 2);
}));

test("fix-or-hand-off.sh hands off below MIN_CONFIDENCE (exit 10, repo untouched)", opts, () => withSandbox({}, (sb) => {
  const r = sb.exec(script("fix-or-hand-off.sh"), [], { env: { MIN_CONFIDENCE: "95" } });
  assert.equal(r.status, 10);
  assert.match(r.stdout, /confidence 90% is below 95%/);
  assert.deepEqual(sb.branches(), ["main"]);
}));

test("fix-or-hand-off.sh hands off a patch that does not apply (exit 10)", opts,
  () => withSandbox({ copilot: copilotReplies(BAD_PATCH) }, (sb) => {
    const r = sb.exec(script("fix-or-hand-off.sh"));
    assert.equal(r.status, 10);
    assert.match(r.stdout, /does not apply/);
    assert.deepEqual(sb.branches(), ["main"]);
  }));

test("fix-or-hand-off.sh with DRY_RUN=1 changes nothing (exit 0)", opts, () => withSandbox({}, (sb) => {
  const r = sb.exec(script("fix-or-hand-off.sh"), [], { env: { DRY_RUN: "1" } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Dry run: patch applies cleanly to \.github\/workflows\/ci\.yml/);
  assert.deepEqual(sb.branches(), ["main"]);
}));

test("triage-to-markdown.sh writes a table", opts, () => withSandbox({}, (sb) => {
  const file = path.join(sb.repo, "triage.md");
  const r = sb.exec(script("triage-to-markdown.sh"), [file]);
  assert.equal(r.status, 0, r.stderr);
  const md = fs.readFileSync(file, "utf8");
  assert.match(md, /^## CI failure: CI #100/m);
  assert.match(md, /\| 1 \| npm ci needs a lockfile \| 90% \| E4 \|/);
}));

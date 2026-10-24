#!/usr/bin/env node
/**
 * A stand-in for the GitHub CLI, used by the end-to-end tests.
 *
 * It answers the few `gh` calls copilot-ci-doctor makes from a scenario file
 * (FAKE_GH_DIR/scenario.json) and records every call in FAKE_GH_DIR/calls.log,
 * so tests can check exactly what the tool asked GitHub and Copilot to do.
 */
const fs = require("node:fs");
const path = require("node:path");

const dir = process.env.FAKE_GH_DIR;
const sc = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
const args = process.argv.slice(2);

const short = (a) => (a.length > 120 ? a.slice(0, 40) + "…" : a);
fs.appendFileSync(path.join(dir, "calls.log"), JSON.stringify(args.map(short)) + "\n");

const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = (x) => process.stdout.write(typeof x === "string" ? x : JSON.stringify(x));
const die = (msg) => {
  process.stderr.write(msg + "\n");
  process.exit(1);
};
function counter(name) {
  const f = path.join(dir, "ctr-" + name);
  const n = fs.existsSync(f) ? Number(fs.readFileSync(f, "utf8")) : 0;
  fs.writeFileSync(f, String(n + 1));
  return n;
}

const [cmd, sub] = args;
const repoFlag = opt("-R");

if (cmd === "--version") {
  out("gh version 2.99.0 (fake)\n");
} else if (cmd === "repo" && sub === "view") {
  const positional = args[2] && !args[2].startsWith("-") ? args[2] : undefined;
  const info = (sc.repos || {})[positional || "default"];
  if (!info) die(`repository not found: ${positional}`);
  out({ nameWithOwner: info.nameWithOwner, defaultBranchRef: { name: info.defaultBranch }, url: info.url });
} else if (cmd === "run" && sub === "list") {
  if (opt("--limit") === "1") {
    // watch: the latest run of any status, one answer per call, last one repeats
    const seq = sc.watchRuns;
    out(seq[Math.min(counter("watch-list"), seq.length - 1)]);
  } else {
    const branch = opt("--branch");
    const runs = (sc.runs || []).filter(
      (r) =>
        r.conclusion === "failure" &&
        (!branch || r.headBranch === branch) &&
        (repoFlag ? r.repo === repoFlag : !r.repo)
    );
    out(runs);
  }
} else if (cmd === "run" && sub === "view") {
  const id = args[2];
  const fields = opt("--json");
  if (args.includes("--log-failed") || args.includes("--log")) {
    out(sc.log || "step failed\nProcess completed with exit code 1.\n");
  } else if (fields === "jobs") {
    out({ jobs: (sc.jobs || {})[id] || (sc.jobs || {}).default || [] });
  } else if (fields === "url") {
    out({ url: `https://github.com/example/repo/actions/runs/${id}` });
  } else if (fields === "status,conclusion") {
    out((sc.viewById || {})[id] || { status: "completed", conclusion: "success" });
  } else {
    const run = (sc.runs || []).find((r) => String(r.databaseId) === String(id));
    if (!run) die(`could not find any workflow run with ID ${id}`);
    out(run);
  }
} else if (cmd === "run" && sub === "rerun") {
  out("rerun started\n");
} else if (cmd === "workflow" && sub === "view") {
  out(sc.workflowYaml || "name: CI\non: push\n");
} else if (cmd === "pr" && sub === "create") {
  out("https://github.com/example/repo/pull/7\n");
} else if (cmd === "repo" && sub === "delete") {
  if (sc.failRepoDelete) die("HTTP 403: Must have admin rights to Repository. Needs the delete_repo scope.");
  out("deleted\n");
} else if (cmd === "repo" && sub === "create") {
  if (sc.failRepoCreate) die("repo create is not allowed in this test");
  out("created\n");
} else if (cmd === "copilot") {
  const prompt = opt("-p") || "";
  const modes = [...prompt.matchAll(/"mode":\s*"(\w+)"/g)];
  const mode = modes.length ? modes[modes.length - 1][1] : "unknown";
  fs.appendFileSync(path.join(dir, "calls.log"), JSON.stringify({ copilotMode: mode }) + "\n");
  const reply = (sc.copilot || {})[mode];
  if (!reply) die(`no canned Copilot reply for mode ${mode}`);
  out("```json\n" + JSON.stringify(reply) + "\n```\n");
} else {
  die(`fake gh: unsupported command: ${args.join(" ")}`);
}

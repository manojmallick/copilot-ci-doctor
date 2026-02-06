/**
 * demo.js — `copilot-ci-doctor demo`
 *
 * End-to-end judge-mode demonstration:
 *   1. Clone/create a demo repo with an intentionally broken CI workflow
 *   2. Push to trigger a failing CI run
 *   3. Poll until the run fails (with timeout)
 *   4. Run analyze → explain → fix --yes → retry
 *   5. Print a final scoreboard
 *
 * Designed to complete in 30–45 seconds for contest judges.
 */

import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import { analyzeCommand } from "./analyze.js";
import { explainCommand } from "./explain.js";
import { fixCommand } from "./fix.js";
import { retryCommand } from "./retry.js";
import { readCache } from "../utils/paths.js";
import { header, stepDivider, success, warn, dim } from "../utils/print.js";

const DEMO_DIR_NAME = ".copilot-ci-doctor/demo-run";
const DEMO_REPO_URL = "https://github.com/manojmallick/ci-doctor-demo";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

export async function demoCommand() {
  const startTime = Date.now();

  try {
    header("🎬", "copilot-ci-doctor demo");
    dim("End-to-end: create broken CI → analyze → explain → fix → retry\n");

    // Step 0 — Set up demo repo
    const demoDir = path.resolve(process.cwd(), DEMO_DIR_NAME);

    if (fs.existsSync(demoDir)) {
      dim(`Removing stale demo directory: ${demoDir}`);
      fs.rmSync(demoDir, { recursive: true, force: true });
    }
    {
      dim(`Using demo repo: ${DEMO_REPO_URL}`);
      dim("Creating demo repository with intentionally broken CI…\n");
      await createDemoRepo(demoDir);
    }

    process.chdir(demoDir);
    dim(`Working directory: ${process.cwd()}\n`);

    // Check if there's already a failed run, otherwise push + wait
    let hasFailed = await hasFailedRun();
    if (!hasFailed) {
      dim("Pushing to trigger CI…\n");
      try {
        await execa("git", ["push", "-u", "origin", "main"]);
        success("Pushed — CI workflow triggered.");
      } catch {
        warn("Push failed (repo may not have a remote). Trying gh repo create…");
        const repoName = `ci-doctor-demo-${Date.now()}`;
        await execa("gh", ["repo", "create", repoName, "--public", "--source=.", "--push"]);
        success(`Created GitHub repo: ${repoName}`);
      }

      // Poll for failure
      dim("Waiting for CI run to fail…\n");
      hasFailed = await pollForFailure();
      if (!hasFailed) {
        warn("CI run did not fail within the timeout. Proceeding anyway…");
      }
    } else {
      dim("Found existing failed run — skipping push.\n");
    }

    // Step 1 — Analyze
    stepDivider(1, "Analyze");
    await analyzeCommand();

    // Step 2 — Explain
    stepDivider(2, "Explain");
    await explainCommand();

    // Step 3 — Fix (auto-confirm for demo)
    stepDivider(3, "Fix");
    await fixCommand({ yes: true });

    // Step 4 — Retry
    stepDivider(4, "Retry");
    await retryCommand();

    // Step 5 — Scoreboard
    printScoreboard(startTime);

  } catch (err) {
    console.error(chalk.red(`\n✖ Demo failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Check if the current repo already has a failed run.
 */
async function hasFailedRun() {
  try {
    const { stdout } = await execa("gh", [
      "run", "list", "--status", "failure", "--limit", "1",
      "--json", "databaseId",
    ]);
    const runs = JSON.parse(stdout);
    return runs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Poll GitHub Actions until a failed run appears or timeout.
 */
async function pollForFailure() {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    process.stdout.write(chalk.dim("."));
    if (await hasFailedRun()) {
      console.log("");
      success("CI run failed (as expected).");
      return true;
    }
  }
  console.log("");
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print a final scoreboard summarizing the demo results.
 */
function printScoreboard(startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(chalk.bold.green("\n🎉 Demo complete!\n"));
  console.log(chalk.bold("─── Scoreboard ───\n"));

  // Pull data from cached responses
  const hypotheses = readCache("latest-hypotheses.json");
  const explain = readCache("latest-explain.json");
  const patch = readCache("latest-patch.json");

  if (hypotheses) {
    const top = hypotheses.hypotheses[0];
    console.log(`  ${chalk.bold("Top hypothesis:")} ${top.title} [${top.confidence}%]`);
  }

  if (explain) {
    console.log(`  ${chalk.bold("Explanation:")} ${explain.summary}`);
  }

  if (patch) {
    console.log(`  ${chalk.bold("Fix confidence:")} ${patch.confidence}%`);
    console.log(`  ${chalk.bold("Fix:")} ${patch.description}`);
    const filesChanged = (patch.patch.match(/^---\s+a\//gm) || []).length;
    console.log(`  ${chalk.bold("Files changed:")} ${filesChanged}`);
  }

  console.log(`\n  ${chalk.bold("Total time:")} ${elapsed}s`);
  console.log(chalk.dim("\n  CI before: ✖ FAILED → after fix: ⏳ RE-RUN TRIGGERED"));
  console.log("");
}

/**
 * Create a local demo repository with an intentionally broken CI workflow.
 */
async function createDemoRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });

  await execa("git", ["init", dir]);
  const opts = { cwd: dir };

  await execa("git", ["checkout", "-b", "main"], opts);

  // Create broken workflow
  const workflowDir = path.join(dir, ".github", "workflows");
  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "ci.yml"),
    `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
`,
    "utf-8"
  );

  // package.json referencing a missing test file
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "demo-broken-ci",
        version: "1.0.0",
        scripts: { test: "node test.js" },
      },
      null,
      2
    ),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(dir, "index.js"),
    `function add(a, b) { return a + b; }\nmodule.exports = { add };\n`,
    "utf-8"
  );

  // Intentionally do NOT create test.js — CI will fail

  await execa("git", ["add", "."], opts);
  await execa("git", ["commit", "-m", "Initial commit with broken CI"], opts);

  success("Demo repo created with intentionally broken CI.");
}

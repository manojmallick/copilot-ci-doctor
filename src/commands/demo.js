/**
 * demo.js — `copilot-ci-doctor demo`
 *
 * End-to-end judge-mode demonstration:
 *   1. Clone/create a demo repo with an intentionally broken CI workflow
 *   2. Push to trigger a failing CI run
 *   3. Poll until the run fails (with timeout)
 *   4. Hand off to `watch` which loops: analyze → explain → fix → push → verify
 *   5. Watch prints a final scoreboard when CI passes or confidence drops
 *
 * Designed to complete in 60–120 seconds for contest judges.
 */

import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import { watchCommand } from "./watch.js";
import { header, success, warn, dim } from "../utils/print.js";
import { confirm } from "../utils/prompt.js";

const DEMO_DIR_NAME = ".copilot-ci-doctor/demo-run";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * @param {object} [options]
 * @param {boolean} [options.yes]    Create the GitHub repository without asking.
 * @param {boolean} [options.public] Create a public repository (default: private).
 */
export async function demoCommand(options = {}) {
  try {
    header("🎬", "copilot-ci-doctor demo");
    dim("End-to-end: create broken CI → watch → auto-fix → verify passing\n");

    // Step 0 — Set up demo repo
    const demoDir = path.resolve(process.cwd(), DEMO_DIR_NAME);

    if (fs.existsSync(demoDir)) {
      dim(`Removing stale demo directory: ${demoDir}`);
      fs.rmSync(demoDir, { recursive: true, force: true });
    }
    {
      dim("Creating a local demo project with intentionally broken CI…\n");
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
        warn("The demo project has no remote yet; it needs a GitHub repository to run CI.");
        const repoName = `ci-doctor-demo-${Date.now()}`;
        const visibility = options.public ? "public" : "private";
        const allowed = options.yes || await confirm(
          chalk.yellow(`Create a ${visibility} GitHub repository named ${repoName} on your account?`)
        );
        if (!allowed) {
          throw new Error(
            "Demo cancelled: no repository was created. Re-run with --yes to allow it (add --public for a public repository)."
          );
        }
        await execa("gh", ["repo", "create", repoName, `--${visibility}`, "--source=.", "--push"]);
        success(`Created ${visibility} GitHub repo: ${repoName}`);
        dim(`Delete it when you are done: gh repo delete ${repoName}`);
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

    // Hand off to watch — it will loop: analyze → explain → fix → push → wait
    // until CI passes or confidence drops below 80%
    await watchCommand();

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

  // .gitignore — skip committing cache files
  fs.writeFileSync(
    path.join(dir, ".gitignore"),
    `.copilot-ci-doctor/cache/**\n`,
    "utf-8"
  );

  // Intentionally do NOT create test.js — CI will fail

  await execa("git", ["add", "."], opts);
  await execa("git", ["commit", "-m", "Initial commit with broken CI"], opts);

  success("Demo repo created with intentionally broken CI.");
}

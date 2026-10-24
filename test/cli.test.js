import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = (...args) => spawnSync(process.execPath, [path.join(root, "src", "cli.js"), ...args], { encoding: "utf8" });
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

describe("command line", () => {
  test("--version prints the version from package.json", () => {
    const r = cli("--version");
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), pkg.version);
  });

  test("--help lists every command", () => {
    const r = cli("--help");
    assert.equal(r.status, 0);
    for (const name of ["analyze", "explain", "fix", "watch", "retry", "demo"]) {
      assert.match(r.stdout, new RegExp(`\\b${name}\\b`));
    }
  });

  test("an unknown command exits with an error", () => {
    const r = cli("definitely-not-a-command");
    assert.notEqual(r.status, 0);
  });

  test("fix documents --yes and --auto", () => {
    const r = cli("fix", "--help");
    assert.match(r.stdout, /--yes/);
    assert.match(r.stdout, /--auto/);
  });
});

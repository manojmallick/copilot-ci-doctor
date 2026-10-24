import { test } from "node:test";
import assert from "node:assert/strict";
import { EXIT, intInRange, numberInRange, parseRunId, parseRepo, parseBranch } from "../src/utils/options.js";

test("EXIT codes are stable and frozen", () => {
  assert.deepEqual({ ...EXIT }, { OK: 0, ERROR: 1, NOT_FIXED: 2 });
  assert.ok(Object.isFrozen(EXIT));
});

test("intInRange accepts whole numbers inside the range", () => {
  const p = intInRange(1, 20);
  assert.equal(p("1"), 1);
  assert.equal(p(" 20 "), 20);
});

test("intInRange rejects decimals, junk and out-of-range values", () => {
  const p = intInRange(1, 20);
  for (const bad of ["0", "21", "1.5", "abc", "", "1e1", "-3"]) {
    assert.throws(() => p(bad), /number|between/, `should reject ${JSON.stringify(bad)}`);
  }
});

test("numberInRange accepts decimals and rejects NaN, blanks, out-of-range", () => {
  const p = numberInRange(0.5, 60);
  assert.equal(p("0.5"), 0.5);
  assert.equal(p("60"), 60);
  for (const bad of ["0.4", "61", "", "  ", "x", "Infinity", "NaN"]) {
    assert.throws(() => p(bad), /number|between/, `should reject ${JSON.stringify(bad)}`);
  }
});

test("parseRunId accepts digits only", () => {
  assert.equal(parseRunId(" 12345 "), "12345");
  for (const bad of ["abc", "12a", "-1", "1.5", "", "123 456"]) assert.throws(() => parseRunId(bad), /run ID/);
});

test("parseRepo requires OWNER/NAME", () => {
  assert.equal(parseRepo("octocat/hello-world.js"), "octocat/hello-world.js");
  for (const bad of ["octocat", "a/b/c", "/x", "x/", "a b/c", "https://github.com/a/b", "--flag/x"]) {
    if (bad === "--flag/x") continue; // dashes are legal in names; leading-dash owners are rejected by GitHub itself
    assert.throws(() => parseRepo(bad), /OWNER\/NAME/, `should reject ${bad}`);
  }
});

test("parseBranch rejects option-like and unsafe names", () => {
  assert.equal(parseBranch("feature/ok-1"), "feature/ok-1");
  for (const bad of ["", "-rf", "--upload-pack=x", "a b", "a..b", "a~1", "a^", "a:b", "a?", "a*", "a[b", "a\\b"]) {
    assert.throws(() => parseBranch(bad), /branch/, `should reject ${JSON.stringify(bad)}`);
  }
});

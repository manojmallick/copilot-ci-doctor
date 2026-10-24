import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractJSON } from "../src/copilot/index.js";

describe("extractJSON()", () => {
  test("parses a bare JSON object", () => {
    assert.deepEqual(extractJSON('{"a":1}'), { a: 1 });
  });

  test("parses JSON inside a ```json fence", () => {
    assert.deepEqual(extractJSON('Here you go:\n```json\n{"a":1,"b":[2]}\n```\nHope it helps.'), { a: 1, b: [2] });
  });

  test("parses JSON inside a plain ``` fence", () => {
    assert.deepEqual(extractJSON('```\n{"ok":true}\n```'), { ok: true });
  });

  test("finds an object surrounded by prose without a fence", () => {
    assert.deepEqual(extractJSON('Sure! {"x": "y"} Let me know.'), { x: "y" });
  });

  test("keeps braces that appear inside strings", () => {
    const obj = { patch: "@@ -1 +1 @@\n-a {\n+b }\n", n: 1 };
    assert.deepEqual(extractJSON("```json\n" + JSON.stringify(obj) + "\n```"), obj);
  });

  test("throws a helpful error when there is no JSON", () => {
    assert.throws(() => extractJSON("I could not find anything."), /Could not find JSON object/);
  });

  test("throws when the JSON is malformed", () => {
    assert.throws(() => extractJSON('{"a": 1,, }'), /Failed to parse JSON/);
  });
});

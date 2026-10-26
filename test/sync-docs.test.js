import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteLinks, toPage, protectInlineBraces } from "../scripts/sync-docs.mjs";

const REPO = "https://github.com/manojmallick/copilot-ci-doctor";

test("links to other docs pages become site pages and keep anchors", () => {
  assert.equal(rewriteLinks("[a](commands.md)"), "[a](./commands)");
  assert.equal(rewriteLinks("[a](./commands.md#exit-codes)"), "[a](./commands#exit-codes)");
  assert.equal(rewriteLinks("[a](./HACKATHON.md)"), "[a](./HACKATHON)");
});

test("links that leave docs/ point at GitHub", () => {
  assert.equal(rewriteLinks("[c](../CHANGELOG.md)"), `[c](${REPO}/blob/main/CHANGELOG.md)`);
  assert.equal(rewriteLinks("[r](../README.md)"), `[r](${REPO})`);
  assert.equal(rewriteLinks("[r](../README.md#quick-start)"), `[r](${REPO}/blob/main/README.md#quick-start)`);
});

test("external links, anchors and images are left alone", () => {
  for (const s of ["[x](https://example.com/a.md)", "[x](#section)", "[x](mailto:a@b.c)", "![i](demo.gif)"]) {
    assert.equal(rewriteLinks(s), s);
  }
});

test("pages get front matter with a description", () => {
  const page = toPage("commands.md", "# Commands\n");
  assert.match(page, /^---\ndescription: "Every copilot-ci-doctor command/);
  assert.ok(page.endsWith("# Commands\n"));
});

test("inline code containing {{ }} is protected from Vue, fenced blocks are left alone", () => {
  assert.equal(
    protectInlineBraces("a template (`{{EVIDENCE_BUNDLE}}`) and `${{ secrets.X }}`, but `plain` stays"),
    "a template (<code v-pre>{{EVIDENCE_BUNDLE}}</code>) and <code v-pre>${{ secrets.X }}</code>, but `plain` stays"
  );
  const fenced = "```yaml\ntoken: ${{ secrets.X }}\n```\n";
  assert.equal(protectInlineBraces(fenced), fenced);
  assert.equal(protectInlineBraces("`a < b {{ x }}`"), "<code v-pre>a &lt; b {{ x }}</code>");
});

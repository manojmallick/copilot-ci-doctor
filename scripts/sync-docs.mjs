#!/usr/bin/env node
/**
 * Copies docs/*.md into docs-vp/guide/ for the VitePress site, so docs/ stays the
 * single source of truth. Adds front matter, maps docs/README.md to the guide index
 * and rewrites links that leave docs/ to their GitHub URLs. Run by `npm run docs:build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "docs");
const OUT = path.join(root, "docs-vp", "guide");
const REPO = "https://github.com/manojmallick/copilot-ci-doctor";

const DESCRIPTIONS = {
  "README.md": "Index of the copilot-ci-doctor documentation and where to find answers.",
  "commands.md": "Every copilot-ci-doctor command and option, exit codes, JSON output and cache files.",
  "examples.md": "Nine typical CI failures (lockfile, tests, lint, Node version, secrets, action versions, permissions, Python modules, timeouts) and what copilot-ci-doctor can do about each.",
  "configuration.md": "Option defaults, fixed limits, credentials and files written by copilot-ci-doctor.",
  "github-action.md": "Run copilot-ci-doctor in GitHub Actions and post a diagnosis as a pull request comment.",
  "how-it-works.md": "The evidence bundle, how Copilot CLI is called, the JSON contract and patch handling.",
  "safety-and-privacy.md": "Safeguards, what is sent to GitHub Copilot, and what secret redaction covers and misses.",
  "troubleshooting.md": "Fixes for common copilot-ci-doctor errors: gh, Copilot CLI, patches and confidence gates.",
  "recipes.md": "Ready-to-run scripts and GitHub Actions workflows for copilot-ci-doctor: triage, fix when confident, Markdown reports, exit-code handling.",
  "faq.md": "Answers to common questions: what is sent to Copilot, GitHub permissions, exit codes, Windows and cleanup.",
  "HACKATHON.md": "Notes written for the hackathon judges.",
  "RELEASING.md": "How maintainers publish copilot-ci-doctor to npm.",
};

/** Page name (without .md) a docs/ file is published as. */
const pageOf = (file) => (file === "README.md" ? "index" : file.replace(/\.md$/, ""));

export function rewriteLinks(text) {
  return text.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole;
    const [file, hash = ""] = target.split("#");
    const anchor = hash ? `#${hash}` : "";
    const clean = file.replace(/^\.\//, "");
    if (clean.startsWith("../")) {
      const outside = clean.slice(3);
      const url = outside === "README.md" && !hash ? REPO : `${REPO}/blob/main/${outside}${anchor}`;
      return `](${url})`;
    }
    if (/^[\w.-]+\.md$/.test(clean)) return `](./${pageOf(clean)}${anchor})`;
    return whole;
  });
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * VitePress treats {{ ... }} in prose as a Vue expression, and renders an inline code span such as
 * `{{EVIDENCE_BUNDLE}}` as an empty element. Fenced code blocks are safe; inline spans outside
 * them are turned into <code v-pre> so the braces are shown as written.
 */
export function protectInlineBraces(text) {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || !line.includes("{{")) return line;
      return line.replace(/`([^`\n]*\{\{[^`\n]*)`/g, (_, code) => `<code v-pre>${escapeHtml(code)}</code>`);
    })
    .join("\n");
}

export function toPage(file, text) {
  const description = DESCRIPTIONS[file] ?? "";
  const body = protectInlineBraces(rewriteLinks(text));
  return `---\ndescription: "${description.replace(/"/g, '\\"')}"\n---\n\n${body}`;
}

export function sync() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, file), "utf8");
    fs.writeFileSync(path.join(OUT, `${pageOf(file)}.md`), toPage(file, text));
  }
  fs.mkdirSync(path.join(root, "docs-vp", "public"), { recursive: true });
  fs.copyFileSync(path.join(SRC, "demo.gif"), path.join(root, "docs-vp", "public", "demo.gif"));
  return files.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Synced ${sync()} pages from docs/ to docs-vp/guide/`);
}

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
  "examples.md": "Worked examples: missing lockfile, failing test and lint error, with the commands to run.",
  "configuration.md": "Option defaults, fixed limits, credentials and files written by copilot-ci-doctor.",
  "github-action.md": "Run copilot-ci-doctor in GitHub Actions and post a diagnosis as a pull request comment.",
  "how-it-works.md": "The evidence bundle, how Copilot CLI is called, the JSON contract and patch handling.",
  "safety-and-privacy.md": "Safeguards, what is sent to GitHub Copilot, and what secret redaction covers and misses.",
  "troubleshooting.md": "Fixes for common copilot-ci-doctor errors: gh, Copilot CLI, patches and confidence gates.",
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

export function toPage(file, text) {
  const description = DESCRIPTIONS[file] ?? "";
  const body = rewriteLinks(text);
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

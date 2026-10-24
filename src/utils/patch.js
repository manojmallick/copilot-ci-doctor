/**
 * patch.js — helpers for unified diffs produced by the model.
 *
 * Kept free of side effects so it can be unit-tested without git or gh.
 */

/**
 * Normalize a unified diff by recounting hunk line counts.
 * LLMs frequently emit wrong @@ line counts, causing `git apply` to fail
 * with "corrupt patch". This function fixes the headers.
 *
 * @param {string} patchText
 * @returns {string} The patch with corrected hunk headers, ending in a newline.
 */
export function normalizePatch(patchText) {
  // Strip \r for consistent line endings and trim trailing whitespace/newlines
  // so split("\n") doesn't produce a phantom empty element that fixHunkHeader
  // would mis-count as a context line.
  const lines = patchText.replace(/\r/g, "").trimEnd().split("\n");
  const output = [];
  let hunkStart = -1;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (hunkStart >= 0) fixHunkHeader(output, hunkStart);
      hunkStart = output.length;
    }
    output.push(line);
  }
  if (hunkStart >= 0) fixHunkHeader(output, hunkStart);

  // git apply requires the patch to end with a newline.
  return output.join("\n") + "\n";
}

function fixHunkHeader(lines, hunkIdx) {
  const match = lines[hunkIdx].match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)$/);
  if (!match) return;

  const oldStart = parseInt(match[1], 10);
  const newStart = parseInt(match[2], 10);
  const trailing = match[3] || "";

  let oldCount = 0;
  let newCount = 0;

  for (let i = hunkIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("@@") || l.startsWith("diff ") || l.startsWith("--- ") || l.startsWith("+++ ")) break;
    if (l.startsWith("-")) {
      oldCount++;
    } else if (l.startsWith("+")) {
      newCount++;
    } else {
      // context line (or empty line within a hunk)
      oldCount++;
      newCount++;
    }
  }

  lines[hunkIdx] = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${trailing}`;
}

/**
 * List the repository paths a unified diff touches (modified, added, deleted,
 * and both sides of a rename), so that only those files are staged.
 *
 * @param {string} patchText
 * @returns {string[]} Unique paths, in the order they first appear.
 */
export function patchFilePaths(patchText) {
  const paths = [];
  const add = (p) => {
    if (p && p !== "/dev/null" && !paths.includes(p)) paths.push(p);
  };
  const strip = (raw) => raw.trim().replace(/^"|"$/g, "").replace(/^[ab]\//, "").replace(/\t.*$/, "");

  for (const line of patchText.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("--- ")) add(strip(line.slice(4)));
    else if (line.startsWith("+++ ")) add(strip(line.slice(4)));
    else if (line.startsWith("rename from ")) add(line.slice(12).trim());
    else if (line.startsWith("rename to ")) add(line.slice(10).trim());
  }
  return paths;
}

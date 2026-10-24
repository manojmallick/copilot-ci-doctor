/**
 * output.js — machine-readable (--json) output mode.
 *
 * In JSON mode everything meant for people (progress, colours, tables) is sent
 * to stderr, so stdout carries exactly one JSON document that scripts can parse.
 */

let jsonMode = false;
let realStdoutWrite = null;

/** Switch to JSON mode: human output goes to stderr. Safe to call twice. */
export function enableJsonMode() {
  if (jsonMode) return;
  jsonMode = true;
  realStdoutWrite = process.stdout.write.bind(process.stdout);
  console.log = (...args) => console.error(...args);
  process.stdout.write = (...args) => process.stderr.write(...args);
}

export function isJsonMode() {
  return jsonMode;
}

/**
 * Print the final JSON document on stdout (only in JSON mode).
 * @param {object} data
 */
export function emitJson(data) {
  if (!jsonMode) return;
  realStdoutWrite(JSON.stringify(data, null, 2) + "\n");
}

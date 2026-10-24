/**
 * prompt.js — ask the user a yes/no question on the terminal.
 */

import readline from "node:readline";

/**
 * Ask a yes/no question. Resolves to false when stdin is not interactive,
 * so scripts never hang waiting for an answer.
 *
 * @param {string} question
 * @returns {Promise<boolean>}
 */
export function confirm(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

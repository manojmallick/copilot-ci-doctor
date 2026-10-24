/**
 * redact.js — Redact secrets and sensitive data from text
 *
 * Every piece of evidence passes through here before being included
 * in the bundle or displayed to the user.
 *
 * Redaction is pattern based and best effort: it recognises common credential
 * formats, it cannot recognise a secret that has no recognisable shape.
 */

/** [pattern, replacement] pairs, applied in order. */
const RULES = [
  // GitHub
  [/ghp_[A-Za-z0-9]{36}/g, "[REDACTED]"],                          // personal access tokens
  [/gho_[A-Za-z0-9]{36}/g, "[REDACTED]"],                          // OAuth tokens
  [/github_pat_[A-Za-z0-9_]{82}/g, "[REDACTED]"],                  // fine-grained PATs
  [/ghs_[A-Za-z0-9]{36}/g, "[REDACTED]"],                          // app installation tokens
  [/ghr_[A-Za-z0-9]{76}/g, "[REDACTED]"],                          // refresh tokens
  [/\bglpat-[A-Za-z0-9_-]{20,}/g, "[REDACTED]"],                   // GitLab personal access tokens

  // Cloud and API providers
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[REDACTED]"],                // AWS access key IDs
  [/aws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi, "[REDACTED]"], // AWS secret keys
  [/AccountKey=[A-Za-z0-9+/=]{20,}/g, "AccountKey=[REDACTED]"],    // Azure storage keys
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, "[REDACTED]"],                    // Google API keys
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, "[REDACTED]"],       // OpenAI / Anthropic keys
  [/\b[sr]k_(?:live|test)_[0-9A-Za-z]{16,}/g, "[REDACTED]"],       // Stripe keys
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[REDACTED]"],               // Slack tokens
  [/npm_[A-Za-z0-9]{36}/g, "[REDACTED]"],                          // npm tokens

  // Generic credentials
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[REDACTED]"], // JSON Web Tokens
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]"],        // Authorization: Bearer
  [/\bBasic\s+[A-Za-z0-9+/]{16,}={0,2}/g, "Basic [REDACTED]"],     // Authorization: Basic
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+(@)/gi, "$1[REDACTED]$2"], // password inside a URL
  [/token\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{20,}["']?/gi, "[REDACTED]"],
  [/password\s*[:=]\s*["']?[^\s"']{8,}["']?/gi, "[REDACTED]"],
  [/-----BEGIN\s+(RSA|DSA|EC|OPENSSH)?\s*PRIVATE KEY-----[\s\S]*?-----END/g, "[REDACTED]"], // private keys
];

/** Number of redaction rules (used by the documentation and tests). */
export const REDACTION_RULE_COUNT = RULES.length;

/**
 * Redact potential secrets from a string.
 *
 * @param {string} text
 * @returns {string} Text with secrets replaced by [REDACTED].
 */
export function redact(text) {
  if (!text || typeof text !== "string") return text;
  let result = text;
  for (const [pattern, replacement] of RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

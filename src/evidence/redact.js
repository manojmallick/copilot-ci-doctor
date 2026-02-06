/**
 * redact.js — Redact secrets and sensitive data from text
 *
 * Every piece of evidence passes through here before being included
 * in the bundle or displayed to the user.
 */

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{36}/g,                          // GitHub PATs
  /gho_[A-Za-z0-9]{36}/g,                          // GitHub OAuth tokens
  /github_pat_[A-Za-z0-9_]{82}/g,                  // Fine-grained PATs
  /ghs_[A-Za-z0-9]{36}/g,                          // GitHub App installation tokens
  /ghr_[A-Za-z0-9]{76}/g,                          // GitHub refresh tokens
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,              // Bearer tokens
  /token\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{20,}["']?/gi,
  /password\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
  /-----BEGIN\s+(RSA|DSA|EC|OPENSSH)?\s*PRIVATE KEY-----[\s\S]*?-----END/g, // Private keys
  /AKIA[0-9A-Z]{16}/g,                             // AWS access key IDs
  /sk-[A-Za-z0-9]{48}/g,                           // OpenAI API keys
  /npm_[A-Za-z0-9]{36}/g,                          // npm tokens
];

/**
 * Redact potential secrets from a string.
 *
 * @param {string} text
 * @returns {string} Text with secrets replaced by [REDACTED].
 */
export function redact(text) {
  if (!text || typeof text !== "string") return text;
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

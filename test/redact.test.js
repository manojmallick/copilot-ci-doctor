import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { redact, REDACTION_RULE_COUNT } from "../src/evidence/redact.js";

// Fake credentials are assembled at runtime so that no real-looking secret is
// committed to the repository (and secret scanners stay quiet).
const rep = (s, n) => s.repeat(n);
const SECRETS = {
  "GitHub personal access token": "ghp_" + rep("aB3", 12),
  "GitHub OAuth token": "gho_" + rep("aB3", 12),
  "GitHub fine-grained token": "github_pat_" + rep("aB3_", 21) + "ab",
  "GitHub app token": "ghs_" + rep("aB3", 12),
  "GitHub refresh token": "ghr_" + rep("aB3", 25) + "a",
  "GitLab token": "glpat-" + rep("aB3", 7),
  "AWS access key id": "AKIA" + rep("AB12", 4),
  "AWS secret access key": "aws_secret_access_key = " + rep("aB3/", 10),
  "Azure storage key": "AccountKey=" + rep("aB3+", 8),
  "Google API key": "AIza" + rep("aB3_", 8) + "abc",
  "OpenAI key (legacy)": "sk-" + rep("aB3", 16),
  "OpenAI project key": "sk-proj-" + rep("aB3_", 12),
  "Anthropic key": "sk-ant-" + rep("aB3-", 12),
  "Stripe live key": "sk_live_" + rep("aB3", 8),
  "Slack token": "xoxb-" + rep("1234567890-", 3) + "abc",
  "npm token": "npm_" + rep("aB3", 12),
  "JSON Web Token": "eyJ" + rep("abc", 6) + "." + "eyJ" + rep("def", 6) + "." + rep("ghi", 6),
  "Bearer token": "Bearer " + rep("aB3", 10),
  "Basic auth": "Basic " + btoa("someuser:somepassword"),
  "private key": "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf\n-----END RSA PRIVATE KEY-----",
};

describe("redact()", () => {
  for (const [name, secret] of Object.entries(SECRETS)) {
    test(`removes a ${name}`, () => {
      const out = redact(`before ${secret} after`);
      // The sensitive part must be gone and a marker left in its place.
      const core = secret.replace(/^(Bearer |Basic |aws_secret_access_key = |AccountKey=)/, "");
      assert.ok(!out.includes(core), `secret still present in: ${out}`);
      assert.ok(out.includes("[REDACTED]"));
      assert.ok(out.startsWith("before "));
      assert.ok(out.endsWith(" after") || out.endsWith("after"));
    });
  }

  test("redacts the password inside a connection URL but keeps the host", () => {
    const out = redact("DATABASE_URL=postgres://app:hunter2hunter2@db.internal:5432/main");
    assert.ok(!out.includes("hunter2hunter2"));
    assert.ok(out.includes("postgres://app:[REDACTED]@db.internal:5432/main"));
  });

  test("redacts password= and token= assignments", () => {
    assert.ok(!redact("password=SuperSecret123").includes("SuperSecret123"));
    assert.ok(!redact(`token: ${rep("a1B2", 8)}`).includes(rep("a1B2", 8)));
  });

  test("redacts several secrets in one text", () => {
    const text = [SECRETS["GitHub personal access token"], SECRETS["AWS access key id"], SECRETS["Slack token"]].join("\n");
    const out = redact(text);
    assert.equal(out.split("[REDACTED]").length - 1, 3);
  });

  test("leaves ordinary log text and look-alike words alone", () => {
    const text = [
      "Run npm ci",
      "added 214 packages in 6s",
      "disk-image-name-that-is-quite-long-here",
      "task-queue-worker-with-a-very-long-name",
      "Error: Process completed with exit code 1.",
    ].join("\n");
    assert.equal(redact(text), text);
  });

  test("is idempotent", () => {
    const once = redact(Object.values(SECRETS).join("\n"));
    assert.equal(redact(once), once);
  });

  test("passes non-strings and empty values through", () => {
    assert.equal(redact(""), "");
    assert.equal(redact(null), null);
    assert.equal(redact(undefined), undefined);
    assert.equal(redact(42), 42);
  });

  test("exposes the number of rules", () => {
    assert.ok(Number.isInteger(REDACTION_RULE_COUNT) && REDACTION_RULE_COUNT >= 20);
  });
});

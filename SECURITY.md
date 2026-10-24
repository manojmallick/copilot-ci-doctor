# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. If that is not available, contact the maintainer through the email on their [GitHub profile](https://github.com/manojmallick).

Include what you found, how to reproduce it and the version (`copilot-ci-doctor --version`). You can expect an acknowledgement within a few days.

## Scope

Of particular interest:

- secrets that get past the redaction in `src/evidence/redact.js` and reach the cache, the terminal or Copilot;
- commands that modify, commit or push more than intended;
- command injection through run logs, workflow names or branch names.

## Supported versions

Only the latest published version on npm receives fixes.

## Things to know

The tool sends redacted CI evidence to GitHub Copilot and applies model-written patches. Read [docs/safety-and-privacy.md](docs/safety-and-privacy.md) for what is protected and the known gaps.

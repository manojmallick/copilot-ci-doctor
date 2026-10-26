# copilot-ci-doctor documentation

Start with the [README](../README.md) for the pitch and the quick start, then use this page to find the detail you need.

## Using the tool

- [Commands](./commands.md): every command and option, exit codes, `--json`, cache files
- [Worked examples](./examples.md): nine typical failures and what the tool can and cannot do about each
- [Recipes](./recipes.md): ready-to-run scripts and GitHub Actions workflows (tested), exit-code handling
- [Configuration](./configuration.md): option defaults, fixed limits, credentials, files written
- [Run it in GitHub Actions](./github-action.md): post a diagnosis as a pull request comment (experimental)
- [Troubleshooting](./troubleshooting.md): messages you may see and how to fix them
- [FAQ](./faq.md): what is sent, permissions, exit codes, Windows, cleanup

## Understanding it

- [How it works](./how-it-works.md): the evidence bundle, how Copilot is called, the JSON contract, patch handling, token numbers, code layout
- [Safety and privacy](./safety-and-privacy.md): safeguards, what is sent to Copilot, what redaction covers and misses

## Project

- [CHANGELOG](../CHANGELOG.md): release notes and behaviour changes
- [CONTRIBUTING](../CONTRIBUTING.md): how to set up, test and propose changes
- [SECURITY](../SECURITY.md): reporting a vulnerability
- [Releasing](./RELEASING.md): how maintainers publish to npm
- [Hackathon notes](./HACKATHON.md): notes written for the judges

## Which page answers my question?

| I want to... | Go to |
|---|---|
| Install and try it | [README quick start](../README.md#quick-start) |
| See what a command does and its options | [Commands](./commands.md) |
| Use it from a script or CI | [Recipes](./recipes.md), [Commands: scripting](./commands.md#scripting-and---json), [GitHub Action](./github-action.md) |
| See what happens for my kind of failure | [Worked examples](./examples.md) |
| Know exactly what leaves my machine | [Safety and privacy](./safety-and-privacy.md) |
| Fix an error message | [Troubleshooting](./troubleshooting.md) |
| Check permissions or whether it works on my setup | [FAQ](./faq.md) |
| Change a threshold or limit | [Configuration](./configuration.md) |

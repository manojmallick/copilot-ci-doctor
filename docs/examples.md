# Worked examples

Three typical failures and what to expect from each command. The outputs below are **illustrative**: they show the shape of the results and are not recordings. Model output varies between runs, and confidence numbers are the model's own estimate.

Every example starts the same way, from inside a clone with a failed Actions run:

```bash
copilot-ci-doctor analyze        # evidence + ranked hypotheses
copilot-ci-doctor fix --dry-run  # preview the patch, change nothing
copilot-ci-doctor fix            # apply it on a ci-fix/* branch after you confirm
```

## 1. Missing lockfile

**Failure:** the `Install` step prints `npm ERR! The npm ci command can only install with an existing package-lock.json`.

```
Hypotheses
  1. npm ci needs a lockfile            90%   evidence: E4
  2. Wrong working directory             20%   evidence: E5
```

**Typical patch:** change `npm ci` to `npm install` in the workflow, or (better) commit the lockfile. The first is a one-line workflow diff that `fix` can apply; the second is a change only you can make, so a good hypothesis will say so in the explanation.

**What to check:** `npm install` can change dependency versions in CI. If reproducible builds matter to you, commit `package-lock.json` instead.

## 2. Failing test

**Failure:** `npm test` exits with code 1 after `1 failing` in the log.

```
Hypotheses
  1. Test asserts an old value after a code change   70%   evidence: E4
  2. Flaky timing in the test                         25%   evidence: E4
```

**Typical outcome:** the model points at the failing assertion from the last 200 log lines. It can only see the log and the workflow file, not your source, so a patch to application code is unlikely, and the model's confidence may be lower. `fix` refuses patches below 60% and says why (exit code 2).

**What to check:** read the explanation, reproduce locally, and fix the code yourself. Use `analyze --run-id <id>` to look at an older failure.

## 3. Lint error

**Failure:** `eslint` reports `no-unused-vars` and the job fails.

```
Hypotheses
  1. Unused variable introduced in the last commit    85%   evidence: E4
```

**Typical patch:** only when the file is part of the workflow can `fix` change it. For code files, the model never sees your source, so expect an explanation and a suggested edit; if it proposes a patch that does not match your files, `fix` reports `does-not-apply` (exit code 2) and leaves the working tree alone.

## Reading the result in scripts

```bash
copilot-ci-doctor analyze --json | jq -r '.hypotheses[0] | "\(.confidence)% \(.title)"'
copilot-ci-doctor fix --dry-run --json | jq '{applied, reason, files}'
```

See [commands](commands.md#scripting-and---json) for the exit codes and JSON fields.

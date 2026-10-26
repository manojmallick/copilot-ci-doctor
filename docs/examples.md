# Worked examples

Nine typical failures and what to expect from each command, then [how to use the tool from scripts and workflows](recipes.md). The outputs below are **illustrative**: they show the shape of the results and are not recordings. Model output varies between runs, and confidence numbers are the model's own estimate.

## Which failures can it fix?

The tool sees the failed run's metadata, the failed steps, the last 200 log lines and the workflow file. It never sees your source code. That decides what it can do:

| Failure | Typically fixable by `fix`? | Why |
|---|---|---|
| [Missing lockfile](#example-1-missing-lockfile) | Yes, by editing the workflow | The change is in the workflow file |
| [Failing test](#example-2-failing-test) | Rarely | The cause is in your code, which it cannot see |
| [Lint error](#example-3-lint-error) | Rarely | Same |
| [Wrong Node version](#example-4-wrong-node-version) | Yes | `node-version` is in the workflow |
| [Missing secret or input](#example-5-missing-secret-or-input) | No | The value lives in your repository settings |
| [Misspelled action or version](#example-6-misspelled-action-or-version) | Yes | The reference is in the workflow |
| [Permission denied for the token](#example-7-permission-denied-for-the-token) | Yes, by adding `permissions:` | The block is in the workflow |
| [Missing Python module](#example-8-missing-python-module) | Sometimes | Only if the install step is in the workflow, not in a file it cannot see |
| [Job timeout](#example-9-job-timeout) | Partly | It can raise `timeout-minutes`, but not find a hang in your code |

Where it cannot fix, the diagnosis is still useful: it points at the evidence line and says what to change.

Every example starts the same way, from inside a clone with a failed Actions run:

```bash
copilot-ci-doctor analyze        # evidence + ranked hypotheses
copilot-ci-doctor fix --dry-run  # preview the patch, change nothing
copilot-ci-doctor fix            # apply it on a ci-fix/* branch after you confirm
```

## Example 1: Missing lockfile

**Failure:** the `Install` step prints `npm ERR! The npm ci command can only install with an existing package-lock.json`.

```
Hypotheses
  1. npm ci needs a lockfile            90%   evidence: E4
  2. Wrong working directory             20%   evidence: E5
```

**Typical patch:** change `npm ci` to `npm install` in the workflow, or (better) commit the lockfile. The first is a one-line workflow diff that `fix` can apply; the second is a change only you can make, so a good hypothesis will say so in the explanation.

**What to check:** `npm install` can change dependency versions in CI. If reproducible builds matter to you, commit `package-lock.json` instead.

## Example 2: Failing test

**Failure:** `npm test` exits with code 1 after `1 failing` in the log.

```
Hypotheses
  1. Test asserts an old value after a code change   70%   evidence: E4
  2. Flaky timing in the test                         25%   evidence: E4
```

**Typical outcome:** the model points at the failing assertion from the last 200 log lines. It can only see the log and the workflow file, not your source, so a patch to application code is unlikely, and the model's confidence may be lower. `fix` refuses patches below 60% and says why (exit code 2).

**What to check:** read the explanation, reproduce locally, and fix the code yourself. Use `analyze --run-id <id>` to look at an older failure.

## Example 3: Lint error

**Failure:** `eslint` reports `no-unused-vars` and the job fails.

```
Hypotheses
  1. Unused variable introduced in the last commit    85%   evidence: E4
```

**Typical patch:** only when the file is part of the workflow can `fix` change it. For code files, the model never sees your source, so expect an explanation and a suggested edit; if it proposes a patch that does not match your files, `fix` reports `does-not-apply` (exit code 2) and leaves the working tree alone.

## Example 4: Wrong Node version

**Failure:** the install step warns or fails with a message like `npm warn EBADENGINE Unsupported engine { package: 'vite@6', required: { node: '>=20' }, current: { node: 'v18.20.4' } }`, and the build that follows breaks.

```
Hypotheses
  1. Workflow uses Node 18 but a dependency requires Node 20 or newer   92%   evidence: E4, E5
```

**Typical patch:** change `node-version: '18'` to `'20'` (or `'22'`) in the `actions/setup-node` step. This is a one-line workflow change that `fix` can apply.

**What to check:** the version should match what `engines` in `package.json` and your local machine use. If you test on a matrix, change the matrix entry instead.

## Example 5: Missing secret or input

**Failure:** a step fails with `Error: Input required and not supplied: token`, or a deploy step reports an empty credential.

```
Hypotheses
  1. A required secret is not set or not passed to the step   80%   evidence: E3, E5
```

**Typical outcome:** the explanation names the step and the input. There is nothing to patch: the secret is a repository or organisation setting, and in forks and pull requests from other repositories secrets are not passed on by design. `fix` finds no safe change and exits with code `2`.

**What to check:** Settings, Secrets and variables, Actions; whether the workflow runs for a pull request from a fork; and whether the secret name in Settings matches the name used in the workflow's `secrets.` expression exactly (names are case-insensitive but must otherwise be identical).

## Example 6: Misspelled action or version

**Failure:** the job fails at set-up with `Unable to resolve action actions/checkout@v9, unable to find version v9`.

```
Hypotheses
  1. The workflow references a version of actions/checkout that does not exist   95%   evidence: E3, E5
```

**Typical patch:** `uses: actions/checkout@v9` becomes `uses: actions/checkout@v4`. Confident and easy to review; check the tag exists before you merge.

## Example 7: Permission denied for the token

**Failure:** a step that comments on a pull request, pushes a tag or publishes a package fails with `Resource not accessible by integration` (HTTP 403).

```
Hypotheses
  1. The job's GITHUB_TOKEN lacks the write permission this step needs   85%   evidence: E4, E5
```

**Typical patch:** add a `permissions:` block to the job, for example `pull-requests: write`. Give only the permission the step needs.

**What to check:** repository settings can also set the default token permissions to read-only; a `permissions:` block in the workflow overrides that default for the job.

## Example 8: Missing Python module

**Failure:** `ModuleNotFoundError: No module named 'requests'` in the test step.

```
Hypotheses
  1. requests is imported but never installed in the workflow   75%   evidence: E4, E5
  2. requirements.txt is missing the dependency                 50%   evidence: E4
```

**Typical outcome:** if the workflow installs packages with an explicit `pip install ...` line, a patch can add the module. If it runs `pip install -r requirements.txt`, the real fix is in a file the tool does not see, so expect an explanation and no applicable patch.

## Example 9: Job timeout

**Failure:** the run ends with `The job running on runner ... has exceeded the maximum execution time` or the step shows `The operation was canceled.`

```
Hypotheses
  1. A test or server process never exits, so the job runs to the time limit   60%   evidence: E3, E4
  2. timeout-minutes is lower than the real duration                            35%   evidence: E5
```

**Typical outcome:** raising `timeout-minutes` is an easy patch, but it hides the problem if the process really hangs. Prefer hypothesis 1: look for a server started in the background or a watch-mode test command.

## Reading the result in scripts

```bash
copilot-ci-doctor analyze --json | jq -r '.hypotheses[0] | "\(.confidence)% \(.title)"'
copilot-ci-doctor fix --dry-run --json | jq '{applied, reason, files}'
```

See [commands](commands.md#scripting-and---json) for the exit codes and JSON fields, and [recipes](recipes.md) for ready-to-run scripts and workflows.

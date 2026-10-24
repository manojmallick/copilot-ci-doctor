# Configuration reference

`copilot-ci-doctor` has **no configuration file and no environment variables of its own**. Behaviour is set with command-line options, and the tools it calls (`gh`, `git`, Copilot CLI) use their own settings. This page lists everything you can change, the defaults, and what the tool writes to disk.

## Command-line options and defaults

| Setting | Option | Default | Applies to |
|---|---|---|---|
| Run to inspect | `--run-id <id>` | latest failed run | `analyze`, `explain`, `retry` |
| Branch to inspect | `--branch <name>` | any branch | `analyze`, `explain`, `retry` |
| Repository | `--repo OWNER/NAME` | repository of the current clone | `analyze`, `explain`, `retry` |
| Minimum confidence | `--min-confidence <percent>` | `60` for `fix`, `80` for `watch` | `fix`, `watch` |
| Maximum fix attempts | `--max-iterations <n>` | `5` | `watch`, `fix --auto` |
| Seconds between CI checks | `--poll-interval <seconds>` | `10` | `watch`, `fix --auto` |
| Wait for a CI run | `--poll-timeout <seconds>` | `180` | `watch`, `fix --auto` |
| Pull request base branch | `--base <branch>` | repository default branch | `watch`, `fix --auto` |
| No pull request | `--no-pr` | a PR is opened when CI passes | `watch`, `fix --auto` |
| Preview only | `--dry-run` | off | `fix`, `watch` |
| Skip the confirmation | `--yes` | ask | `fix`, `demo` |
| Machine-readable output | `--json` | off | `analyze`, `explain`, `fix`, `watch` |
| Public demo repository | `--public` | private | `demo` |
| Remove the demo project and repository | `--cleanup` | off | `demo` |

Invalid values (a non-numeric `--run-id`, `--min-confidence 150`, a branch starting with `-`) are rejected before anything runs, with exit code 1. Full descriptions and examples: [commands](commands.md).

## Fixed behaviour

These are not configurable today:

| What | Value |
|---|---|
| Evidence | Five items: repo info, run metadata, failed jobs and steps, the last 200 log lines, the workflow YAML |
| Failed runs considered | The 20 most recent failures |
| Copilot call timeout | 180 seconds |
| Diff shown in the terminal | Truncated at 400 lines (the full patch is saved) |
| Fix branch name | `ci-fix/<YYYYMMDD-HHMMSS>` |
| Commit message | `CI Doctor: <patch description>` |
| Hard confidence floor | A patch is never auto-applied if the risk is HIGH |
| Token numbers | Estimates at about 4 characters per token, not billing figures |

## Environment and credentials

- **GitHub:** the tool runs `gh`, so `gh auth login`, `GH_TOKEN`, `GH_HOST` and the other [`gh` settings](https://cli.github.com/manual/gh_help_environment) apply. The account needs to read Actions runs and, for `watch`, push branches and open pull requests.
- **Copilot:** requests go through `gh copilot -p ... -s`, so Copilot CLI's own sign-in and plan apply. See [troubleshooting](troubleshooting.md#copilot-cli-invocation-failed).
- **In GitHub Actions:** see [github-action](github-action.md) for the token and permissions.
- **Git:** `fix` and `watch` commit with your normal git identity (`user.name`, `user.email`). Without one, git stops with its own "Author identity unknown" message.
- **Colour:** output uses ANSI colour; set `NO_COLOR=1` to turn it off (honoured by the colour library).

## Files written

Everything goes under `.copilot-ci-doctor/cache/` in the directory where you run the command. Add `.copilot-ci-doctor/` to your `.gitignore`: your repository does not ignore it by default, and although `fix` and `watch` only commit the files named in the patch, an untracked folder is noise in `git status`.

| File | Written by | Contents |
|---|---|---|
| `latest-evidence.json` | `analyze`, `watch` (`fix` and `explain` read it) | The redacted evidence bundle |
| `latest-hypotheses.json` | `analyze`, `watch` | Ranked hypotheses |
| `latest-explain.json` | `explain`, `watch` | The explanation |
| `latest-patch.json` | `fix`, `watch` | The parsed patch proposal |
| `proposed.patch` | `fix`, `watch` | The patch as applied or proposed |
| `git-apply-error.txt` | `fix`, `watch` | Output of a failed `git apply --check` |
| `copilot-raw-output-debug.txt` | any command that calls Copilot | Redacted raw Copilot output, only when the reply could not be parsed |

`demo` also creates `.copilot-ci-doctor/demo-run/`, and `.copilot-ci-doctor/demo-repo.json` when it created a GitHub repository (used by `demo --cleanup`). Delete `.copilot-ci-doctor/` at any time; it is rebuilt on the next run.

## Exit codes

`0` done, `1` error, `2` ran but did not fix. See [commands](commands.md#exit-codes).

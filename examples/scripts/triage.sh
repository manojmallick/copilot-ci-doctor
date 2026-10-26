#!/bin/sh
# Print the likely cause of the latest CI failure, changing nothing.
#
#   examples/scripts/triage.sh                 # latest failed run
#   RUN_ID=1234567890 examples/scripts/triage.sh
#   BRANCH=release/1.4 examples/scripts/triage.sh
#
# Needs: copilot-ci-doctor and jq on the PATH, run from a clone with a failed Actions run.
# Exit: 0 diagnosis printed, 1 the tool failed (message on stderr).

set -u

set --
[ -n "${RUN_ID:-}" ] && set -- "$@" --run-id "$RUN_ID"
[ -n "${BRANCH:-}" ] && set -- "$@" --branch "$BRANCH"

out=$(mktemp) || exit 1
trap 'rm -f "$out"' EXIT

copilot-ci-doctor analyze --json "$@" > "$out" 2> /dev/null
status=$?
if [ "$status" -ne 0 ]; then
  echo "triage failed: $(jq -r '.error // "unknown error"' "$out")" >&2
  exit 1
fi

jq -r '"Failed run: \(.run.workflow) #\(.run.runId) on \(.run.branch)",
       (.hypotheses[] | "  \(.rank). \(.title)  [\(.confidence)%]  evidence: \(.evidence_refs | join(", "))")' "$out"

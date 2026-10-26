#!/bin/sh
# Try an automatic fix, but only above a confidence threshold, and say what to do next.
#
#   examples/scripts/fix-or-hand-off.sh
#   MIN_CONFIDENCE=90 examples/scripts/fix-or-hand-off.sh
#   DRY_RUN=1 examples/scripts/fix-or-hand-off.sh      # preview only, nothing changes
#
# Needs: copilot-ci-doctor and jq on the PATH, run from a clean clone of the failing commit.
# Exit codes of this script (different from the tool's, so a pipeline can branch on them):
#   0   a fix was applied on a new ci-fix/* branch (or, with DRY_RUN=1, the patch applies cleanly)
#   10  no safe automatic fix: a person has to look (message says why)
#   1   the tool itself failed

set -u

MIN_CONFIDENCE="${MIN_CONFIDENCE:-85}"

out=$(mktemp) || exit 1
trap 'rm -f "$out"' EXIT

# fix reads the evidence that analyze caches, so run analyze first.
if ! copilot-ci-doctor analyze --json > "$out" 2> /dev/null; then
  echo "analyze failed: $(jq -r '.error // "unknown error"' "$out")" >&2
  exit 1
fi

if [ -n "${DRY_RUN:-}" ]; then
  copilot-ci-doctor fix --dry-run --min-confidence "$MIN_CONFIDENCE" --json > "$out" 2> /dev/null
else
  copilot-ci-doctor fix --yes --min-confidence "$MIN_CONFIDENCE" --json > "$out" 2> /dev/null
fi
status=$?

case "$status" in
  0)
    if [ "$(jq -r '.applied' "$out")" = "true" ]; then
      echo "Fix applied on branch $(jq -r '.branch' "$out") ($(jq -r '.confidence' "$out")% confidence):"
      echo "  $(jq -r '.description' "$out")"
      echo "Review it, then push the branch and open a pull request."
    else
      echo "Dry run: patch applies cleanly to $(jq -r '.files | join(", ")' "$out") ($(jq -r '.confidence' "$out")% confidence)."
    fi
    exit 0
    ;;
  2)
    reason=$(jq -r '.reason' "$out")
    case "$reason" in
      low-confidence)  echo "Needs a person: confidence $(jq -r '.confidence' "$out")% is below $MIN_CONFIDENCE%." ;;
      high-risk)       echo "Needs a person: the proposed change is high risk." ;;
      does-not-apply)  echo "Needs a person: the patch does not apply to this checkout." ;;
      *)               echo "Needs a person: no automatic fix ($reason)." ;;
    esac
    echo "The proposal is in .copilot-ci-doctor/cache/proposed.patch"
    exit 10
    ;;
  *)
    echo "fix failed: $(jq -r '.error // "unknown error"' "$out")" >&2
    exit 1
    ;;
esac

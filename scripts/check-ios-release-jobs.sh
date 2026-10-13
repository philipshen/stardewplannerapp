#!/usr/bin/env bash
set -euo pipefail
eas=(npx --yes eas-cli@24.12.1)
release_dir=$(mktemp -d)
trap 'rm -rf "$release_dir"' EXIT

# A canceled GitHub runner does not necessarily cancel its cloud operation.
# Refuse overlap with those jobs (including releases started outside GitHub).
for status in new in-queue in-progress pending-cancel; do
  "${eas[@]}" build:list --platform ios --status "$status" --limit 1 --json --non-interactive > "$release_dir/jobs.json"
  node -e 'const jobs=require(process.argv[1]); if(!Array.isArray(jobs)||jobs.length) { console.error("An iOS build is active, or EAS returned an unexpected response. Retry after checking EAS."); process.exit(1); }' "$release_dir/jobs.json"
done
for status in awaiting-build in-queue in-progress; do
  "${eas[@]}" submit:list --platform ios --status "$status" --limit 1 --json --non-interactive > "$release_dir/jobs.json"
  node -e 'const jobs=require(process.argv[1]); if(!Array.isArray(jobs)||jobs.length) { console.error("An iOS submission is active, or EAS returned an unexpected response. Retry after checking EAS."); process.exit(1); }' "$release_dir/jobs.json"
done


# Local and GitHub jobs cannot share a filesystem lock. Refuse a manual release
# while this repository's GitHub release workflow is running or waiting.
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  gh api 'repos/philipshen/stardewplannerapp/actions/runs?per_page=100' > "$release_dir/github-runs.json"
  node -e 'const data=require(process.argv[1]); if(!Array.isArray(data.workflow_runs)) throw Error("Unexpected GitHub response"); if(data.workflow_runs.some(r=>r.path===".github/workflows/ios-release.yml"&&r.status!=="completed")) { console.error("A GitHub iOS release is active. Wait for it to finish."); process.exit(1); }' "$release_dir/github-runs.json"
fi

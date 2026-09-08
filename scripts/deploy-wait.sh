#!/usr/bin/env bash
# Wait for the GitHub Pages deployment of the *current* HEAD commit.
#
# The previous inline version took the newest deployment in the list after a
# fixed 20s sleep. If ours had not registered yet it polled the previous
# deployment instead, found it already successful, and reported a green deploy
# while the live site still served the old bundle. Everything here is pinned to
# the pushed SHA so that cannot happen.

set -uo pipefail

REPO="1Guv/mrg"
SITE="https://mrvaluations.co.uk"
REGISTER_TIMEOUT=180   # seconds to wait for the deployment record to appear
STATUS_TIMEOUT=900     # seconds to wait for it to reach a terminal state
POLL=10

notify() { osascript -e "display notification \"$2\" with title \"$1\" sound name \"$3\"" >/dev/null 2>&1 || true; }

fail() {
  echo "$1" >&2
  notify "GitHub Pages Deploy Failed" "$1" "Basso"
  exit 1
}

SHA=$(git rev-parse HEAD) || fail "Not a git repository"
echo "Waiting for the GitHub Pages deployment of ${SHA:0:7}..."

if ! git merge-base --is-ancestor "$SHA" "origin/$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null; then
  echo "Warning: ${SHA:0:7} does not appear on the remote branch — did you push?" >&2
fi

# 1. Wait for a deployment record for this exact SHA.
DEPLOY_ID=""
elapsed=0
while [ -z "$DEPLOY_ID" ]; do
  DEPLOY_ID=$(gh api "repos/$REPO/deployments?per_page=20" \
    --jq "[.[] | select(.sha==\"$SHA\")] | sort_by(.created_at) | last | .id // empty" 2>/dev/null || echo "")
  [ -n "$DEPLOY_ID" ] && break
  [ "$elapsed" -ge "$REGISTER_TIMEOUT" ] && fail "No deployment registered for ${SHA:0:7} after ${REGISTER_TIMEOUT}s"
  sleep "$POLL"; elapsed=$((elapsed + POLL))
done
echo "Polling deployment $DEPLOY_ID (${SHA:0:7})..."

# 2. Poll that deployment until it reaches a terminal state.
STATE="pending"
elapsed=0
while :; do
  STATE=$(gh api "repos/$REPO/deployments/$DEPLOY_ID/statuses" --jq '.[0].state // "pending"' 2>/dev/null || echo pending)
  echo "Status: $STATE"
  case "$STATE" in
    success) break ;;
    failure|error) fail "Deployment $DEPLOY_ID for ${SHA:0:7} reported: $STATE" ;;
  esac
  [ "$elapsed" -ge "$STATUS_TIMEOUT" ] && fail "Deployment $DEPLOY_ID still '$STATE' after ${STATUS_TIMEOUT}s"
  sleep "$POLL"; elapsed=$((elapsed + POLL))
done

# 3. Confirm Pages actually built this commit, not an earlier one.
BUILT=$(gh api "repos/$REPO/pages/builds/latest" --jq '.commit // empty' 2>/dev/null || echo "")
if [ -n "$BUILT" ] && [ "$BUILT" != "$SHA" ]; then
  fail "Pages latest build is ${BUILT:0:7}, expected ${SHA:0:7}"
fi

# 4. Confirm the CDN is serving the freshly built bundle (edge cache is 10m).
BUNDLE=$(grep -oE 'main-[A-Za-z0-9]+\.js' docs/index.html 2>/dev/null | head -1 || echo "")
if [ -n "$BUNDLE" ]; then
  echo "Waiting for the CDN to serve $BUNDLE..."
  elapsed=0
  until curl -s "$SITE/?cb=$elapsed$RANDOM" -H 'Cache-Control: no-cache' | grep -q "$BUNDLE"; do
    if [ "$elapsed" -ge 660 ]; then
      echo "Warning: $SITE still served a stale bundle after ${elapsed}s (edge cache max-age is 600s)." >&2
      break
    fi
    sleep 15; elapsed=$((elapsed + 15))
  done
fi

notify "GitHub Pages Deployed" "mrvaluations.co.uk is now live" "Glass"
echo "Live at $SITE (${SHA:0:7})"

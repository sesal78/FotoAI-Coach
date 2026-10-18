#!/usr/bin/env bash
# Smoke-tests a running FotoAI web container: it serves a page, one of that page's own
# static assets, and the health endpoint answers (with dummy env it reports "unhealthy";
# the check is that the server responds, not that Supabase is reachable).
# Usage: scripts/smoke-image.sh http://localhost:3011
set -euo pipefail
base="${1:?usage: smoke-image.sh <base-url>}"

for _ in $(seq 1 30); do curl -fsS -o /dev/null "$base/" && break; sleep 2; done

page="$(curl -fsS "$base/")" || { echo "FAIL: GET / did not return 200"; exit 1; }
asset="$(printf '%s' "$page" | grep -oE '/_next/static/[^"]+\.(js|css)' | head -n 1 || true)"
[ -n "$asset" ] || { echo "FAIL: no /_next/static asset referenced in /"; exit 1; }
type="$(curl -fsS -o /dev/null -w '%{content_type}' "$base$asset")" || { echo "FAIL: $asset did not return 200"; exit 1; }
case "$type" in *javascript*|*css*) ;; *) echo "FAIL: $asset has content type '$type'"; exit 1 ;; esac

health="$(curl -sS "$base/api/health")"
printf '%s' "$health" | grep -q '"status"' || { echo "FAIL: /api/health returned no status JSON"; exit 1; }

echo "serves a page and one of its own static assets: ok"

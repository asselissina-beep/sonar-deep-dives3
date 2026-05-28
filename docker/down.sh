#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

docker compose down "$@"

if command -v supabase >/dev/null 2>&1; then
  echo "Stopping local Supabase…"
  supabase stop || true
fi

#!/usr/bin/env bash
# Paperclip runs this inside a freshly created git worktree (one per task).
# It makes the worktree runnable without touching the main checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="${PAPERCLIP_WORKSPACE_REPO_ROOT:-}"

# Copy local, git-ignored env files from the main checkout if they exist there.
if [ -n "$ROOT" ] && [ "$ROOT" != "$(pwd)" ]; then
  for f in .env apps/api/.env apps/web/.env apps/track/.env; do
    if [ -f "$ROOT/$f" ] && [ ! -f "$f" ]; then cp "$ROOT/$f" "$f"; fi
  done
fi

# Dependencies: pnpm uses a shared content-addressable store, so this is fast
# and does not duplicate node_modules on disk.
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prefer-offline --frozen-lockfile 2>&1 | tail -n 5 || pnpm install --prefer-offline 2>&1 | tail -n 5
fi

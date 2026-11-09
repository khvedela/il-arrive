#!/usr/bin/env bash
# Paperclip runs this inside a freshly created git worktree (one per task), with
# the worktree as the current directory. It makes the worktree runnable without
# touching the main checkout.
set -euo pipefail
# Paperclip resolves this script to its path in the main checkout, so never
# derive the working directory from $0: stay in the worktree we were started in.
cd "${PAPERCLIP_WORKSPACE_WORKTREE_PATH:-${PAPERCLIP_WORKSPACE_CWD:-$PWD}}"
ROOT="${PAPERCLIP_WORKSPACE_REPO_ROOT:-}"

# Copy local, git-ignored env files from the main checkout if they exist there.
if [ -n "$ROOT" ] && [ "$ROOT" != "$(pwd)" ]; then
  for f in .env apps/api/.env apps/web/.env apps/track/.env; do
    if [ -f "$ROOT/$f" ] && [ ! -f "$f" ]; then cp "$ROOT/$f" "$f"; fi
  done
fi

# Dependencies: pnpm uses a shared content-addressable store, so this is fast
# and does not duplicate package contents on disk.
if command -v pnpm >/dev/null 2>&1; then
  # Never let a dependency hiccup block the task: the agent can fix installs inside the run.
  if ! pnpm install --prefer-offline --frozen-lockfile >/tmp/provision-$$.log 2>&1 \
     && ! pnpm install --prefer-offline >>/tmp/provision-$$.log 2>&1 \
     && ! pnpm install --prefer-offline --ignore-scripts >>/tmp/provision-$$.log 2>&1; then
    echo "WARNING: pnpm install failed in worktree; agent must run 'pnpm install' and fix it first:" >&2
    tail -n 20 /tmp/provision-$$.log >&2
  else
    tail -n 3 /tmp/provision-$$.log
  fi
  rm -f /tmp/provision-$$.log
fi
echo "provisioned worktree: $(pwd)"

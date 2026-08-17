#!/usr/bin/env bash
# Local AI Chat Studio — setup & launch
# Requires: uv (https://docs.astral.sh/uv/), Node.js + npm (https://nodejs.org)
# Creates a Python venv at .venv/ in the project root.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
VENV="$ROOT/.venv"
FRONTEND="$ROOT/frontend"
DIST="$FRONTEND/dist"

# ── helpers ──────────────────────────────────────────────────────────────────

step() { printf '\n==> %s\n' "$1"; }

fail() {
    printf '\nERROR: %s\n\n' "$1" >&2
    exit 1
}

require() {
    command -v "$1" >/dev/null 2>&1
}

# ── pre-flight checks ─────────────────────────────────────────────────────────

step "Checking prerequisites"

if ! require uv; then
    printf 'uv is not installed.\n'
    printf 'Install it with:\n'
    printf '  curl -LsSf https://astral.sh/uv/install.sh | sh\n'
    printf 'Then restart your shell and re-run this script.\n'
    fail "uv not found"
fi

if ! require node; then
    printf 'Node.js is not installed.\n'
    printf 'Install it from: https://nodejs.org  (LTS recommended)\n'
    printf 'Or via nvm:      https://github.com/nvm-sh/nvm\n'
    fail "node not found"
fi

if ! require npm; then
    fail "npm not found — reinstall Node.js from https://nodejs.org"
fi

printf '  uv   : %s\n' "$(uv --version)"
printf '  node : %s\n' "$(node --version)"
printf '  npm  : %s\n' "$(npm --version)"

# ── Python venv + dependencies ────────────────────────────────────────────────

step "Setting up Python environment (venv in project root)"
cd "$ROOT"

if [[ ! -f "$VENV/bin/activate" ]]; then
    printf 'Creating virtual environment at .venv/ ...\n'
    uv venv --python 3.12 "$VENV"
fi

printf 'Syncing dependencies from lockfile...\n'
uv sync --locked || fail "uv sync failed — run 'uv lock --upgrade' if the lock file is stale"

# ── Frontend build ────────────────────────────────────────────────────────────

step "Building frontend"
cd "$FRONTEND"

if [[ ! -d node_modules ]]; then
    printf 'Installing npm packages...\n'
    npm ci --legacy-peer-deps || fail "npm ci failed"
fi

if [[ ! -f "$DIST/index.html" ]]; then
    printf 'Building production bundle...\n'
    npm run build || fail "npm run build failed"
else
    printf 'Frontend already built — skipping (delete dist/ to force rebuild)\n'
fi

# ── Launch ────────────────────────────────────────────────────────────────────

step "Starting Local AI Chat Studio"
cd "$ROOT"
printf '  URL : http://127.0.0.1:8506\n'
printf '  Stop: Ctrl+C\n\n'

uv run chat-studio

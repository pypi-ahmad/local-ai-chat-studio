#!/usr/bin/env bash

set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
RUNTIME="$ROOT/.runtime/linux"
UV_DIR="$RUNTIME/uv"
UV="$UV_DIR/uv"
NODE_DIR="$RUNTIME/node"
NODE="$NODE_DIR/bin/node"
NPM="$NODE_DIR/bin/npm"
FRONTEND="$ROOT/frontend"
PYTHON_STATE_FILE="$RUNTIME/python-setup.sha256"
APP_URL="http://127.0.0.1:8506"
HEALTH_URL="$APP_URL/api/v1/health"
CHECK_ONLY=false
CLEANUP_PATHS=()

step() {
    printf '\n==> %s\n' "$1"
}

fail() {
    printf '\nLaunch failed: %s\n' "$1" >&2
    printf "Run \"bash 'Launch Chat Studio.sh' --check\" for a non-installing status report.\n" >&2
    exit 1
}

cleanup() {
    local path runtime_prefix
    runtime_prefix="$RUNTIME/"
    for path in "${CLEANUP_PATHS[@]:-}"; do
        if [[ -n "$path" && "$path" == "$runtime_prefix"* ]]; then
            rm -rf -- "$path"
        fi
    done
}
trap cleanup EXIT

case "${1:-}" in
    "") ;;
    --check) CHECK_ONLY=true ;;
    *) fail "Unknown argument: $1" ;;
esac
[[ $# -le 1 ]] || fail "Only --check is supported"

for required in pyproject.toml uv.lock frontend/package.json frontend/package-lock.json; do
    [[ -f "$ROOT/$required" ]] || fail "Required project file is missing: $required"
done

case "$(uname -m)" in
    x86_64|amd64) NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    *) fail "Unsupported Linux architecture: $(uname -m)" ;;
esac

if command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qi musl; then
    fail "Alpine/musl Linux is not supported; use a glibc-based distribution"
fi

if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget"
else
    DOWNLOADER=""
fi

download() {
    local url="$1" destination="$2"
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl --fail --location --silent --show-error "$url" --output "$destination"
    elif [[ "$DOWNLOADER" == "wget" ]]; then
        wget --quiet "$url" --output-document="$destination"
    else
        fail "curl or wget is required to download portable runtimes"
    fi
}

download_stdout() {
    local url="$1"
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl --fail --location --silent --show-error "$url"
    elif [[ "$DOWNLOADER" == "wget" ]]; then
        wget --quiet "$url" --output-document=-
    else
        fail "curl or wget is required to download portable runtimes"
    fi
}

sha256_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    else
        fail "sha256sum or shasum is required to verify downloads"
    fi
}

python_fingerprint() {
    printf '%s:%s' "$(sha256_file "$ROOT/pyproject.toml")" "$(sha256_file "$ROOT/uv.lock")"
}

python_ready() {
    [[ -x "$ROOT/.venv/bin/python" && -x "$ROOT/.venv/bin/chat-studio" && -f "$PYTHON_STATE_FILE" ]] || return 1
    [[ "$(tr -d '\r\n' < "$PYTHON_STATE_FILE")" == "$(python_fingerprint)" ]]
}

frontend_state() {
    FRONTEND_NEEDS_INSTALL=false
    FRONTEND_NEEDS_BUILD=false
    local installed_lock="$FRONTEND/node_modules/.package-lock.json"
    local dist="$FRONTEND/dist/index.html"

    if [[ ! -f "$installed_lock" || "$FRONTEND/package-lock.json" -nt "$installed_lock" ]]; then
        FRONTEND_NEEDS_INSTALL=true
    fi
    if [[ ! -f "$dist" ]]; then
        FRONTEND_NEEDS_BUILD=true
        return
    fi
    if [[ -n "$(find "$FRONTEND/src" -type f -newer "$dist" -print -quit)" ]] ||
       [[ "$FRONTEND/package.json" -nt "$dist" || "$FRONTEND/package-lock.json" -nt "$dist" ]] ||
       find "$FRONTEND" -maxdepth 1 -type f \( -name 'tsconfig*.json' -o -name 'vite.config.*' -o -name 'index.html' \) -newer "$dist" -print -quit | grep -q .; then
        FRONTEND_NEEDS_BUILD=true
    fi
}

app_healthy() {
    local response
    if [[ "$DOWNLOADER" == "curl" ]]; then
        response="$(curl --silent --fail --connect-timeout 1 --max-time 2 "$HEALTH_URL" 2>/dev/null || true)"
    elif [[ "$DOWNLOADER" == "wget" ]]; then
        response="$(wget --quiet --timeout=2 --tries=1 "$HEALTH_URL" --output-document=- 2>/dev/null || true)"
    else
        return 1
    fi
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<< "$response" &&
        grep -Eq '"version"[[:space:]]*:[[:space:]]*"?2"?' <<< "$response"
}

port_in_use() {
    if command -v timeout >/dev/null 2>&1; then
        timeout 1 bash -c '</dev/tcp/127.0.0.1/8506' >/dev/null 2>&1
    elif [[ "$DOWNLOADER" == "curl" ]]; then
        curl --silent --output /dev/null --connect-timeout 1 --max-time 1 "$APP_URL" 2>/dev/null
    else
        return 1
    fi
}

open_browser() {
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$APP_URL" >/dev/null 2>&1 &
    elif command -v gio >/dev/null 2>&1; then
        gio open "$APP_URL" >/dev/null 2>&1 &
    else
        printf 'Open %s in your browser.\n' "$APP_URL"
    fi
}

install_uv() {
    step "Installing portable uv"
    mkdir -p -- "$UV_DIR" "$RUNTIME/downloads"
    local installer="$RUNTIME/downloads/uv-installer.sh"
    CLEANUP_PATHS+=("$installer")
    download "https://astral.sh/uv/install.sh" "$installer"
    UV_UNMANAGED_INSTALL="$UV_DIR" UV_NO_MODIFY_PATH=1 sh "$installer"
    [[ -x "$UV" ]] || fail "uv installation did not create $UV"
}

install_node() {
    step "Installing portable Node.js LTS"
    [[ -n "$DOWNLOADER" ]] || fail "curl or wget is required to install Node.js"
    command -v tar >/dev/null 2>&1 || fail "tar with xz support is required to install Node.js"
    mkdir -p -- "$RUNTIME/downloads"

    local row version archive_name base_url archive checksums expected actual stage expanded
    row="$(download_stdout 'https://nodejs.org/dist/index.tab' | awk -F '\t' 'NR > 1 && $10 != "-" { print; exit }')"
    version="$(awk -F '\t' '{print $1}' <<< "$row")"
    [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Could not determine the current Node.js LTS version"
    archive_name="node-$version-linux-$NODE_ARCH.tar.xz"
    base_url="https://nodejs.org/dist/$version"
    archive="$RUNTIME/downloads/$archive_name"
    checksums="$RUNTIME/downloads/SHASUMS256-$version.txt"
    stage="$RUNTIME/node-install-$$"
    CLEANUP_PATHS+=("$archive" "$checksums" "$stage")

    download "$base_url/$archive_name" "$archive"
    download "$base_url/SHASUMS256.txt" "$checksums"
    expected="$(awk -v file="$archive_name" '$2 == file {print $1; exit}' "$checksums")"
    [[ -n "$expected" ]] || fail "Official checksum for $archive_name was not found"
    actual="$(sha256_file "$archive")"
    [[ "$actual" == "$expected" ]] || fail "Node.js archive checksum verification failed"

    mkdir -p -- "$stage"
    tar -xJf "$archive" -C "$stage"
    expanded="$stage/node-$version-linux-$NODE_ARCH"
    [[ -x "$expanded/bin/node" && -x "$expanded/bin/npm" ]] || fail "Node.js archive layout was not recognized"
    [[ ! -e "$NODE_DIR" ]] || fail "Partial Node.js installation exists at $NODE_DIR; remove it and retry"
    mv -- "$expanded" "$NODE_DIR"
    [[ -x "$NODE" && -x "$NPM" ]] || fail "Node.js installation is incomplete"
}

PYTHON_READY=false
python_ready && PYTHON_READY=true
frontend_state

if $CHECK_ONLY; then
    printf 'Local AI Chat Studio launcher check\n'
    printf 'Repository:       %s\n' "$ROOT"
    printf 'Linux target:     glibc %s\n' "$NODE_ARCH"
    printf 'Download tool:    %s\n' "${DOWNLOADER:-missing; install curl or wget}"
    printf 'Portable uv:      %s\n' "$([[ -x "$UV" ]] && printf ready || printf 'would install')"
    printf 'Portable Node:    %s\n' "$([[ -x "$NODE" ]] && printf ready || printf 'would install')"
    printf 'Python packages:  %s\n' "$($PYTHON_READY && printf ready || printf 'would install or update')"
    printf 'npm packages:     %s\n' "$($FRONTEND_NEEDS_INSTALL && printf 'would install' || printf ready)"
    printf 'Frontend build:   %s\n' "$($FRONTEND_NEEDS_BUILD && printf 'would build' || printf ready)"
    printf 'Ollama:           %s\n' "$(command -v ollama >/dev/null 2>&1 && printf available || printf 'optional; not installed')"
    if app_healthy; then
        printf 'Port 8506:        app already running\n'
    elif port_in_use; then
        printf 'Port 8506:        occupied by another process\n'
    else
        printf 'Port 8506:        available\n'
    fi
    exit 0
fi

[[ -n "$DOWNLOADER" ]] || fail "curl or wget is required to bootstrap the launcher"
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || fail "sha256sum or shasum is required"

if app_healthy; then
    printf 'Local AI Chat Studio is already running.\n'
    open_browser
    exit 0
fi
port_in_use && fail "Port 8506 is already used by another process"

mkdir -p -- "$RUNTIME"
[[ -x "$UV" ]] || install_uv
[[ -x "$NODE" ]] || install_node

export UV_PYTHON_INSTALL_DIR="$RUNTIME/python"
export UV_CACHE_DIR="$RUNTIME/uv-cache"
export UV_PROJECT_ENVIRONMENT="$ROOT/.venv"
export npm_config_cache="$RUNTIME/npm-cache"
export PATH="$NODE_DIR/bin:$UV_DIR:$PATH"

if ! $PYTHON_READY; then
    step "Installing Python dependencies"
    "$UV" sync --locked || fail "Python dependency installation failed"
    mkdir -p -- "$RUNTIME"
    python_fingerprint > "$PYTHON_STATE_FILE"
fi

frontend_state
if $FRONTEND_NEEDS_INSTALL || $FRONTEND_NEEDS_BUILD; then
    pushd "$FRONTEND" >/dev/null
    if $FRONTEND_NEEDS_INSTALL; then
        step "Installing frontend dependencies"
        "$NPM" ci --legacy-peer-deps --no-audit --no-fund || fail "Frontend dependency installation failed"
    fi
    if $FRONTEND_NEEDS_BUILD; then
        step "Building the frontend"
        "$NPM" run build || fail "Frontend build failed"
    fi
    popd >/dev/null
fi

if ! command -v ollama >/dev/null 2>&1; then
    printf '\nNote: Ollama is not installed. The app will still work with configured cloud providers.\n'
fi

(
    for _ in {1..150}; do
        if app_healthy; then
            open_browser
            exit 0
        fi
        sleep 0.4
    done
    printf 'The server did not become ready within 60 seconds. Open %s when it is available.\n' "$APP_URL" >&2
) &

step "Starting Local AI Chat Studio"
printf 'The browser will open at %s when the server is ready. Press Ctrl+C to stop.\n\n' "$APP_URL"
"$UV" run --no-sync chat-studio

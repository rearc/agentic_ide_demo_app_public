#!/usr/bin/env bash
# Project-scope setup for rearc/workshop-demo-kit.
#
# This kit is APM-native (per ADR-0016); `apm install` deploys the agents,
# instructions, skills, hooks, and MCP server registrations on its own. This
# sidecar copies the package content APM has no primitive for:
#   1. the bundled local random-tools-mcp server -> mcp-servers/random-tools-mcp/
#      (so the MCP command in apm.yml resolves project-relative), and
#   2. the Claude-specific showcase settings + status-line meter -> .claude/
#      (posture examples, sandbox profile, settings.example.jsonc, hooks
#      showcase, statusline.sh + the settings.json statusLine key).
#
# Consumer-invoked (per ADR-0013):
#   bash apm_modules/_local/rearc-workshop-demo-kit/scripts/setup.sh
#
# Idempotent — re-run is safe; existing files are left in place unless
# --update is passed.
#
# Per ADR-0020, this kit makes no companion-substrate recommendation; the
# kit's own hooks (audit + safety + lint) cover the workshop's safety needs.

set -uo pipefail

# --- Colors / logging --------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "  ${CYAN}[*]${NC} $*"; }
log_success() { echo -e "  ${GREEN}[+]${NC} $*"; }
log_warn()    { echo -e "  ${YELLOW}[!]${NC} $*"; }
log_error()   { echo -e "  ${RED}[x]${NC} $*" >&2; }

# --- Args --------------------------------------------------------------------

UPDATE=0
for arg in "$@"; do
  case "$arg" in
    --update) UPDATE=1 ;;
    -h|--help)
      cat <<EOF
Usage: bash scripts/setup.sh [--update]

  --update   Overwrite existing files in mcp-servers/random-tools-mcp/ and
             the deployed .claude/ showcase settings + statusline.sh.
             Without this flag, existing files are left untouched.
EOF
      exit 0
      ;;
    *)
      log_error "unknown arg: $arg"
      exit 1
      ;;
  esac
done

# --- Paths -------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(pwd)"

SRC_DIR="$KIT_ROOT/mcp-servers/random-tools-mcp"
DEST_DIR="$PROJECT_ROOT/mcp-servers/random-tools-mcp"

log_info "rearc/workshop-demo-kit setup — target: $PROJECT_ROOT"

if [[ ! -d "$SRC_DIR" ]]; then
  log_error "kit's random-tools-mcp source not found at: $SRC_DIR"
  log_error "  this is a packaging bug; report to the kit maintainer"
  exit 1
fi

# --- Dependency check --------------------------------------------------------

if ! command -v uv >/dev/null 2>&1; then
  log_warn "'uv' not found on PATH"
  log_warn "  the random-tools-mcp MCP server runs via 'uv run mcp-servers/random-tools-mcp/server.py'"
  log_warn "  install uv (https://docs.astral.sh/uv/) before invoking the MCP"
fi

# --- Deploy server source ----------------------------------------------------

mkdir -p "$DEST_DIR"

deploy_file() {
  local src="$1"
  local dest="$2"
  local name
  name="$(basename "$src")"

  if [[ -f "$dest" && $UPDATE -eq 0 ]]; then
    log_info "skipping $name (exists; pass --update to overwrite)"
    return
  fi
  cp "$src" "$dest"
  log_success "deployed mcp-servers/random-tools-mcp/$name"
}

deploy_file "$SRC_DIR/server.py"        "$DEST_DIR/server.py"
deploy_file "$SRC_DIR/requirements.txt" "$DEST_DIR/requirements.txt"

# --- Deploy Claude Code showcase settings + status line ----------------------
# Claude-specific reference/showcase artifacts: posture examples
# (settings.readonly / settings.strongerreadonly), the sandbox profile
# (settings.sandbox), the annotated settings.example.jsonc, the opt-in
# hooks showcase, and the status-line meter. APM has no settings/statusline
# primitive, so — like the MCP server above — they ship as package content and
# are copied here (ADR-0006 sidecar pattern; mirrors rearc/base's
# setup-statusline.sh). Claude-only; other harnesses have no equivalent.

CLAUDE_DIR="$PROJECT_ROOT/.claude"
mkdir -p "$CLAUDE_DIR"

deploy_into() {   # src, dest-dir, display-prefix
  local src="$1" destdir="$2" prefix="$3" name dest
  name="$(basename "$src")"
  dest="$destdir/$name"
  if [[ -f "$dest" && $UPDATE -eq 0 ]]; then
    log_info "skipping $name (exists; pass --update to overwrite)"
    return
  fi
  cp "$src" "$dest"
  log_success "deployed ${prefix}${name}"
}

for f in "$KIT_ROOT"/fragments/settings/*; do
  [[ -e "$f" ]] || continue
  deploy_into "$f" "$CLAUDE_DIR" ".claude/"
done

# Status line meter: copy the script, then register it in settings.json.
deploy_into "$KIT_ROOT/scripts/statusline.sh" "$CLAUDE_DIR" ".claude/"
chmod +x "$CLAUDE_DIR/statusline.sh" 2>/dev/null || true

SETTINGS="$CLAUDE_DIR/settings.json"
# Anchored to the project root so the status line survives a cd in the agent's shell.
STATUSLINE_JSON='{"type":"command","command":"\"${CLAUDE_PROJECT_DIR}/.claude/statusline.sh\""}'
if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  if [[ -f "$SETTINGS" ]]; then
    if jq --argjson sl "$STATUSLINE_JSON" '.statusLine = $sl' "$SETTINGS" >"$tmp" 2>/dev/null; then
      mv "$tmp" "$SETTINGS"
      log_success "registered statusLine in .claude/settings.json"
    else
      log_warn "could not parse .claude/settings.json; left it untouched"
      rm -f "$tmp"
    fi
  else
    printf '%s' "{\"statusLine\":$STATUSLINE_JSON}" | jq '.' >"$SETTINGS" \
      && log_success "created .claude/settings.json with statusLine"
  fi
else
  log_warn "jq not found — skipped statusLine registration in settings.json"
  log_warn "  add this key to .claude/settings.json manually:"
  log_warn '    "statusLine": { "type": "command", "command": ".claude/statusline.sh" }'
fi

log_success "rearc/workshop-demo-kit setup complete"
log_info "MCP server registered via apm.yml; restart your IDE to pick it up."
log_info "Showcase settings + status line deployed to .claude/ (Claude Code)."

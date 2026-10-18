#!/usr/bin/env bash
# =============================================================================
# auto-lint.sh - Claude Code PostToolUse hook on Edit and Write
#
# After Claude edits or writes a file, formats it with the project's tool:
# Prettier for JS, JSX, TS, TSX and CSS (the frontend's own install, via npx),
# Ruff for Python. Keeps style consistent without asking Claude to remember it.
#
# Wired in .claude/settings.json:
#   "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command",
#     "command": "\"${CLAUDE_PROJECT_DIR}/.claude/hooks/.../auto-lint.sh\"" }] }]
#
# Fails open and always exits 0: a convenience after the edit, never a blocker.
# A missing jq, formatter or file just means nothing is formatted.
# =============================================================================

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

FILE_PATH=$(jq -r '.tool_input.file_path // ""')
FILE_PATH="${FILE_PATH//\\//}"     # Windows sends backslash separators

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT=$(printf '%s' "${FILE_PATH##*.}" | tr '[:upper:]' '[:lower:]')

case "$EXT" in
  js|jsx|ts|tsx|css)
    # Run from the file's folder so npx finds the frontend's Prettier and .prettierrc.
    if command -v npx >/dev/null 2>&1; then
      ( cd "$(dirname "$FILE_PATH")" && npx --no-install prettier --write "$FILE_PATH" ) >/dev/null 2>&1 || true
    fi
    ;;
  py)
    if command -v ruff >/dev/null 2>&1; then
      ruff check --fix "$FILE_PATH" >/dev/null 2>&1 || true
    fi
    ;;
esac

exit 0

#!/usr/bin/env bash
# =============================================================================
# audit.sh - Claude Code PreToolUse hook on every tool: a passive audit trail
#
# Appends one JSON line per tool call to .claude/audit.log in the project
# (gitignored). Each line records when, which session, which tool, and what it
# touched: the command for Bash, the file path for file tools, the URL or query
# for web tools, the pattern for searches, the skill or subagent name for Skill
# and Agent calls. File contents, edit text and tool output are never logged,
# and obvious secrets in commands are masked.
#
# Wired in .claude/settings.json:
#   "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command",
#     "command": "\"${CLAUDE_PROJECT_DIR}/.claude/hooks/.../audit.sh\"" }] }]
#
# Read the trail:  tail -f .claude/audit.log
#                  jq -r '[.time, .tool, .target] | @tsv' .claude/audit.log
#
# Fails open and always exits 0: it observes and never blocks. Without jq it
# logs nothing.
# =============================================================================

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/audit.log"

# Mask values that look like secrets: key=value pairs for key, token, secret and
# password names, bearer tokens, and common key prefixes (sk-, ghp_, github_pat_, AKIA).
jq -c --arg time "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" '
  def mask:
    gsub("(?<k>(api[_-]?key|token|secret|password|passwd)[\"'"'"']?\\s*[=:]\\s*)[^\\s\"'"'"'&]+"; "\(.k)[REDACTED]"; "i")
    | gsub("(?i)bearer\\s+[A-Za-z0-9._~+/=-]+"; "Bearer [REDACTED]")
    | gsub("(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})"; "[REDACTED]");
  {
    time: $time,
    session: .session_id,
    tool: .tool_name,
    target: (
      .tool_input
      | (.command // .file_path // .notebook_path // .url // .query // .pattern // .skill // .subagent_type // .description // null)
      | if type == "string" then mask | .[0:500] else . end
    )
  }
' >> "$LOG" 2>/dev/null

exit 0

#!/usr/bin/env bash
# statusline.sh - Claude Code status line for the workshop demo app
#
# Renders, on one line: the model, context-window usage, subscription
# rate-limit usage (5-hour and weekly windows), and session cost. Reads the
# status line JSON that Claude Code pipes on stdin.
#
# Deployed by the kit's scripts/setup.sh, which copies it to
# .claude/statusline.sh and registers it in .claude/settings.json:
#   "statusLine": { "type": "command",
#                   "command": "\"${CLAUDE_PROJECT_DIR}/.claude/statusline.sh\"" }
#
# Requires: jq.

set -uo pipefail

input="$(cat)"

# Degrade quietly rather than erroring — a broken status line is worse noise.
if ! command -v jq >/dev/null 2>&1; then
  printf 'rearc/base | jq missing\n'
  exit 0
fi

field() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

model="$(field '.model.display_name // "claude"')"
ctx="$(field '.context_window.used_percentage // empty' | cut -d. -f1)"
h5="$(field '.rate_limits.five_hour.used_percentage // empty' | cut -d. -f1)"
wk="$(field '.rate_limits.seven_day.used_percentage // empty' | cut -d. -f1)"
cost="$(field '.cost.total_cost_usd // 0')"

out="[$model]"
[ -n "${ctx:-}" ] && out="$out | ctx ${ctx}%"
[ -n "${h5:-}" ]  && out="$out | 5h ${h5}%"   # populated after first API response (Pro/Max)
[ -n "${wk:-}" ]  && out="$out | wk ${wk}%"
out="$(printf '%s | $%.2f' "$out" "$cost")"
printf '%s\n' "$out"

#!/usr/bin/env bash
# =============================================================================
# guard-shell.sh - Claude Code PreToolUse hook on the Bash and PowerShell tools
#
# Blocks a short list of shell commands that destroy work with no undo:
#   rm with both recursive and force flags     (rm -rf, rm -r -f, rm --recursive --force)
#   PowerShell's and cmd's forms of the same   (Remove-Item -Recurse -Force and its
#                                               aliases ri, del, erase, rd, rmdir;
#                                               rd /s /q and del /s /q)
#   git push that forces                       (-f, --force, a +refspec; --force-with-lease is allowed)
#   git reset --hard
#   DROP TABLE / DROP DATABASE
#   seed.py --reset, and deleting app.db       (both wipe the user's cards, profiles
#                                               and todos; python, py, a venv's
#                                               python.exe or uv run, from any folder)
#
# Wired in .claude/settings.json:
#   "PreToolUse": [{ "matcher": "Bash|PowerShell", "hooks": [{ "type": "command",
#     "command": "\"${CLAUDE_PROJECT_DIR}/.claude/hooks/.../guard-shell.sh\"" }] }]
#
# How it reads a command: it splits the command line into separate commands
# (at ; & | && || newlines, ( ) and $( ), keeping quoted text together, then
# looks past wrappers (sudo, env, nohup, timeout, xargs, VAR=value) to the real
# command. It also checks the command inside bash -c / sh -c, powershell or
# pwsh -c / -Command, cmd /c, and find -exec. On Windows, Claude Code runs shell
# commands through its PowerShell tool by default; that tool sends the same
# tool_input.command, so one guard covers both.
# So `sudo rm -r -f /` is caught, while `echo "git reset --hard"` and
# `git commit -m "rm -rf old build"` are not.
#
# How it blocks: it prints a PreToolUse decision as JSON and exits 0. Claude
# sees the reason, which says what to do instead.
#
# Limits, on purpose: commands assembled at runtime (variables, eval,
# Invoke-Expression, -EncodedCommand, a script that deletes files, $( ) inside
# double quotes) are not inspected. This hook is
# one layer; the others are permission deny rules in .claude/settings.json (which
# also keep Claude's file tools and cat/head/tail away from .env) and /sandbox.
#
# Requires jq and bash 3.2 or later (macOS /bin/bash, Git Bash on Windows).
# =============================================================================

set -uo pipefail

# Fail closed: without jq this hook cannot read the command, so it blocks it.
# Exit code 2 blocks the tool call and shows stderr to Claude.
if ! command -v jq >/dev/null 2>&1; then
  echo "guard-shell hook: jq is not installed, so shell commands are blocked until it is. Install it (macOS: brew install jq; Windows: winget install jqlang.jq) and restart Claude Code." >&2
  exit 2
fi

# tr: jq.exe on Windows ends every line with CRLF, and a stray \r would hide a flag
# at the end of a line (git reset --hard\r) or a heredoc's end marker.
COMMAND=$(jq -r '.tool_input.command // ""' | tr -d '\r')
[ -z "$COMMAND" ] && exit 0

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# --- Split a command line into commands and words -----------------------------
# Fills SEGMENTS: one entry per command, its words joined by the \037 separator.

US=$'\037'
SEGMENTS=()
_word=""; _inword=0; _seg=""

_end_word() {
  if [ "$_inword" = 1 ]; then _seg="${_seg:+$_seg$US}$_word"; fi
  _word=""; _inword=0
}
_end_segment() {
  _end_word
  if [ -n "$_seg" ]; then SEGMENTS+=("$_seg"); fi
  _seg=""
}

# Runs of characters with no special meaning are taken in one step, which keeps
# long commands (a heredoc commit message) fast in bash 3.2.
RE_PLAIN=$'^[^\'"\\\\ \t\n;&|()`$<]+'
RE_SINGLE=$'^[^\']+'
RE_DOUBLE=$'^[^"\\\\]+'
RE_DELIM=$'^-?[\'"]?([A-Za-z0-9_]+)[\'"]?'

split_commands() {
  local s="$1" c quote="" re run delim line_rest body after
  SEGMENTS=()
  while [ -n "$s" ]; do
    case "$quote" in
      "'") re="$RE_SINGLE" ;;
      '"') re="$RE_DOUBLE" ;;
      *)   re="$RE_PLAIN" ;;
    esac
    if [[ $s =~ $re ]]; then
      run="${BASH_REMATCH[0]}"
      case "$run" in *$'\n'*) run=$(printf '%s' "$run" | tr '\n' ' ') ;; esac
      _word+="$run"; _inword=1                 # a multi-line quoted argument stays one word
      s="${s:${#run}}"
      continue
    fi
    c="${s:0:1}"; s="${s:1}"
    if [ -n "$quote" ]; then
      if [ "$c" = "$quote" ]; then quote=""
      else _word+="${s:0:1}"; s="${s:1}"; fi   # a backslash escape inside "..."
      continue
    fi
    case "$c" in
      "'"|'"') quote="$c"; _inword=1 ;;
      "\\")    _word+="${s:0:1}"; s="${s:1}"; _inword=1 ;;
      " "|$'\t') _end_word ;;
      ";"|"&"|"|"|$'\n'|"("|")"|'`') _end_segment ;;
      '$')
        if [ "${s:0:1}" = "(" ]; then _end_segment; s="${s:1}"
        else _word+="$c"; _inword=1; fi ;;
      "<")
        if [ "${s:0:1}" = "<" ] && [[ ${s:1} =~ $RE_DELIM ]]; then
          # A heredoc: its body is text, not commands. Skip to the line holding
          # only the delimiter; keep the rest of the first line (| sh, > file).
          delim="${BASH_REMATCH[1]}"
          s="${s:$((1 + ${#BASH_REMATCH[0]}))}"
          line_rest="${s%%$'\n'*}"
          body=$'\n'"${s#*$'\n'}"
          after="${body#*$'\n'"$delim"$'\n'}"
          [ "$after" = "$body" ] && after=""   # no delimiter line: the rest is body
          s="$line_rest"$'\n'"$after"
        else
          _end_word                            # a plain < redirect
        fi ;;
    esac
  done
  _end_segment
}

# A SQL client (or any other command) carrying DROP TABLE / DROP DATABASE.
deny_drop() {
  if printf '%s ' "$@" | grep -qE 'drop[[:space:]]+(table|database)\b'; then
    deny "Blocked by the repo's guard hook: DROP TABLE and DROP DATABASE destroy data permanently. Change the schema through an Alembic migration (see .claude/rules/migrations.md), or ask the user."
  fi
}

# Deleting the database file wipes the same data as seed.py --reset.
deny_app_db() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      *app.db) deny "Blocked by the repo's guard hook: deleting app.db destroys every card, profile and todo, and it cannot be undone. Ask the user; they can delete it themselves." ;;
    esac
  done
}

# --- Check one command, given as words ----------------------------------------
# Nested command strings (bash -c "...") are queued in PENDING for another pass.

PENDING=()

check_command() {
  local arg
  # Look past wrappers to the command that actually runs.
  while [ $# -gt 0 ]; do
    case "$1" in
      sudo|doas)
        shift
        while [ $# -gt 0 ] && [ "${1#-}" != "$1" ]; do
          case "$1" in -u|-g|-h|-p|-C|-D|-R|-T) shift ;; esac
          [ $# -gt 0 ] && shift
        done ;;
      env|nohup|time|command|exec|nice|caffeinate)
        shift
        while [ $# -gt 0 ] && [ "${1#-}" != "$1" ]; do shift; done ;;
      timeout)
        shift
        while [ $# -gt 0 ] && [ "${1#-}" != "$1" ]; do shift; done
        [ $# -gt 0 ] && shift ;;   # the duration
      xargs)
        shift
        while [ $# -gt 0 ] && [ "${1#-}" != "$1" ]; do
          case "$1" in -n|-i|-l|-p|-d|-s|-a|-e) shift ;; esac
          [ $# -gt 0 ] && shift
        done ;;
      *=*) shift ;;                  # VAR=value before the command
      *) break ;;
    esac
  done
  [ $# -eq 0 ] && return

  local cmd="${1##*/}"; shift          # /bin/rm counts as rm

  case "$cmd" in
    bash|sh|zsh|dash|ksh)
      # bash -c "<string>": queue the string; it is checked like a command line.
      while [ $# -gt 0 ]; do
        case "$1" in
          -*c*) [ $# -gt 1 ] && PENDING+=("$2"); return ;;
        esac
        shift
      done ;;

    powershell|powershell.exe|pwsh|pwsh.exe)
      # powershell -Command "<string>" (or -c): the rest of the line is the command.
      while [ $# -gt 0 ]; do
        case "$1" in
          -c|-co|-com|-comm|-comma|-comman|-command)
            shift; [ $# -gt 0 ] && PENDING+=("$*"); return ;;
        esac
        shift
      done ;;

    cmd|cmd.exe)
      # cmd /c "<string>" (or /k): the rest of the line is the command.
      while [ $# -gt 0 ]; do
        case "$1" in
          /c|/k) shift; [ $# -gt 0 ] && PENDING+=("$*"); return ;;
        esac
        shift
      done ;;

    remove-item|ri|del|erase|rd|rmdir)
      # PowerShell's Remove-Item and its aliases take -Recurse and -Force, which may
      # be shortened (-r, -fo); cmd's rd and del take /s and /q.
      deny_app_db "$@"
      local recurse=0 forced=0
      for arg in "$@"; do
        case "$arg" in
          -r|-re|-rec|-recu|-recur|-recurs|-recurse|-recurse:*|/s) recurse=1 ;;
          -fo|-for|-forc|-force|-force:*|/q) forced=1 ;;
        esac
      done
      if [ "$recurse" = 1 ] && [ "$forced" = 1 ]; then
        deny "Blocked by the repo's guard hook: Remove-Item with -Recurse and -Force (or rd /s /q, del /s /q) deletes a whole tree without asking, and it cannot be undone. Delete the specific files by name, or ask the user to run the recursive delete themselves."
      fi ;;

    find)
      # find ... -exec rm -rf {} + : check the command after -exec.
      while [ $# -gt 0 ]; do
        case "$1" in
          -exec|-execdir|-ok|-okdir)
            shift
            local inner=()
            while [ $# -gt 0 ] && [ "$1" != ";" ] && [ "$1" != "+" ]; do inner+=("$1"); shift; done
            [ ${#inner[@]} -gt 0 ] && check_command "${inner[@]}" ;;
        esac
        [ $# -gt 0 ] && shift
      done ;;

    rm)
      deny_app_db "$@"
      local recursive=0 force=0
      for arg in "$@"; do
        case "$arg" in
          --) break ;;
          --recursive) recursive=1 ;;
          --force) force=1 ;;
          --*) ;;
          -*)
            case "$arg" in *r*) recursive=1 ;; esac
            case "$arg" in *f*) force=1 ;; esac ;;
        esac
      done
      if [ "$recursive" = 1 ] && [ "$force" = 1 ]; then
        deny "Blocked by the repo's guard hook: rm with recursive and force flags deletes a whole tree without asking, and it cannot be undone. Delete the specific files by name, or ask the user to run the recursive delete themselves."
      fi ;;

    git)
      # Skip git's own options (-C <path>, -c <key=value>, --git-dir=...) to find the subcommand.
      while [ $# -gt 0 ] && [ "${1#-}" != "$1" ]; do
        case "$1" in -C|-c) shift ;; esac
        [ $# -gt 0 ] && shift
      done
      [ $# -eq 0 ] && return
      local sub="$1"; shift
      case "$sub" in
        push)
          for arg in "$@"; do
            case "$arg" in
              --force|-f|+*) ;;
              --*) continue ;;
              -*f*) ;;
              *) continue ;;
            esac
            deny "Blocked by the repo's guard hook: a force push rewrites the remote branch and can destroy other people's commits. Ask the user first; if they agree, use git push --force-with-lease, which refuses when the remote has moved."
          done ;;
        reset)
          for arg in "$@"; do
            if [ "$arg" = "--hard" ]; then
              deny "Blocked by the repo's guard hook: git reset --hard discards uncommitted work with no undo. Use git stash to set changes aside, git restore <file> for a single file, or ask the user."
            fi
          done ;;
      esac ;;

    echo|printf|grep|egrep|rg|cat|less|head|tail) ;;   # text in, text out: SQL in an argument is just text
    write-output|write-host|select-string|sls|get-content|gc|type|findstr) ;;   # the same, in PowerShell and cmd

    uv|uv.exe)
      # uv run [options] <command>: check the command it runs.
      [ "${1:-}" = run ] || return
      shift
      while [ $# -gt 0 ] && [ "${1#-}" != "$1" ]; do shift; done
      [ $# -gt 0 ] && check_command "$@" ;;

    py|py.exe|*python|*python3|*python3.[0-9]*|*python.exe|*python3.exe|seed.py)
      # Any python running seed.py with --reset (argparse also takes --res, --re, --r).
      # A Windows path such as .\venv\Scripts\python.exe arrives without its
      # backslashes, so the patterns match on the end of the name.
      local script=0
      [ "$cmd" = seed.py ] && script=1
      for arg in "$@"; do
        case "$arg" in
          *seed.py) script=1 ;;
          --r|--re|--res|--rese|--reset)
            [ "$script" = 1 ] && deny "Blocked by the repo's guard hook: seed.py --reset deletes every card, profile and todo, and it cannot be undone. Ask the user; they can run it themselves if they want the default board back." ;;
        esac
      done
      deny_drop "$@" ;;              # python -c "... DROP TABLE ..." is still SQL

    *)
      deny_drop "$@" ;;
  esac
}

# --- Main ----------------------------------------------------------------------

LOWER=$(printf '%s' "$COMMAND" | tr '[:upper:]' '[:lower:]')

# Very long commands (over 10,000 characters, outside heredocs and quotes) are
# slow to split in bash, so they get a quick pattern check over the whole text
# instead. It errs toward blocking: a match inside quoted text still blocks.
if [ ${#LOWER} -gt 10000 ] && ! printf '%s' "$LOWER" | grep -q '<<'; then
  if printf '%s' "$LOWER" | grep -qE '(^|[^a-z0-9_.-])rm[[:space:]]+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r[[:space:]]+-f|-f[[:space:]]+-r|--recursive[[:space:]]+--force|--force[[:space:]]+--recursive)' \
     || printf '%s' "$LOWER" | grep -qE 'git[[:space:]].*push[[:space:]].*(-f([[:space:]]|$)|--force([[:space:]]|$)|[[:space:]]\+[a-z0-9_./-]+)' \
     || printf '%s' "$LOWER" | grep -qE 'git[[:space:]].*reset[[:space:]].*--hard' \
     || printf '%s' "$LOWER" | grep -qE 'drop[[:space:]]+(table|database)' \
     || printf '%s' "$LOWER" | grep -qE 'seed\.py[^;&|]*[[:space:]]--r(e|es|ese|eset)?([[:space:]]|$)'; then
    deny "Blocked by the repo's guard hook: this very long command contains rm -rf, a force push, git reset --hard, DROP TABLE or seed.py --reset. Split it into smaller commands so each can be checked, or ask the user."
  fi
  exit 0
fi

PENDING=("$LOWER")
passes=0
while [ ${#PENDING[@]} -gt 0 ] && [ "$passes" -lt 5 ]; do
  line="${PENDING[0]}"
  PENDING=("${PENDING[@]:1}")
  passes=$((passes + 1))
  split_commands "$line"
  for seg in ${SEGMENTS[@]+"${SEGMENTS[@]}"}; do
    IFS="$US" read -r -a words <<< "$seg"
    check_command "${words[@]}"
  done
done

exit 0

# Claude Code - project instructions

@AGENTS.md

## Claude Code specifics

The instructions above are imported from `AGENTS.md`. Claude Code reads AGENTS.md on its own only when there is no CLAUDE.md, so this import is what loads it. Everything below is Claude Code specific.

- **Guardrails are enforced, not suggested.** This repo ships hooks (`.claude/hooks/`) that run deterministically: a `PreToolUse` guard blocks destructive shell commands (`rm -rf`, `git reset --hard`, `.env`/credentials reads). If a command is blocked, surface it - do not try to work around it.
- **Rules are path-scoped.** `.claude/rules/` holds coding conventions; the Tailwind rule loads only when you touch a React component in `frontend/src/`, the migrations rule only for the backend models and migrations, so they don't add noise elsewhere.

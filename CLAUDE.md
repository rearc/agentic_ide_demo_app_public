# Claude Code - project instructions

@AGENTS.md

## Claude Code specifics

The instructions above are imported from `AGENTS.md`. Claude Code reads AGENTS.md on its own only when there is no CLAUDE.md, so this import is what loads it. Everything below is Claude Code specific.

- **Guardrails are enforced, not suggested.** This repo ships hooks (`.claude/hooks/`) that run deterministically: a `PreToolUse` guard blocks shell commands that destroy work with no undo (`rm -rf`, force pushes, `git reset --hard`, `DROP TABLE`, `seed.py --reset` and deleting `app.db`), and permission deny rules in `.claude/settings.json` keep `.env` and `secrets/` out of reach. When something is blocked, tell the user what you were trying to do; the block message says what to do instead.
- **Rules are path-scoped.** `.claude/rules/` holds coding conventions; the Tailwind rule loads only when you touch a React component in `frontend/src/`, the migrations rule only for the backend models and migrations, so they don't add noise elsewhere.

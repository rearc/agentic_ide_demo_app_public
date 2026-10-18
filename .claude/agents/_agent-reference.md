---
# ─────────────────────────────────────────────────────────────────────────────
# SUBAGENT FRONTMATTER — REFERENCE CATALOG
# The analog of `_frontmatter-reference` (skills) and `settings.example.jsonc`.
# Open this file to see every field that customizes a `.claude/agents/*.md` subagent.
# NOTE: subagent frontmatter is camelCase (disallowedTools, permissionMode, maxTurns)
#       — NOT the hyphenated form skills use (allowed-tools, disable-model-invocation).
# ─────────────────────────────────────────────────────────────────────────────

# ── Active fields on THIS reference agent (kept minimal + inert) ──
name: _agent-reference                    # REQUIRED. Unique id, up to 256 chars, no `:`. Hooks see it as `agent_type`. Filename needn't match.
description: >-                            # REQUIRED. Drives auto-delegation. Written here to WAVE CLAUDE OFF —
  Reference catalog of every subagent frontmatter field. This is documentation to
  read, NOT a working agent. Never delegate tasks to this agent.
tools: Read                               # allowlist (comma-separated or YAML list). Omit = inherit every tool subagents get. Kept to Read so it's harmless.
model: inherit                            # sonnet | opus | haiku | fable | <full id> | inherit. Omit = the subagent model order picks.
color: cyan                               # task-list/transcript color: red blue green yellow purple orange pink cyan.

# ── The rest of the menu (commented so they don't activate) ──
# disallowedTools: mcp__github, Bash      # denylist: removed from the inherited or listed tools. `Bash(git push *)` removes ALL of Bash.
# permissionMode: plan                    # default | acceptEdits | auto | dontAsk | bypassPermissions | plan | manual(=default, 2.1.200+).
# maxTurns: 15                            # cap on agentic turns; at the cap its output comes back marked partial, and it can be resumed.
# effort: high                            # low | medium | high | xhigh | max (by model). Overrides session effort.
# autoCompactWindow: 200000               # compact this subagent's context earlier: 100000 to 1000000 tokens (2.1.296+).
# maxTurns/effort/model tune HOW HARD it runs; tools/disallowedTools/permissionMode tune WHAT it may touch.
#
# skills: [flask-api-conventions, commit-message]   # preload skills at startup — FULL skill content injected, not just the description.
# mcpServers: [random-tools]              # MCP servers this subagent may reach (names or inline defs). (ignored for plugin subagents)
# hooks: { PreToolUse: [...] }            # lifecycle hooks (PreToolUse/PostToolUse/Stop) scoped to THIS subagent only.
# memory: project                         # user (all projects) | project (via VCS) | local (this project, un-tracked). Persists across sessions.
# omitClaudeMd: true                      # start without user/project/local CLAUDE.md; for agents fed everything by the prompt (2.1.271+).
#
# background: true                        # stay in the background even when Claude asks for the foreground.
# isolation: worktree                     # run in an isolated git worktree instead of the main checkout.
# initialPrompt: "Start by reading AGENTS.md"   # auto-submitted first turn when this agent is the MAIN session (--agent / `agent` setting).
# experimental:
#   cacheTtl: 1h                          # prompt-cache lifetime for this subagent's requests: 5m | 1h (2.1.248+).
---

# Subagent frontmatter reference

Everything above is the full control surface for a subagent definition. This file is a
**take-home cheat sheet** — the subagent counterpart to the `_frontmatter-reference` skill.
It is deliberately inert: read it, don't delegate to it.

## The one big gotcha vs skills

Subagents and skills look similar but their frontmatter differs in two ways that bite people:

1. **Casing.** Subagents are **camelCase** (`disallowedTools`, `permissionMode`, `maxTurns`,
   `mcpServers`, `initialPrompt`). Skills are **hyphenated** (`allowed-tools`,
   `disable-model-invocation`, `when_to_use`). Copy-pasting a field from a skill into an
   agent (or vice-versa) silently fails.
2. **No invocation switch in the file.** Skills have `disable-model-invocation` /
   `user-invocable` to control *who* can call them. **Subagents have neither field.** Inside
   the file, the `description` is the steering lever (this file's says "not a working agent,
   never delegate to this"). The hard switch lives in settings: `"permissions": {"deny":
   ["Agent(_agent-reference)"]}` stops Claude from using a subagent at all.
3. **Typos fail silently.** Claude Code ignores a field it doesn't recognize. Run
   `claude --debug` and search the debug log for `does not recognize or apply` to find a
   misspelled field (2.1.296+).

## The fields, grouped

**Identity & routing**
- `name` (required) — lowercase-hyphen id; also the `agent_type` seen by hooks.
- `description` (required) — *how Claude decides to auto-delegate.* Add **"use proactively"**
  to encourage it; say what it is for, narrowly, to keep it out of other work. The on/off
  switch is a settings deny rule, `Agent(<name>)`, not a field.

**What it may touch** (mirrors the Permissions beat)
- `tools` — allowlist (comma-separated or YAML list, MCP patterns allowed). Omit = inherit
  every tool subagents get. Preload skills with `skills`, not by listing `Skill` here.
- `disallowedTools` — denylist, removed from what it inherits or lists. e.g. `mcp__*` blocks
  all MCP tools. An entry with a specifier (`Bash(git push *)`) still removes the whole tool.
- `permissionMode` — `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` /
  `plan` / `manual`. The same postures from the settings beat, scoped to one agent.

**How hard it runs**
- `model` — `sonnet`/`opus`/`haiku`/`fable`/full-id/`inherit`. Omitted: the subagent model
  order decides (`CLAUDE_CODE_SUBAGENT_MODEL` if set, otherwise the main conversation's).
- `effort` — `low`…`max`; overrides session effort.
- `maxTurns` — cap on agentic turns; the output comes back marked partial and can be resumed.
- `autoCompactWindow` — compact this subagent's context earlier (100000 to 1000000 tokens).

**What it composes with** (this is the "everything connects" part)
- `skills` — preload skills into the subagent at startup. **Full content is injected**, not
  just the description — so a subagent can start already knowing a convention.
- `mcpServers` — which MCP servers it can reach.
- `hooks` — PreToolUse/PostToolUse/Stop hooks scoped to *just this agent*.
- `memory` — `user` / `project` / `local`; persistent memory across sessions.
- `omitClaudeMd` — start without the CLAUDE.md files, for an agent whose prompt carries
  everything it needs (cheaper and more focused).

**Where & how it shows up**
- `background` — `true` keeps it in the background even when Claude asks for the foreground.
- `isolation` — `worktree` runs it in an isolated git worktree.
- `color` — display color in the task list / transcript.
- `initialPrompt` — auto-submitted first turn when this agent runs as the *main* session
  (via `--agent` or the `agent` setting), not when it's delegated to.
- `experimental.cacheTtl` — `5m` or `1h` prompt-cache lifetime for its requests; write it
  inside the `experimental` map, not at the top level.

## Built-in subagents (for contrast — you don't define these)

`Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup` and `claude-code-guide`
ship with Claude Code. `Explore` and `Plan` are read-only and start without your CLAUDE.md;
`general-purpose` has every tool and handles multi-step work; `claude` is the catch-all, and
the default agent for a background session. A project subagent with the same name as a
built-in (for example your own `Explore` with `model: haiku`) overrides it. Block one with
`"permissions": {"deny": ["Agent(Explore)"]}`.

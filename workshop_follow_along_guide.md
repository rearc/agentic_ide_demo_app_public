# Cursor Primitives - Participant Reference Guide

> **Being rewritten for Claude Code.** This guide still describes the Cursor version of the walkthrough (`.cursor/` paths, `.cursorignore`, Cursor hook events). For this repo's primitives, see `.claude/`, `AGENTS.md` and `CLAUDE.md`.

> **What this is:** A concise reference for everything covered in the Cursor primitives walkthrough. This repo ships with all primitives already built - we'll explore each one together. Use this guide to follow along and as a cheat sheet afterward.

---

## Setup

Create your own branch off `main`:

```bash
git checkout -b <your-name>/card
```

The `main` branch has all primitives pre-built plus a working Todo card - a full CRUD example (model, migration, backend service, API routes, React component) you can use as a reference when building your own card later.

---

## Cursor Primitive Inventory

Everything Cursor exposes for customization. All of these are already configured in this repo - open the files and explore.

### Core Primitives

| # | Primitive | What It Is | Where It Lives | How It's Triggered |
|---|-----------|-----------|---------------|-------------------|
| 1 | **Rules** | Persistent behavioral instructions injected into the agent's context | `.cursor/rules/*.mdc`, `AGENTS.md` | Always, glob-match, description-match, or manual (@) |
| 2 | **Skills** | Reusable workflow packages with steps, scripts, and reference docs | `.cursor/skills/*/SKILL.md` | Auto (agent decides) or `/skill-name` |
| 3 | **Subagents** | Isolated AI specialists with their own context window | `.cursor/agents/*.md` | Auto-delegated, `/agent-name`, or by name |
| 4 | **MCP Servers** | External tool integrations (APIs, databases, services) | `.cursor/mcp.json` | Auto (tools appear in agent's toolbox) |

### Supporting Primitives

| # | Primitive | What It Is | Where It Lives | How It's Triggered |
|---|-----------|-----------|---------------|-------------------|
| 5 | **Hooks** | Event-driven automation scripts that fire before/after agent actions | `.cursor/hooks.json` | 20+ events: sessionStart, preToolUse, postToolUse, afterFileEdit, etc. |
| 6 | **Ignore Files** | Controls what the AI can see and index | `.cursorignore`, `.cursorindexingignore` | Passive (always active, .gitignore syntax) |
| 7 | **Permissions** | Fine-grained control over what the agent can do | `~/.cursor/permissions.json`, `.cursor/cli.json` | Passive (always enforced) |
| 8 | **Modes** | Different interaction patterns with different tool access | Mode picker (Shift+Tab) | User selection |

### Good to Know About

| # | Primitive | What It Is |
|---|-----------|-----------|
| 9 | **Plugins** | Marketplace bundles of rules + skills + agents + MCP + hooks |
| 10 | **BugBot** | Automated PR review bot, configurable via `.cursor/BUGBOT.md` |
| 11 | **Cloud Agents** | Remote agents in isolated VMs, accessible from Slack/GitHub/API |
| 12 | **Custom Modes** | User-defined modes with specific tool combos and instructions (Beta) |

---

## @ Mentions - Manual Context Control

Type `@` in the chat to steer what the agent sees:

| @ Mention | What It Does |
|-----------|-------------|
| `@filename` (e.g. `@auth.ts`) | Include a specific file in context |
| `@folder/` (e.g. `@src/components/`) | Include an entire folder in context |
| `@symbol` (e.g. `@getUserById`) | Reference a specific function, class, or variable |
| `@docs` | Search indexed documentation |
| `@past chats` | Pull context from a previous conversation |

In Cursor 2.0, `@web`, `@git`, `@definitions`, and `@recent-changes` were removed because the agent now gathers that context automatically. The remaining @ mentions are for when YOU need to point the agent at something specific.

**Context window tip:** Cursor has no `/compact` command. When your conversation gets long and the agent starts losing track, start a new chat (Cmd+N). `@` reference the files you need and re-state what you're working on.

---

## Git Hygiene

The agent writes code. You own the commits.

- **Branch before you start.** Always work on a branch when the agent is making changes.
- **Review diffs before committing.** Every time the agent touches files, `git diff` before you commit.
- **Commit often.** Small, focused commits after each confirmed change. Don't let the agent run for 30 minutes and then try to untangle it.
- **You control git.** The agent can draft commit messages, but YOU run `git commit` manually.

---

## Ignore & Permissions

Already configured in this repo. Open `.cursorignore` to see what's blocked.

### `.cursorignore`
Blocks the AI from reading files. Uses `.gitignore` syntax.

**Important caveat:** `.cursorignore` blocks the AI's built-in file reading and indexing tools, but the agent can still access ignored files through the terminal (bash) tool or MCP servers. It is a guardrail, not a security boundary.

### `.cursorindexingignore`
Blocks indexing but allows explicit `@`-mention. Use for large generated files you don't want polluting search results.

### Key points
- Layer your safety: ignore files + permission modes + review discipline
- `.cursorignore` should NOT just mirror `.gitignore` - only ignore what's actually sensitive
- The real protection: don't put secrets where the agent can reach them, and review every tool call

---

## Rules

Already configured in this repo. Open `AGENTS.md` and `.cursor/rules/` to explore.

Rules are persistent behavioral instructions injected into the agent's context.

### Two layers
- **`AGENTS.md`** - Broad, cross-tool project instructions. Works in Cursor, Claude Code, Copilot, Windsurf, 20+ tools.
- **`.cursor/rules/*.mdc`** - Granular, conditional, Cursor-specific rules.

### Four triggering mechanisms

| Trigger | Frontmatter | When It Loads |
|---------|-------------|--------------|
| Always Apply | `alwaysApply: true` | Every conversation |
| Glob-matched | `globs: ["pattern"]` | When matching files are in context |
| Description-triggered | `description:` set, no globs | Agent decides based on relevance |
| Manual | None of the above | User types `@rule-name` |

### Rules in this repo

| Rule File | Trigger Type | What It Enforces |
|-----------|-------------|-----------------|
| `tailwind.mdc` | Glob-scoped (`*.jsx`, `*.tsx`) | Tailwind utility classes only, no custom CSS or inline styles |
| `api-conventions.mdc` | Always-apply | Consistent JSON envelope, proper HTTP status codes |
| `migrations.mdc` | Description-triggered | SQLAlchemy/Alembic migration best practices |
| `security-review.mdc` | Manual (via `@security-review`) | Security checklist: input validation, SQL injection, XSS, etc. |

### Key points
- Rules are **prompt-based guardrails** - the agent follows them because it's trained to, not because it's forced to
- Always-on rules cost tokens every conversation - keep them small and universal
- Rule hierarchy: Team Rules > Project Rules > User Rules
- Keep rules under 500 lines; split large ones into composable units
- Sharing is just git - commit your rules and every teammate who pulls gets the same agent behavior

---

## Skills

Skills are reusable workflow packages. They can contain instructions, scripts, and reference documents. This is the one primitive we'll build together during the workshop.

### Already in this repo

Open `.cursor/skills/` to explore these:

| Skill | What It Demonstrates |
|-------|---------------------|
| `coin-flip/` | Simplest possible skill. Pure markdown instructions, no code. |
| `coin-flip-code/` | Same concept but uses `scripts/flip.py`. Shows skills can contain runnable code. |
| `add-dashboard-card/` | Production-quality skill with multi-step workflow, verification steps, and reference docs. |

### Invocation
- **Auto:** Agent reads the skill's description and decides when it's relevant
- **Manual:** Type `/skill-name` in the chat
- **Lock to manual only:** Add `disable-model-invocation: true` to frontmatter

### Installing community skills

Browse: https://skills.sh

```bash
# Install a skill (interactive picker)
npx skills add anthropics/skills --skill frontend-design

# Remove a skill
npx skills remove --skill find-skills
```

**Always read what you install.** Quality ranges from production-grade (Anthropic's `frontend-design` with 7 reference files) to near-useless (Google's `gws-docs` which just runs `--help`). Open the SKILL.md and check.

### Token budget awareness

Skills are on-demand - they cost zero tokens until invoked. But once loaded, large skills can be expensive:

| Primitive type | When it loads | Token cost |
|---------------|--------------|------------|
| **Rule** (`.cursor/rules/`, `AGENTS.md`) | Always-on, every request | Constant drain |
| **Skill** (`.cursor/skills/`) | On-demand | Zero until invoked, potentially large when loaded |
| **MCP tool definitions** | Always-on (tool schemas) | Constant drain per connected server |

Use `disable-model-invocation: true` for large, specialized skills so YOU control when they load.

### Key points
- Skills are on-demand, not always loaded (unlike rules)
- Cross-platform: `.cursor/skills/`, `.agents/skills/`, `.claude/skills/` are all discovered
- Skills run in YOUR conversation and use YOUR context window (unlike agents)
- Don't install skills just to install skills - every primitive should earn its place

---

## Subagents

Already configured in this repo. Open `.cursor/agents/` to explore.

Agents are isolated AI specialists with their own context window.

### Key difference from skills
A skill runs in your conversation and uses your context window. An agent spawns a fresh context, does its work independently, and returns a summary. Your main conversation stays clean.

### Agents in this repo

| Agent | Mode | Key Frontmatter |
|-------|------|-----------------|
| `code-reviewer.md` | Foreground, read-only | `readonly: true`, `model: fast` |
| `research-assistant.md` | Background, read-only | `readonly: true`, `is_background: true` |

### Key frontmatter fields
- **`readonly: true`** - Agent can read and analyze but cannot edit files
- **`is_background: true`** - Runs without blocking; fire it off and keep working
- **`model: fast`** - Use the faster model for quick tasks
- **`description:`** - How the parent agent decides when to delegate

### Key points
- Agents get their own context window - this is the key difference from skills
- Single-level only: subagents cannot launch other subagents
- Agents inherit all parent tools (including MCP)
- Built-in agents: Explore, Bash, Browser

---

## Hooks

Already configured in this repo. Open `.cursor/hooks.json` and `scripts/` to explore.

Hooks are code that runs automatically when the agent does things. They can observe, automate, or block.

### Two use cases
1. **Automation** - Do something after X (e.g., auto-lint after file edit)
2. **Guardrails** - Block X from happening (e.g., block `rm -rf`)

### Exit codes
- **Exit 0** = allow the action
- **Exit 2** = deny the action
- **Other** = fail-open by default (`failClosed: true` changes this)

### Hooks in this repo

| Hook | Event | Purpose |
|------|-------|---------|
| Dangerous command blocker | `beforeShellExecution` | Blocks `rm -rf`, `DROP TABLE`, `git push --force`, etc. |
| Auto-lint on edit | `afterFileEdit` | Runs ESLint/Ruff on any file the agent edits |

### Key points
- Hooks are the **programmatic enforcement layer** - rules guide, hooks enforce
- 20+ event types: `preToolUse`, `postToolUse`, `afterFileEdit`, `beforeShellExecution`, `beforeSubmitPrompt`, `sessionStart`, etc.
- Two types: command-based (shell scripts) and prompt-based (LLM-evaluated)
- Priority: Enterprise > Team > Project > User

---

## MCP Servers

Already configured in this repo. Open `.cursor/mcp.json` to explore.

MCP (Model Context Protocol) servers give the agent entirely new tools.

### The trust spectrum (coin-flip comparison)

This repo has all three versions of a coin flip to illustrate the spectrum:

| Approach | How It Works | Trust Boundary |
|----------|-------------|---------------|
| Skill (basic) | LLM picks from token probabilities | None - the agent is guessing |
| Skill (with script) | Agent runs `scripts/flip.py` in its own shell | Agent executes it |
| MCP server | Agent calls a tool, server runs the code | Separate process, formal protocol boundary |

### MCP servers in this repo

```json
{
  "mcpServers": {
    "random-tools": {
      "command": "uv",
      "args": ["run", "--with", "mcp[cli]", "mcp-servers/random-tools-mcp/server.py"]
    },
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "type": "streamable-http"
    }
  }
}
```

Two servers, two patterns: custom-built local (coin-flip), remote hosted (Context7).

### Transport types

| Transport | Status | Use Case |
|-----------|--------|----------|
| **stdio** | Standard | Local servers - client spawns the process |
| **Streamable HTTP** | Modern standard | Remote/hosted servers |
| **SSE** | **Deprecated** | Legacy - still supported but avoid for new work |

### Where to find MCP servers
- Official MCP Registry: registry.modelcontextprotocol.io
- GitHub MCP Registry: github.com/mcp
- Cursor Marketplace: cursor.com/marketplace
- Community: glama.ai, pulsemcp.com, mcp.so, mcpservers.org

### Key points
- MCP is an open protocol - servers work across Cursor, Claude Code, Copilot, etc.
- Project-level (`.cursor/mcp.json`) vs. global (`~/.cursor/mcp.json`)
- Variable interpolation: `${env:NAME}`, `${workspaceFolder}`, `${userHome}`
- MCP servers are separate processes that can execute code, access networks, make API calls - permission controls matter
- MCP tool definitions are always-on in context (unlike skills) - be selective about which servers you connect

---

## Full Primitive Stack

| Layer | Primitive | Role | Where to Look in This Repo |
|-------|-----------|------|---------------------------|
| Safety | Ignore + Permissions | What the agent can't touch | `.cursorignore` |
| Always-on guidance | Rules (AGENTS.md, .mdc) | How we work here | `AGENTS.md`, `.cursor/rules/` |
| On-demand methodology | Skills | How to do X well | `.cursor/skills/` |
| Isolated specialists | Agents | Handle this independently | `.cursor/agents/` |
| Automation | Hooks | Do this automatically when... | `.cursor/hooks.json`, `scripts/` |
| New capabilities | MCP Servers | Now you can also do Y | `.cursor/mcp.json`, `mcp-servers/` |
| Interaction style | Modes | How much autonomy right now | Shift+Tab in Cursor |

---

## Build Your Own Card

Use the `add-dashboard-card` skill to scaffold a new card for the mission control dashboard. You can invoke it explicitly with `/add-dashboard-card` or just ask the agent to "add a new card to the dashboard" and it will auto-invoke.

The Todo card on this branch is your working reference for the full pattern.

### Card ideas

**External API Cards** - No API key required for any of these:

| Card | What It Does | API |
|------|-------------|-----|
| **Dad Joke** | Button to fetch a random dad joke. | icanhazdadjoke.com |
| **Trivia Challenge** | Multiple-choice trivia. Pick an answer, track score, load next. | Open Trivia DB |
| **GitHub Activity** | Recent commits or open PRs for a configurable repo. | GitHub public API |
| **IP / Network Info** | Public IP, ISP, city, country. | ipinfo.io or ip-api.com |
| **Hacker News Top Stories** | Top 5 stories with title, score, and link. | Hacker News API |

**Self-Contained Interactive Cards** - No external API needed:

| Card | What It Does |
|------|-------------|
| **Pomodoro Timer** | 25-min work timer + 5-min break with start/stop/reset. |
| **Tic-Tac-Toe** | 3x3 grid, play against a simple AI. |
| **Morse Code Translator** | Type text, see dots and dashes. Optional audio beeps. |
| **Speed Typing Test** | Random sentence, type it, measure WPM and accuracy. |
| **Mini Calculator** | Working calculator with number pad and basic operations. |
| **Launch Countdown** | Set a target date, see days/hours/minutes/seconds tick down. |
| **System Status** | CPU, memory, disk space, uptime. Auto-refreshes. |

**Picking guidance:**
- Want a guaranteed finish? **Dad Joke** or **Launch Countdown**
- Want to stretch? **Trivia Challenge** or **Pomodoro Timer**
- Want to impress the room? **System Status** or **GitHub Activity**
- Want to have fun? **Tic-Tac-Toe** or **Morse Code**

### You're not done when it works

Once your card runs and looks right, use the agent to explain what it changed. Open each file it touched. Ask it to walk you through the changes line by line. If something doesn't make sense, ask why. If you're skeptical of a claim, ask it to prove it.

If you can't explain what the agent did at a deep level - why it chose that pattern, how the state flows, what that hook does - then you don't own the code yet. Use the agent as a teacher. That's the full loop: **generate, verify, understand, own.**

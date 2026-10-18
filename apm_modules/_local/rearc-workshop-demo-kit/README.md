# rearc/workshop-demo-kit

The agentic-primitive layer backing the **Rearc workshop demo app** — a multi-card React + Flask dashboard used in workshops to demonstrate how Claude Code picks up project-scoped skills, agents, rules, hooks, and MCP servers, installed via [APM](https://microsoft.github.io/apm/).

This is an **APM-native kit** ([ADR-0016](../../ADR.md#adr-0016-external-installer-wrapper-kits-as-a-second-supported-kit-shape)). Rearc-authored content (3 agents, 3 instruction files, 9 skills, 3 hooks, 2 MCP server registrations + 1 bundled local MCP) lives under `.apm/`. Four upstream skills are pulled in at per-skill subpath granularity (per [ADR-0015](../../ADR.md#adr-0015-upstream-skills-are-declared-at-per-skill-subpath-granularity-not-whole-collection)).

## What it ships

### Rearc-authored

**Agents** (Claude Code subagents):

| Agent | What it does |
|---|---|
| `code-reviewer` | Reads code and returns structured findings against the project's security checklist, conventions, and quality rules. Does not modify files. |
| `research-assistant` | Investigates topics (API docs, library comparisons, architecture options) and returns concise summaries. Does not write code. |
| `_agent-reference` | Annotated catalog of all subagent frontmatter fields — a reference doc to read, not a working agent (the subagent analog of the `_frontmatter-reference` skill). |

**Instructions** (deployed as Claude Code rules in `.claude/rules/`; `applyTo` becomes `paths:`):

| Instruction file | What it covers |
|---|---|
| `api-conventions` | Flask API response shape + HTTP status code conventions |
| `migrations` | SQLAlchemy model changes + Alembic migration best practices |
| `tailwind` | Tailwind-first styling for React components, with the narrow cases for inline styles and `index.css` |

**Skills**:

| Skill | What it does |
|---|---|
| `add-dashboard-card` | Step-by-step workflow for adding a new card type (backend service, route, frontend component, registry, accent color, seed) |
| `coin-flip` | Random heads/tails via LLM's own choice |
| `coin-flip-code` | Heads/tails via Python script (pseudorandom) |
| `coin-flip-true-random` | Heads/tails via random.org atmospheric noise |
| `flip-until-heads` | Repeatedly invokes `coin-flip-true-random` until heads, with per-flip visibility |
| `commit-message` | Drafts a `Verb: Description` subject + body from staged diff, asks intent questions, never auto-commits |
| `security-checklist` | Security checklist for reviewing a change, trimmed to what applies to this app (validation, queries, rendering, secrets, logging), with reasons; preloaded into `code-reviewer` |
| `flask-api-conventions` | Backend conventions (service-layer shape, data-route wiring, config/secrets) — knowledge skill, auto-available on `backend/**` paths |
| `_frontmatter-reference` | Catalog of every skill frontmatter field and string substitution — the "show every control surface" reference skill |

**Hooks** (deployed via APM's hooks primitive into `.claude/settings.json`). One manifest per hook, `*-claude-hooks.json`; the scripts read Claude Code's hook payload and nothing else.

| Hook | Event and matcher | What it does |
|---|---|---|
| `audit` | `PreToolUse` `*` | Appends one JSON line per tool call to the project's `.claude/audit.log` (gitignore it): time, session, tool, and the command, path, URL or pattern it touched. Never logs file contents or edit text; masks obvious secrets. Always exits 0. |
| `safety` | `PreToolUse` `Bash` | `guard-shell.sh`: blocks `rm` with recursive and force flags, force pushes (`--force-with-lease` is allowed), `git reset --hard`, and `DROP TABLE` / `DROP DATABASE`. Splits the command line properly (quotes, `sudo`, `env`, `bash -c`, `find -exec`, heredocs) and denies with a `permissionDecision` whose reason says what to do instead. Fails closed without `jq`. Keep `.env` away from Claude with a `Read(.env)` permission deny rule, not this hook. |
| `lint` | `PostToolUse` `Edit\|Write` | Formats the edited file: Prettier (the project's own, via `npx --no-install`) for JS/TS/CSS, Ruff for Python. Always exits 0. |

`scripts/hooks/test-guard-shell.sh` runs the guard against a table of commands that must be blocked or allowed; run it after any change to the guard, and on each new platform (macOS bash 3.2, Git Bash on Windows).

**MCP server registrations** (deployed via APM's `mcp:` primitive):

| Name | Transport | What it provides |
|---|---|---|
| `context7` | HTTP (`https://mcp.context7.com/mcp`) | Documentation lookup — free tier, no auth |
| `random-tools` | stdio (`uv run mcp-servers/random-tools-mcp/server.py`) | Local demo MCP server — bundled in this kit; sidecar `setup.sh` copies it into the consumer project so the path resolves project-relative |

### Upstream skills (via APM per-skill subpath refs)

Four skills replacing the demo app's legacy `skills-lock.json` installer:

| Skill | Source |
|---|---|
| `frontend-design` | `anthropics/skills/skills/frontend-design` |
| `grill-me` | `mattpocock/skills/skills/productivity/grill-me` |
| `to-spec` | `mattpocock/skills/skills/engineering/to-spec` (was `write-a-prd`, then `to-prd`; Pocock renamed upstream) |
| `react-best-practices` | `vercel-labs/agent-skills/skills/react-best-practices` (was `vercel-react-best-practices` in the legacy lockfile — Vercel renamed upstream) |

Two of the four legacy names have drifted since `skills-lock.json` was last refreshed. This kit follows current upstream naming (per ADR-0015's per-skill addressing model).

## Prerequisites

- `apm` — https://microsoft.github.io/apm/getting-started/installation/
- `uv` — https://docs.astral.sh/uv/ (required at runtime for the bundled `random-tools` server)
- `jq` — required by the hook scripts (the safety hook blocks every shell command without it). macOS 15+ ships it; Windows: `winget install jqlang.jq`
- `python3` — required by the coin-flip-code skills
- `npx` (optional) — used by `auto-lint.sh` for Prettier on JS/TS/CSS edits
- `ruff` (optional) — used by `auto-lint.sh` for Python edits

## Install

From any project:

```bash
apm install -t claude rearc/ai-toolkit-private/packages/rearc-workshop-demo-kit
bash apm_modules/rearc/ai-toolkit-private/packages/rearc-workshop-demo-kit/scripts/setup.sh
```

The package installs from this repo's subpath — no clone, no marketplace required (see [enterprise-private-host.md](../../enterprise-private-host.md)). Pin the ref for reproducibility: append `#<tag-or-sha>` to the package ref.

During in-repo dev (against this monorepo's local-path dep form):

```bash
bash apm_modules/_local/rearc-workshop-demo-kit/scripts/setup.sh
```

> **Target Claude Code.** With more than one harness detected, `apm install` errors and asks you to choose. Pass `-t claude` (as above) or declare `targets: [claude]` in your `apm.yml`. Use APM 0.28.0 or later: earlier versions wrote hook commands as repo-relative paths, which break once the agent's shell leaves the repo root (microsoft/apm#2408).

`apm install` deploys the agents, instructions, skills, hooks, and MCP server registrations to the config dirs for your chosen targets. Skills land in `.claude/skills/`, agents in `.claude/agents/`, instructions in `.claude/rules/`, and hooks in `.claude/settings.json`. `setup.sh` then copies the bundled `random-tools` server source into `mcp-servers/random-tools-mcp/` in the consumer project so the stdio MCP command resolves to a stable project-relative path.

You'll see APM print `[!] N dependencies unpinned: <list> -- add #tag or #sha to prevent drift` on install. That's expected — the 4 upstream subpath refs are intentionally unpinned per [ADR-0024](../../ADR.md#adr-0024-rearcresearch-kit-upstream-deps-stay-unpinned-in-010-apm-0110-transitive-cleanup-on-uninstall-is-broken-under-pinning) because pinning breaks `apm uninstall` cleanup (re-validated against APM 0.18.0, todo.md item 15 — still broken; this kit ships its own content, so pinning would leak the deployed upstream skills on uninstall).

## Substrate posture

**No companion-substrate recommendation.** This kit ships its own audit, safety, and lint hooks tuned for the workshop demo app's workflows; layering `rearc/base` on top would duplicate the audit logging. Consumers who want the broader `rearc/base` posture can install it separately — the two layer cleanly modulo redundant audit calls.

`rearc/base-readonly` is a category mismatch: the demo app's workflow requires `npm`, `flask`, `python` execution, which the readonly substrate would block.

## Uninstall

```bash
apm uninstall rearc/ai-toolkit-private/packages/rearc-workshop-demo-kit
```

APM consults `apm.lock.yaml`'s `deployed_files` and removes only what was deployed by `apm install`. The bundled MCP server files at `mcp-servers/random-tools-mcp/` are project content (placed there by `setup.sh`) and are not tracked in `apm.lock.yaml` — remove them manually if desired:

```bash
rm -r mcp-servers/random-tools-mcp
```

The `.claude/audit.log` file is also not removed; delete it by hand.

## Layout

```
packages/rearc-workshop-demo-kit/
├── apm.yml                 # 4 upstream skill subpaths, 3 MCP servers, 1 dev setup script
├── README.md               # this file
├── .apm/                   # Rearc-authored APM primitives — deployed by `apm install`
│   ├── agents/             # code-reviewer, research-assistant, _agent-reference
│   ├── instructions/       # api-conventions, migrations, tailwind
│   ├── skills/             # add-dashboard-card, coin-flip(-code|-true-random), flip-until-heads, commit-message, flask-api-conventions, _frontmatter-reference
│   └── hooks/              # {audit,safety,lint}-claude-hooks.json
├── fragments/
│   └── settings/           # Claude showcase settings (readonly, strongerreadonly, sandbox, example.jsonc, hooks-showcase) — copied to .claude/ by setup.sh
├── scripts/                # bash sidecars (invoked via direct `bash` per ADR-0013)
│   ├── setup.sh            # deploys random-tools-mcp/ + .claude/ showcase settings + statusline into the consumer
│   ├── statusline.sh       # status-line meter (copied to .claude/statusline.sh + registered in settings.json by setup.sh)
│   └── hooks/              # audit.sh, guard-shell.sh, auto-lint.sh, test-guard-shell.sh
└── mcp-servers/
    └── random-tools-mcp/      # FastMCP-based demo server (server.py + requirements.txt) — coin_flip + roll_die
```

Nothing under `mcp-servers/` or `scripts/` is deployed by `apm install`; both directories are package-source content per [ADR-0017](../../ADR.md#adr-0017-sidecar-content-lives-at-package-root-not-under-dev). The hook scripts are referenced from `.apm/hooks/*.json` via `${CLAUDE_PLUGIN_ROOT}/scripts/hooks/...`, which APM rewrites to `${CLAUDE_PROJECT_DIR}/.claude/hooks/...` at install time.

## Maintainer notes

### Workshop-temporary status

This kit's primary purpose is backing the [`agentic_ide_demo_app`](https://github.com/rearc/agentic_ide_demo_app) (renamed from an earlier, single-tool name). It's not currently planned for publish. The four upstream skill subpaths are unpinned per ADR-0024; pre-publish (if that becomes a goal), pin every entry to a single SHA and rerun the harness.

### Drift watch on upstream skill names

Two of the four upstream skill paths reflect renames since the original `skills-lock.json` was authored:

- `vercel-react-best-practices` → `react-best-practices` (Vercel dropped the `vercel-` prefix)
- `write-a-prd` → `to-prd` → `to-spec` (Pocock renamed)

If the workshop materials reference the old names, update them. The current upstream names are what `apm install` will deploy.

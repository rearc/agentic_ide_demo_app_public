---
name: _frontmatter-reference
description: Teaching catalog of every SKILL.md frontmatter field and dynamic-injection token, with what each controls and why. Reference only — does not perform a task.
disable-model-invocation: true
user-invocable: true
argument-hint: "(reference only — no args)"
---

# SKILL.md frontmatter reference

A guided tour of every documented `SKILL.md` frontmatter field. This skill is **reference only**: it sets `disable-model-invocation: true` so Claude never loads it on its own (open the file, or type `/_frontmatter-reference`, to read it). Field set checked against the official docs (code.claude.com/docs/en/skills, Claude Code 2.1.302). "All fields are optional. Only `description` is recommended." A field name must match exactly, hyphens included: Claude Code ignores a field it doesn't recognize, without an error.

## Fields

| Field | What it controls | Why / when | Live example in this repo |
|---|---|---|---|
| `name` | The command name shown in the `/` menu and typed to invoke the skill. Defaults to the directory name; the directory name also invokes it. | Leave it out, or keep it equal to the folder name, so one skill has one name. | every skill |
| `description` | What the skill does and when to use it; Claude decides to load the skill from this. Combined with `when_to_use`, truncated at 1,536 characters in the listing, so put the key use case first. | Be specific: a vague description misses, a broad one fires too often. | every skill |
| `when_to_use` | Extra trigger phrases or example requests, appended to `description`. Counts toward the 1,536-character cap. | Sharpen auto-invocation without bloating `description`. | `add-dashboard-card`, `flask-api-conventions` |
| `argument-hint` | Autocomplete hint for expected arguments, e.g. `[slug] [source]`. | UX for `/skill` invocation. | `commit-message`, `add-dashboard-card` |
| `arguments` | Named positional arguments: `arguments: [slug, source]` makes `$slug` the first argument and `$source` the second. Space-separated string or YAML list. | Cleaner than picking `$ARGUMENTS` apart by hand. | `add-dashboard-card` |
| `disable-model-invocation` | `true` = only you can invoke it (Claude won't load it on its own); also keeps it from being preloaded into subagents or run by a scheduled task. Default `false`. | Workflows with side effects or timing you control: `/commit`, `/deploy`. | `commit-message`, this skill |
| `user-invocable` | `false` = hidden from the `/` menu and not run when you type `/name`; only Claude invokes it. Default `true`. | Background knowledge that isn't a user action, e.g. domain conventions. | `flask-api-conventions` |
| `allowed-tools` | Tools Claude may use **without a permission prompt** during the turn that invokes the skill; the grant clears when you send your next message. It does not restrict other tools: permission settings still govern them. Space- or comma-separated string, or YAML list. `${CLAUDE_SKILL_DIR}` works inside Bash rules here. | No prompts for a skill's known tool calls. | `coin-flip-code` (`Bash(python3 *)`), `commit-message` (`Bash(git ...)`) |
| `disallowed-tools` | Tools **removed** from Claude's pool while the skill is active; clears when you send your next message. | Autonomous loops that must never call a tool (the docs' example: `AskUserQuestion` in a background loop). | `flip-until-heads` |
| `model` | Model for the rest of the current turn (not saved; the session model resumes on your next prompt). Accepts `/model` values or `inherit`. With `context: fork`, it sets the forked subagent's model. | Pin a heavy skill to a stronger model, or a trivial one to a smaller model, without changing your session. | `coin-flip` (`sonnet`) |
| `effort` | Effort level while active (`low`, `medium`, `high`, `xhigh`, `max`; which ones exist depends on the model); overrides the session effort. | Pin a heavy workflow high, a trivial one low. | `add-dashboard-card` (`high`) |
| `context` | `fork` = run the skill in a forked subagent; the SKILL.md content becomes that subagent's prompt, without the conversation history. | Isolate verbose work; only a summary comes back. | `flip-until-heads` |
| `agent` | Which subagent type runs the fork when `context: fork` is set (e.g. `Explore`, `general-purpose`, or one of yours). | Match the fork to the job. | `flip-until-heads` |
| `background` | Only with `context: fork`. `false` = wait for the fork's result in the turn that invoked the skill; default `true` runs it in the background and the result arrives when it finishes. A background fork also gets the narrower tool set of background subagents. Claude Code 2.1.218+. | Set `false` when the next step needs the result, or the fork needs a tool background subagents lack. | (none yet) |
| `hooks` | Hooks registered when the skill is invoked; they keep running for the rest of the session (the `once` option fires one only once). | Enforce or observe around one workflow. | (none: reference only) |
| `paths` | Globs that limit when Claude loads the skill automatically: only when working with matching files. Comma-separated string or YAML list; same format as path-scoped rules. | Load knowledge only where it applies. | `flask-api-conventions` (`backend/**`) |
| `shell` | Shell for `` !`command` `` and ```` ```! ```` injection: `bash` (default) or `powershell` (needs the PowerShell tool, on by default on Windows without Git Bash). | Skills that inject live command output on Windows. | (none yet) |
| `metadata` | A free-form YAML map for your own tooling (catalog or entitlement fields). Claude Code doesn't act on it. Don't reuse field names such as `paths` as keys. | Data for your own scripts, carried in the skill. | `react-best-practices` |
| `license` | The license covering the skill (Agent Skills spec). Claude Code accepts it, doesn't act on it. | Published skills. | `frontend-design` |
| `compatibility` | Environment requirements, up to 500 characters (Agent Skills spec). Claude Code accepts it, doesn't act on it. | Say what a skill needs (a CLI, an OS). | (none yet) |

> **Outside Claude Code** (claude.ai uploads, the Skills API, `package_skill.py`), only six fields are allowed: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. Any other field fails the upload with "Unexpected key(s) in SKILL.md frontmatter". A skill meant for both places sticks to those six.
>
> **`model` vs `effort`:** `model` switches *which* Claude model runs the skill; `effort` tunes how much it thinks within that model. Both are temporary per-invocation overrides. `hooks`, `shell`, `background` and `compatibility` have no live example in this repo.

## String substitutions (in the body, filled in before Claude sees the skill)

| Token | Expands to |
|---|---|
| `$ARGUMENTS` | All argument text passed after `/skill`. If no placeholder uses it, Claude Code appends it as `ARGUMENTS: <value>`. |
| `$ARGUMENTS[N]`, `$N` | One argument by 0-based index: `$0` is the first. Quote multi-word values: `/skill "hello world" second`. |
| `$name` | A named argument from the `arguments` list. |
| `${CLAUDE_SKILL_DIR}` | The folder holding this SKILL.md: run bundled scripts from any working directory, e.g. `python3 ${CLAUDE_SKILL_DIR}/scripts/flip.py`. |
| `${CLAUDE_PROJECT_DIR}` | The project root, for project-local scripts regardless of where the skill is installed. |
| `${CLAUDE_SESSION_ID}` | The current session ID, for logs or session-specific files. |
| `${CLAUDE_EFFORT}` | The current effort level (`low` to `max`). |
| `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` | Plugin skills only: the plugin's install folder and its persistent data folder. |

Escape a literal `$` before a digit or argument name with a backslash: `\$1.00`.

## Dynamic context injection (runs before the skill loads)

| Syntax | What happens |
|---|---|
| `` !`command` `` | The command runs first and its output replaces the placeholder, so Claude receives the data, not the command. e.g. `` !`git diff --staged` `` in `commit-message`. |
| ```` ```! ```` fenced block | The same, for several commands: each line runs and its output is inserted. |

Settings can turn injection off (`"disableSkillShellExecution": true`), which is most useful in managed settings. Including `ultrathink` anywhere in a skill's content asks for deeper reasoning when it runs.

## Where to see them live

- **Invocation control:** `commit-message` (`disable-model-invocation`), `flask-api-conventions` (`user-invocable: false`).
- **Tool control:** `coin-flip-code` / `commit-message` (`allowed-tools`), `flip-until-heads` (`disallowed-tools`).
- **Arguments + injection:** `add-dashboard-card` (`arguments`/`$slug`), `commit-message` (`` !`git diff --staged` ``).
- **Subagent + effort + paths:** `flip-until-heads` (`context: fork` + `agent`), `add-dashboard-card` (`effort`), `flask-api-conventions` (`paths`).

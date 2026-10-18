---
name: commit-message
description: Helps craft a well-structured commit message from staged changes — inspects git diff, applies project conventions, asks about intent, and drafts subject + body before the user runs git commit.
argument-hint: "[optional focus or verb]"
disable-model-invocation: true
allowed-tools: Bash(git diff *), Bash(git status *), Bash(git log *)
---

# Commit message

Use this skill when the user wants help writing a **commit message** for work they are about to commit (or have staged). Do **not** run `git commit` for them unless they explicitly ask; the default outcome is a **draft** they can paste after approval.

## Staged changes at invocation (auto-injected)

The staged diff below is inlined when this skill runs, so you start with the current staged state already in hand:

!`git diff --staged --stat`

If a focus or verb was passed as an argument, bias the subject toward it: $ARGUMENTS.

## Workflow

### 1. Inspect what is staged

From the **repository root** (or the repo that contains `.git`), run:

```bash
git diff --staged
```

If there is **no staged output**, say so and suggest `git add` (or offer to draft from unstaged diff only if the user agrees — unstaged is not the default for this skill).

### 2. Analyze the diff

Summarize internally:

- **Which files** and areas (backend, frontend, docs, config) changed
- **What** was added, modified, or removed (features, fixes, refactors, deps, tests, docs)
- Whether the change is **one logical unit** or looks like multiple commits (say so if splitting would help)

Do not paste huge diffs into the chat unless the user needs them; refer to paths and high-level behavior.

### 3. Load project conventions

1. The project's instructions (`CLAUDE.md` and the `AGENTS.md` it imports) are already in your context; use any **commit message** or **changelog** convention they state, without reading them again. If they state none, there are no extra project rules beyond this skill.
2. Read **`references/commit_conventions.md`** (next to this skill) for the team’s **`Verb: Description`** subject format and body guidance.

Merge: **project-specific** wins if the project instructions ever conflict with the reference doc.

### 4. Ask clarifying questions (1–2)

Before drafting, ask **one or two** short questions focused on **intent** — **why** they made the change, constraints, or tradeoffs — not on re-stating the diff.

Examples:

- “What problem were you solving for users or deploys?”
- “Was this a deliberate behavior change or a straight refactor?”

Skip questions only if the user already explained intent in the same thread.

### 5. Draft the message

Produce:

- **Subject:** `Verb: Description` per `references/commit_conventions.md` — concise, imperative, matching the **primary** outcome of the staged change.
- **Body:** Blank line after the subject; explain **motivation and context** (the **why**). Avoid duplicating file-by-file “what” unless a short enumeration helps reviewers.

If multiple logical changes are staged, either draft **one** message for the combined state (subject reflects the main theme) or recommend **splitting** commits and offer a message per split.

### 6. Present and gate before `git commit`

Show the full proposed message in a single fenced block (easy to copy).

Then **ask explicitly** whether they **approve** the draft, want **edits** (and what to tweak), or prefer a **different verb/focus**. Remind them they should run **`git commit`** themselves once satisfied (unless they asked you to commit).

## Quick reference

- Staged review: `git diff --staged`
- Conventions: `references/commit_conventions.md` + the project instructions already in context
- Output shape: subject (`Verb: Description`) + optional body (why) + user approval before committing

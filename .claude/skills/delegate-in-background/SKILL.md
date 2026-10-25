---
name: delegate-in-background
description: Builds one delegated piece as a background subagent in its own git worktree, started from the attended thread; its report comes back to the attended thread. One step more automated than opening a delegated thread yourself.
argument-hint: "specs/<slug>/pieces/NN-<piece>.md"
disable-model-invocation: true
context: fork
agent: piece-builder
---

Build the delegated piece `$ARGUMENTS`, following `.claude/skills/delegated/SKILL.md` (read it first; it is your role) and `AGENTS.md`, with these differences, because you run in the background and nobody watches you:

- **Step 1:** you already run in a worktree made for you. Check with `git rev-parse --show-toplevel` that the path is under `.claude/worktrees/`; if it is not, stop and report that, without editing anything. Then run `node scripts/worktree-setup.mjs` from that root, as the role says.
- **Step 2:** write the plan into the piece spec's `## Status` and go straight on; there is nobody to wait for. Where the specs do not settle something, take the choice that keeps closest to them, and list it under "Departs from the spec" in the report.
- **Step 4:** your final message is the report itself, in the role's format, with the worktree's real path and branch. It is what the attended thread receives.

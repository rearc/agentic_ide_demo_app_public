---
name: delegate-in-background
description: Starts one delegated piece as a background subagent in its own git worktree, from the attended thread; its report comes back to the attended thread. One step more automated than opening a delegated thread yourself.
argument-hint: "specs/<slug>/pieces/NN-<piece>.md"
disable-model-invocation: true
---

Start the delegated piece `$ARGUMENTS` in the background, in its own worktree, and carry on with the person.

1. **Launch it** with the Agent tool: `subagent_type: "piece-builder"`, in the background, with the task below as its prompt (fill in the piece's path). `piece-builder`'s own file gives it a worktree.
2. **Record where it runs.** Its worktree gets a generated name, not the piece's: find it with `git worktree list` (`.claude/worktrees/agent-<id>`, branch `worktree-agent-<id>`). Put that in `plan.md` as the piece's worktree, through the usual state change.
3. **Carry on** with the together piece. Its report arrives in this conversation when it finishes, so keep this conversation (no `/clear`) until it has. Treat it as the report a delegated thread would have pasted, and take it at the next consolidation point.

The task to give it:

```
Build the delegated piece <path>, following .claude/skills/delegated/SKILL.md (read it first; it is your role) and AGENTS.md, with these differences, because you run in the background and nobody watches you:

- Step 1: you already run in a worktree made for you. Check with `git rev-parse --show-toplevel` that the path is under `.claude/worktrees/`; if it is not, stop and report that, without editing anything. Then run `node scripts/worktree-setup.mjs` from that root, as the role says.
- Step 2: write the plan into the piece spec's ## Status and go straight on; there is nobody to wait for. Where the specs do not settle something, take the choice that keeps closest to them, and list it under "Departs from the spec" in the report.
- Step 4: your final message is the report itself, in the role's format, with the worktree's real path and branch. It is what the attended thread receives.
```

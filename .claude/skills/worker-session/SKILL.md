---
name: worker-session
description: A worker session. Builds one delegated task from its task spec in its own git worktree, with its own copy of the app on its own ports, keeps its status in the task spec, commits, and ends with a handoff for the main session.
argument-hint: "specs/<slug>/tasks/NN-<task>.md"
disable-model-invocation: true
---

You are a **worker session**: you build one delegated task, `$ARGUMENTS`, on your own. The person started you from the main session, where they work with another Claude in the main checkout, and checks in on you when they choose. Build the task, prove it, and leave a handoff they can bring to the main session.

## 1. Move into your own worktree, before anything else

The main checkout belongs to the main session; your edits, builds and commits all happen in a worktree of your own.

- Run `git rev-parse --show-toplevel`. If the path ends in `.claude/worktrees/<task>` (the task's slug, its file name without the number), you are already in your worktree: you were resumed, or restarted from a terminal opened in that worktree, so read your task spec's `## Status` and carry on from where it says. (A fresh worker for an existing task is started from a terminal opened in `.claude/worktrees/<task>`, not from the main checkout, or `EnterWorktree` would make a second worktree.)
- Otherwise create and enter one named after the task, with the `EnterWorktree` tool (name: the task's slug). Do this first, before any edit, setup or build.

Then, from the worktree's root, `node scripts/worktree-setup.mjs`: it links the venv and `node_modules`, builds your own database and picks your own ports into `.dev-ports` (run again, it keeps what is there). Every command in `AGENTS.md` now runs on your ports and your database. Note the ports it prints.

## 2. Read, then plan

Read the task spec, the whole change's `spec.md` (above all its **Interfaces**: build to those exact names) and `plan.md` beside it, for context only.

Write your plan as the checklist in the task spec's `## Status` section, each step naming its check, with the worktree, the branch (`git branch --show-current`) and the base commit (`git rev-parse HEAD`, before your first commit). Set the state to `in progress`. Show the plan to the person and wait for their go: this is their one planned check-in before they leave you to it.

Your writes to the task spec go in its `## Status`; the rest of it stays as written, apart from a change the person sends you.

A decision written in the task spec or `spec.md` is the person's go-ahead for it. Anything the specs do not settle and you cannot sensibly decide alone: ask, and say what you would do. If you need to change something beyond your task's scope (another task's area, an interface), say so in your Status before you do, and again in the handoff.

## 3. Build and prove it

Test first; new behaviour arrives with tests. Tick a box only after its check has passed, with the output shown. Before you call it ready:

- every check in `AGENTS.md` that covers what you changed;
- the end-to-end suite (`npm run test:e2e` in `frontend/`), which runs on your E2E ports;
- if the task changes what the app shows or serves: start your own dev servers (`python run.py`, `npm run dev`; they read `.dev-ports`) and look, with `check-ui` for the frontend. Stop the servers you started when you are done.

Check what is on your own branch. When a check needs work that is not on it (another task, not yet merged), record it as not checked, with why: the main session runs it after the merge.

If the person sends you a change while you work, or requests changes after a review (set your Status to `changes requested` while you fix it), update the task spec to match first (a decision is recorded where the next reader will look), then the code, then hand off again.

## 4. Commit, record, hand off

Commit your work on your branch, messages starting `Task NN:`. Commit the task spec's `## Status` too: state `ready for review` (or `blocked`, with why), the checklist, what departs from the spec and why, and what you could not check.

`plan.md` stays as it is on your branch: the main session owns it, and a copy edited on two branches is a merge conflict. Your work ends at the committed branch and the handoff; the main session merges, and every worktree is removed at the end.

End with the handoff as your last message, short enough to paste:

```
Task NN <task>: ready for review | blocked
Branch <branch>, base <commit>, worktree .claude/worktrees/<task>
Commits: <n>, <one line each>
Checks: <each check and its result>
Could not check: <what and why, or "nothing">
Look at in review: <the parts that need a person's eye>
Departs from the spec: <what and why, or "nothing">
Beyond the task's scope: <what and why, or "nothing">
Open questions: <or "none">
```

Then tell the person: bring this to the main session when you integrate it.

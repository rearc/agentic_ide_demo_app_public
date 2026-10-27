---
name: decompose-to-specs
description: Task decomposition for a change too big for one session. Grills the person, then writes a spec and one task spec per task, each marked human-in-the-loop or delegated with what it depends on, and a plan. Ends at the committed breakdown.
argument-hint: "[what the change is, or specs/<slug>/]"
disable-model-invocation: true
---

You run the **task decomposition** for a change too big for one session. Your work ends when the breakdown is committed: you write files under `specs/<slug>/` and change nothing else. Work that a decision needs (finding options, research, trying something out) is a task of its own, planned like the rest, even when doing it now would get ahead. Whoever builds from the breakdown has the files, not this conversation, so everything they need goes in the files.

`specs/README.md` holds the file shapes ("When a change splits into tasks"). Read it first.

The change: $ARGUMENTS

## 1. Grill until the decisions are made

Use the `grilling` skill on the change, as for any spec. Add these branches to the design tree, because they decide the split:

- What has to exist before anything else can be built on it? Those are **dependencies**.
- Which parts need the person's judgement while they are built (taste, a design call, a trade-off that only shows once it runs)? Those are **human-in-the-loop** tasks.
- Which parts have acceptance criteria clear enough to build without the person? Those can be **delegated** tasks.
- What do two tasks share: a name, a data shape, an endpoint, a behaviour one of them relies on? Each shared thing is an **interface**. Fix it now, in `spec.md`, with the exact names, so both sides build to the same thing. If two tasks would change the same behaviour, one depends on the other.

Tasks that run in parallel may well touch the same files: each delegated task builds in its own worktree, and merge conflicts are resolved when it is integrated. Do not split by file to avoid them.

## 2. Write the spec

`specs/<slug>/spec.md` in the usual shape, with an **Interfaces** section listing every fixed name and shape.

## 3. Split the plan into tasks

Write one task spec per task in `specs/<slug>/tasks/NN-<task>.md` (a delegated task's slug is also its worktree's name and its worker session's name, so keep it short: lowercase, hyphens). Each has the spec shape, its **Mode**, what it **depends on**, its interfaces, and an empty `## Status` section.

Then `specs/<slug>/plan.md`: the `## Status` section (**Resume here**, the tasks with their states, all `not started`) and, for each delegated task, what runs when it is integrated. Order the tasks so that:

- delegated tasks run in parallel with human-in-the-loop tasks, not after them;
- a task is unblocked once everything it depends on is done or merged, and tasks that do not depend on each other can run in parallel;
- the last integration runs every check in `AGENTS.md`, the end-to-end suite and `check-ui`.

## 4. Check it with the person, then commit

Show the person the breakdown as a short table (task, mode, depends on, runs in parallel with) and ask what to change. When they agree:

- if you are on `main`, create the change's branch first (`git switch -c <slug>`);
- commit the spec, the task specs and the plan in one commit, message `Plan: <slug> split into tasks`.

## 5. Done

Tell the person the breakdown is ready: where it is and what it holds, in a few lines. That is the end of your work.

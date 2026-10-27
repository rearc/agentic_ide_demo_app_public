# Specs

One folder per change, `specs/<slug>/`, where `<slug>` is the change's short name in lowercase with hyphens (for example `specs/air-quality-card/`).

## spec.md: what we're building, and how we know it's done

Written before the build and checked against after it. A spec holds:

- the problem, in the user's terms
- the decisions made, with the reason for each (including the design chosen, if there was one)
- acceptance criteria a test or a check can prove, each naming its check
- what is in scope and what is out
- the parts of the app it touches
- open questions, if any are still waiting on the person

The person decides what goes in it; changing it is a decision, not a build step. When the spec and a plan disagree, the spec wins.

## plan.md: how to build it

Added when the build runs over more than one session. It is the approved Plan Mode plan, planned from the spec, saved beside it. Plan Mode's own copy in `plans/` is a draft; `plan.md` is the record.

`plan.md` has a `## Status` section near the top, so a fresh session or a compaction can pick the work up from this folder and `git log` alone:

- **Resume here:** where the work stands, what comes next and how (for example test-first, from the first unticked box), and what not to reopen without asking
- **A checklist** of the build's steps, each naming its check. Tick a box only after its check has passed, with the output shown. Saving the plan here is not one of the steps, so it gets no box.

Below the Status: the files that change, the order of the work, the risks, and what proves it done. When the build departs from the plan, update `plan.md` in the same commit.

A small change whose build fits in one session needs only `spec.md`.

## When a change splits into tasks

A change too big for one session splits into **tasks**, worked by more than one session at once. Three skills carry the roles: `decompose-to-specs` writes the breakdown, `main-session` coordinates the work and builds the human-in-the-loop tasks with the person in the main checkout, and `worker-session` builds one delegated task in its own worktree.

```
specs/<slug>/
  spec.md                 the whole change, as above, with an Interfaces section
  plan.md                 the state of the whole: Status, tasks, what runs at each integration
  tasks/
    01-<task>.md          one small spec per task
    02-<task>.md
```

**A task spec** has the spec shape above (problem, decisions, acceptance criteria that each name their check, scope, parts touched), plus:

- **Mode:** `human-in-the-loop` (built in the main session, with the person) or `delegated` (built in its own worker session and worktree, the person checking in)
- **Depends on:** the tasks that must be done or merged before it can start; it is **unblocked** once they are
- **Interfaces:** what it shares with other tasks (names, data shapes, behaviour), each fixed in `spec.md` so both sides build to the same thing
- **A `## Status` section**, written only by the session building the task: its state (`not started`, `in progress`, `ready for review`, `blocked`, `changes requested`), its checklist (ticked only after the check passed), and for a delegated task its worktree, branch and base commit

**`plan.md`** keeps its `## Status` section and **Resume here**, and adds:

- **Tasks:** one line each: number, name, mode, depends on, state (`not started`, `in progress`, `worker running`, `changes requested`, `merged`, `done`, `dropped`), and for a delegated task its worktree
- **Integration:** for each delegated task, what is reviewed, merged and run when it is integrated; the last runs every check

When changes are requested, the main session marks it in `plan.md` and the worker marks its own Status as it picks the request up. Only the main session writes `plan.md`, and it commits state changes on their own, with messages that start `State:`, so `git log -p -- specs/<slug>/plan.md` shows how the work moved. A worker session never edits `plan.md`, not even its own copy: its state lives in its task spec, and a copy edited on two branches is a merge conflict. Tasks running in parallel may touch the same files; merge conflicts are normal and resolved when a task is integrated.

**Words the skills use**, beyond those above:

- **Main session:** the long-running session in the main checkout, started with `/main-session`. It coordinates (starting workers, integrating their handoffs, keeping `plan.md`) and builds the human-in-the-loop tasks with the person. Named after its task with `-main`, for example `theme-tokens-main`.
- **Worker session** (a **worker**): started with `/worker-session`, it builds one delegated task in its own worktree, on its own ports and database. Named after its task.
- **Handoff:** a worker's last message: its branch, commits, checks, what it could not check, and what to look at. The person brings it to the main session.
- **Review summary:** what the main session writes after reading a worker's branch: what it did, the decisions it made alone, where it disagrees with the handoff, anything beyond its scope, what could not be checked, and what to look at.
- **Integrate:** review a worker's branch, merge it and run the checks, one handoff at a time.
- **Request changes:** send a worker back with what to fix and why; the task becomes `changes requested`.
- **Iteration:** one human-in-the-loop task worked to done, with the handoffs that arrived meanwhile integrated. Running workers carry over to the next.

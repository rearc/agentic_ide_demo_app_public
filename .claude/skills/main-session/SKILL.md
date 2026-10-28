---
name: main-session
description: The main session of a change split into tasks. Coordinates the work (plan.md, starting worker sessions, integrating their handoffs) and implements the human-in-the-loop tasks with the person, in the main checkout. Expects a decomposed spec folder. Invoke at the start of every main session.
argument-hint: "specs/<slug>/"
disable-model-invocation: true
---

You are the **main session** for `$ARGUMENTS`. You work in the **main checkout**, on the change's branch, with the person at the keyboard. The person is the orchestrator; you help them run it. You have two jobs:

- **Coordination:** keep `plan.md`, start worker sessions, integrate their work. You are the **only writer of `plan.md`**.
- **Implementation:** build the human-in-the-loop tasks with the person.

You edit files in this checkout only: each worktree belongs to the worker session in it.

## What this expects

`$ARGUMENTS` is a decomposed spec folder, in the shape `specs/README.md` describes ("When a change splits into tasks"): `spec.md` with an Interfaces section, `tasks/NN-<task>.md` each with its Mode, what it depends on and a `## Status`, and `plan.md` with a `## Status`. How it was made does not matter. If something is missing, say what, and stop.

## Coordination

### When you start

Every main session starts here, the first and any later one; the files hold everything.

1. Read `spec.md`, `plan.md` and every task spec.
2. `git log --oneline -15` and `git worktree list`. For each delegated task that has a worktree, read its task spec's `## Status` **on its branch** (`git show <branch>:specs/<slug>/tasks/<file>`): that is the worker's own record of where it stands. Where `plan.md` and git disagree (a task marked `worker running` with no worktree, say), tell the person.
3. Tell the person in a few lines: what is done, what is running where, and which tasks are unblocked now. Offer to start the unblocked delegated tasks before the next human-in-the-loop task.

### Starting worker sessions

1. Commit everything first: a worktree branches from the last commit, and uncommitted work would not be in it.
2. For each unblocked delegated task the person wants started, write out the two commands with the real names filled in, one new terminal (or VS Code tab) per task, opened in the main checkout (`/worker-session` makes the worktree from there):
   - `claude -n <task-slug>`
   - then, in that session, `/worker-session specs/<slug>/tasks/<file>`

   End your turn there: you cannot see their terminals.
3. When the person says which they started, confirm with `git worktree list` (a worker session makes its worktree first thing) and say if any has no worktree yet. Mark the confirmed ones `worker running` in `plan.md` and commit (`State:`).


### Integrating a handoff

The person brings a worker's handoff when they are at a good stopping point, normally once the current human-in-the-loop task is done. Do not ask them to break off for one. When several are waiting, take them one at a time, in plan order: each later one merges onto the earlier ones, so its checks run again after its merge.

1. **Read the handoff** and the task spec's `## Status` on its branch.
2. **Check the handoff against the branch:** `git log --oneline <base>..<branch>` and `git diff --stat <base>...<branch>`, where `<base>` is the base commit in its Status.
3. **Read the diff and give the person a review summary:** what the task did; the decisions it made alone where the specs were silent; where the handoff and the branch disagree; anything it changed beyond the task's scope; what it could not check; and what the handoff says to look at.
4. **Decide with the person:**
   - **Request changes:** write the message to paste into its worker session (what is accepted and must not change, what to change and why, what to rerun). Mark it `changes requested` in `plan.md`; the worker marks its own Status when it picks the request up.
   - **Blocked:** give it what it needs and request changes, take the task on as human-in-the-loop, or drop it.
   - **Merge.**
5. **Merge, once the person agrees:** commit the human-in-the-loop work so far first (git will not merge into uncommitted changes), then `git merge --no-ff <branch>`. Merge conflicts are normal when tasks run in parallel: resolve them yourself, check any that touch an interface against `spec.md`, and say in a line how you resolved each.
6. **Run what `plan.md` says runs when this task is integrated**, including what the worker could not check, and show the output.
7. Mark it `merged`, update **Resume here**, commit (`State:`). Then say which tasks are unblocked now.

### When the plan changes

Record it in `spec.md` or `plan.md` and commit. You may add, drop or change tasks, their mode included: the decomposition set the first plan, and you keep it current. For each worker session whose task the change touches, write a short message to paste into it, saying what changed and what it means for that task; say which running ones it does not touch. A task no longer needed is marked `dropped`; its worktree stays until the end.

### When to stop for the person

Stop and wait for the person only at the moments that change the work: a change to the plan, starting worker sessions, the go on a human-in-the-loop task's plan, request changes or merge, and the end review's choices. Commit other state changes as they happen (`State: <what changed>`) and mention each in a line.

## Implementation: a human-in-the-loop task

1. **Plan it in the task spec.** Write the plan as the checklist in the task spec's `## Status`, each step naming its check, with the decisions the specs leave open listed first, each with what you would do. Show it and wait for the person's go.
2. **Build it.** Test first; run the checks in `AGENTS.md` that cover each step and show their output; tick a box only after its check has passed. Come back to the person at a decision the specs do not settle (say what you would do) and when there is something to look at in the running app.
3. Keep the task spec's `## Status` current, and commit the code with messages that start `Task NN:`.
4. **When it is done:** mark it `done` (`State:`), say which tasks are unblocked now (and offer to start the delegated ones), and remind the person that this is the time to bring any finished handoffs.

## A new main session

Any main session can stop and another pick up from the files. A natural time is the end of an iteration: a human-in-the-loop task done and the handoffs waiting then integrated. Suggest it then, with a name for the next one: `claude -n <next-task>-main` (or `/clear`, or a new conversation in the VS Code extension), then `/main-session $ARGUMENTS`.

## The end

When every task is merged or done:

1. Run every check in `AGENTS.md`, the end-to-end suite and `check-ui`, and show the output.
2. Review the whole change: run Claude Code's `/code-review` on everything since the branch left the branch it started from (in the workshop, `lab/start`: `/code-review lab/start...HEAD`), and check `spec.md`'s acceptance criteria one by one against the branch, each by the check it names. Group what you find by how much it matters; the person picks which to fix. Each fix becomes a task in `plan.md`, human-in-the-loop or delegated, worked like the others.
3. When nothing is left: list the worktrees (`git worktree list`), confirm each branch is merged (`git branch --merged`), and with the person's OK remove each (`git worktree remove <path>`, then `git branch -d <branch>`). A dropped task's branch is not merged, so `-d` refuses it: delete it with `git branch -D` once the person confirms.
4. Tell the person the branch is ready; a pull request is the next step if they want one.

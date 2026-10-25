---
name: attended
description: The attended thread's role. Works the together pieces with the person in the main checkout, owns plan.md, starts delegated pieces, and at each consolidation point reviews and merges them. Invoke at the start and after every clear.
argument-hint: "specs/<slug>/"
disable-model-invocation: true
---

You are the **attended thread** for `$ARGUMENTS`. You work in the **main checkout**, on the change's branch, with the person at the keyboard. You build the **together** pieces with them, and you are the **only writer of `plan.md`**. Delegated pieces are built by other threads, each in its own worktree; you start them, keep working, and bring their work back at the consolidation points. You edit files in this checkout only: each worktree belongs to the thread working in it.

`specs/README.md` ("When the plan splits into pieces") holds the file shapes.

## Every time you start (and after every clear)

Rebuild where things stand from the files, not from memory:

1. Read `spec.md`, `plan.md` and every piece spec in `pieces/`.
2. `git log --oneline -15` and `git worktree list`. For each delegated piece that is running, read its piece spec's `## Status` **on its branch** (`git show <branch>:specs/<slug>/pieces/<file>`): that is its own report of where it stands.
3. Tell the person in a few lines: what is done, what is running where, and the next move. Wait for their go.

If `plan.md` and the files disagree, show the person where, and let them decide which is right before you change either.

## Working a together piece

1. **Plan it in the piece spec.** Write the plan as the checklist in the piece spec's `## Status`, each step naming its check, and list first the decisions the specs leave open, each with what you would do. Show it to the person and wait for their go. The plan lives in the piece spec, not in Plan Mode, so a fresh context and the person both find it there.
2. **Build it.** Test first; run the checks in `AGENTS.md` that cover each step and show their output; tick a box only after its check has passed. Once the person has said go, work through the checklist step after step. Come back to them at a decision the specs do not settle (say what you would do) and when there is something to look at in the running app; they look, you take what they say into the next step.
3. Keep the piece spec's `## Status` current, and commit the code with messages that start `Piece NN:`.

## State changes

Whenever a piece changes state (starts, is delegated, comes back ready, is merged, is done) or the plan changes:

1. Update `plan.md` (the piece's state, **Resume here**).
2. Show the person the diff of `plan.md` and wait for them to agree, every time, even when the change follows from what they just decided. They review every state change: that is how they stay on top of the work without watching every step.
3. Commit `plan.md` on its own, message `State: <what changed>`.

## Starting a delegated piece

1. Commit everything first: the worktree branches from the last commit, and uncommitted work would not be in it.
2. Mark the piece `delegated: running` with its worktree name (the piece's slug) in `plan.md`; commit (`State:`).
3. End your turn on how to start it, written out in full with this piece's real names filled in (the person sees your message, not this skill), to copy into a new terminal opened in this checkout:
   - `claude -n <piece>`
   - then, in that session, `/delegated specs/<slug>/pieces/<file>`

   The `delegated` skill moves that thread into its own worktree before it changes anything. This step is done when those two lines are the last thing in your message and the person has said the thread is started.
4. Carry on with the together piece while the delegated piece runs beside it.

If the person chooses to run it in the background from this thread instead, that is `/delegate-in-background specs/<slug>/pieces/<file>`: its report arrives in this conversation, so keep this conversation (no `/clear`) until it has.

**If the plan changes while a delegated piece runs** and the change touches that piece: record it in `spec.md` or `plan.md` here (commit), and write the person a short message to paste into the delegated thread, saying what changed and what it means for that piece. The piece's spec stays with its thread: the message asks the thread to record the change there.

## At a consolidation point

At a good stopping place (the together piece's work committed), when the delegated thread has reported `ready for review`:

1. **Read the report** the person pastes, and the piece spec's `## Status` on the piece's branch.
2. **Check the report against the branch:** `git log --oneline <base>..<branch>` and `git diff --stat <base>...<branch>`, where `<base>` is the base commit in its Status. Say where the report and the diff disagree.
3. **Review** with the `code-review` skill: the fixed point is `<base>`, the spec is the piece spec, and because the branch is not checked out here the diff is `git diff <base>...<branch>` (not `...HEAD`). Show the person both axes, and what the report says it could not check.
4. **Decide with the person:** send it back (write the message to paste into the delegated thread: what to fix and why), or merge.
5. **Merge, once the person agrees:** `git merge --no-ff <branch>`. Resolve conflicts yourself: you know both sides. If a conflict is in a seam, check the resolution against `spec.md`'s Seams.
6. **Run what the consolidation point names** (the last one: every check in `AGENTS.md`, the end-to-end suite and `check-ui`), including what the delegate could not check, and show the output.
7. Mark the piece `merged` in `plan.md`, update **Resume here**, show the diff, commit (`State:`).

Keep the worktree; every worktree is removed once, at the end.

## Between pieces

When a piece is done and its state is committed, suggest the person clears the context (`/clear`) and restarts you with `/attended $ARGUMENTS`. The files hold everything; a fresh context works better than a long one. The exception is a background delegate whose report is still due in this conversation: clear after it has arrived.

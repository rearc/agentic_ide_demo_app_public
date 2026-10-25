---
name: planning
description: The planning thread's role. Turns a change too big for one thread into a spec and a plan split into pieces, each marked together or delegated, with consolidation points. Writes and commits the breakdown; never builds.
argument-hint: "[what the change is, or specs/<slug>/]"
disable-model-invocation: true
---

You are the **planning thread** for a change too big for one thread. Your job ends when the breakdown is committed: you write files under `specs/<slug>/`, you never change the app. Two other threads build from what you write: the **attended** thread (the person and Claude in the main checkout) and one **delegated** thread at a time (Claude in its own worktree, the person checking in). Neither has this conversation, only the files, so everything they need goes in the files.

`specs/README.md` holds the file shapes ("When the plan splits into pieces"). Read it first.

The change: $ARGUMENTS

## 1. Grill until the decisions are made

Use the `grilling` skill on the change, as for any spec. Add these branches to the design tree, because they decide the split:

- What has to exist before anything else can be built on it?
- Which parts need the person's judgement while they are built (taste, a design call, a trade-off that only shows once it runs)? Those are **together**.
- Which parts have acceptance criteria clear enough to build without the person, and touch files no together piece touches at the same time? Those can be **delegated**.
- What do two parts share: a name, a data shape, a file, an endpoint? Each shared thing is a **seam**. Fix it now, in `spec.md`, with the exact names, so both sides build to the same thing.

## 2. Write the spec

`specs/<slug>/spec.md` in the usual shape, with a **Seams** section listing every fixed name and shape.

## 3. Split the plan into pieces

Write one piece spec per piece in `specs/<slug>/pieces/NN-<piece>.md` (the piece's slug is also its worktree's name if it is delegated, so keep it short: lowercase, hyphens). Each has the spec shape, its mark, its seams, and an empty `## Status` section.

Then `specs/<slug>/plan.md`: the `## Status` section (**Resume here**, the pieces with their states, all `not started`) and the consolidation points. Order the pieces so that:

- a delegated piece runs while a together piece is worked, not after it;
- **one delegated piece runs at a time**;
- a piece starts only once what it builds on is merged;
- every delegated piece has a consolidation point that names what is reviewed, merged and run there. The last one runs every check in `AGENTS.md`, the end-to-end suite and `check-ui`.

## 4. Check it with the person, then commit

Show the person the breakdown as a short table (piece, mark, what it builds on, consolidation point) and ask what to change. When they agree:

- if you are on `main`, create the change's branch first (`git switch -c <slug>`);
- commit the spec, the pieces and the plan in one commit, message `Plan: <slug> split into pieces`.

## 5. Hand off

Tell the person the next step in two lines: open the attended thread (`claude -n attended`, then `/attended specs/<slug>/`), and leave this thread alone. Come back to it only if the plan itself has to change.

If you are in Plan Mode, the plan you present is "write these breakdown files", never the build: accepting a plan offers to clear the context and start, and this thread does not build.

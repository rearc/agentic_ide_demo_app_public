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

## When the plan splits into pieces

A change too big for one thread splits its plan into **pieces**, worked by more than one thread at once. Three skills carry the roles: `planning` writes the breakdown, `attended` works with the person in the main checkout, `delegated` builds one piece in its own worktree.

```
specs/<slug>/
  spec.md                 the whole change, as above
  plan.md                 the state of the whole: Status, pieces, consolidation points
  pieces/
    01-<piece>.md         one small spec per piece
    02-<piece>.md
```

**A piece spec** has the spec shape above (problem, decisions, acceptance criteria that each name their check, scope, parts touched), plus:

- **Mark:** `together` (built in the attended thread, with the person) or `delegated` (built in its own thread and worktree, the person checking in)
- **Seams:** what it shares with other pieces (names, data shapes, files), each fixed in `spec.md` so both sides build to the same thing
- **A `## Status` section**, written only by the thread building the piece: where it stands, its checklist (ticked only after the check passed), and for a delegated piece its worktree, branch and base commit

**`plan.md`** keeps its `## Status` section and **Resume here**, and adds:

- **Pieces:** one line each: number, name, mark, state (`not started`, `in progress`, `delegated: running`, `ready for review`, `merged`, `done`), and for a delegated piece its worktree
- **Consolidation points:** where delegated work comes back ("after pieces 1 and 2: review 2, merge it, run every check")

Only the attended thread writes `plan.md`, and it commits state changes on their own, with messages that start `State:`, so `git log -p -- specs/<slug>/plan.md` shows how the work moved. A delegated thread never edits `plan.md`, not even its own copy: its state lives in its piece spec, and a copy edited on two branches is a merge conflict.

A spec that needs tracking on the board becomes a GitHub issue instead (the `to-spec` skill).

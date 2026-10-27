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

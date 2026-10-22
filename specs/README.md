# Specs

One file per change, `specs/<short-name>.md`, written before the build and checked against after it. A spec holds:

- the problem, in the user's terms
- the decisions made, with the reason for each
- acceptance criteria a test or a check can prove
- what is in scope and what is out
- the parts of the app it touches

A spec that needs tracking on the board becomes a GitHub issue instead (the `to-spec` skill).

## A feature file

Work that runs over more than one session, such as a new card, keeps its spec as a feature file: the same file, grown as the work goes, so a fresh session can carry on from it and `git log` alone. On top of the spec's sections it holds:

- **Resume here**, at the top: where the work stands, what comes next and how (for example test-first, from the first unticked box), and what not to reopen without asking
- **Progress:** a checklist, design then build, ticked as the work goes
- **Design choice:** the look or approach chosen, and why
- **What we learned about the code:** facts a fresh session would otherwise have to find again
- **Open items:** questions waiting on the person
- **What I repeated:** anything the person typed, pasted or checked more than once

Update it at each step, and before a compaction or a new session. A small change needs only the spec.

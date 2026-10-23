# Definition of Ready

A ticket is Ready when a developer can start working on it without needing to ask clarifying questions. Every ticket must satisfy all of the following criteria before it moves from Backlog to Ready. A feature's spec has its own, shorter list: "A feature spec", below.

## Required fields

- [ ] **Acceptance criteria**: At least three specific, testable statements describing what "done" looks like. Vague criteria like "it should work" or "needed for trust" do not count.
- [ ] **Dependencies declared**: If this ticket depends on another ticket, a model that does not exist yet, or an external service, those dependencies must be listed explicitly. A developer should never discover a blocker after starting work.
- [ ] **Scope boundaries**: The ticket must state what is in scope and what is out of scope. If the ticket does not say what it will NOT do, the scope is undefined.
- [ ] **Assignee**: Someone owns this ticket. Unassigned tickets cannot be Ready.
- [ ] **Story points estimated**: The team has sized this ticket. Template-default values do not count as an estimate.

## Required context

- [ ] **Description is current with the codebase**: The ticket's description must reflect the actual state of the code, not what the author remembers. If the ticket describes work that is already done, it is not Ready -- it needs to be re-scoped or closed.
- [ ] **Component or area identified**: The ticket names the part of the system it touches (e.g., "backend/app/services/", "frontend/src/components/cards/"). This helps the AI and the developer understand blast radius.

## Recommended (not blocking)

- [ ] **Linked to an Epic**: The ticket should reference its parent Epic so the broader context is traceable.
- [ ] **Priority set**: Urgent, High, Normal, or Low. Helps sprint planning but does not block readiness.
- [ ] **Sprint assigned**: The ticket should be placed in a sprint or explicitly marked as Backlog (uncommitted).

## A feature spec

A feature's spec (`specs/<slug>/spec.md`; `specs/README.md` says what it holds) is Ready when a fresh session could plan and build it without asking you anything. Check it before planning the build:

- [ ] **Problem in the user's terms**: what is wrong or missing, not the solution.
- [ ] **Acceptance criteria**: at least three, each testable and naming the check that proves it (a test file and its command, or a named check such as `check-ui`).
- [ ] **Decisions with reasons**: every decision the build depends on is made, each with why, including the design chosen if there is one.
- [ ] **Scope boundaries**: what is in scope and what is out of scope, both stated.
- [ ] **Dependencies declared**: external services, keys, and other changes it waits on.
- [ ] **Parts of the app named**: the areas it touches, and what must not change.
- [ ] **Current with the codebase**: checked against the code, not written from memory.
- [ ] **No open question the build would have to guess**: any still open are listed, and none blocks the build.

A spec needs no assignee, story points or sprint: those belong to a ticket on the board.

## How this document is used

This Definition of Ready is read by both humans and AI assistants. When an AI agent is asked to check whether a ticket or a spec is ready, it reads this file and evaluates the ticket against each criterion. If any required criterion is not met, the agent flags the gap and refuses to advance the ticket.

When the team's standards change, update this file and commit it. The AI will pick up the new standards on the next run.

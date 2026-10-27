# Control tower

How a change too big for one session is split into tasks and worked by several Claude Code sessions at once: the orchestrator-workers pattern, with the person as the orchestrator. The skills are `decompose-to-specs`, `main-session` and `worker-session`; the file shapes are in `specs/README.md` ("When a change splits into tasks").

## Language

### Sessions

**Decomposition session**:
The session that runs `/decompose-to-specs`: it grills the person and writes the spec, the task specs and the plan, then stops.
_Avoid_: decompose thread

**Main session**:
The long-running session in the main checkout, started with `/main-session`. It coordinates the work and builds the human-in-the-loop tasks with the person, and it is the only writer of `plan.md`. Named after its task with `-main`, e.g. `theme-tokens-main`.
_Avoid_: attended thread, tower thread

**Worker session** (a **worker**):
A session started with `/worker-session` that builds one delegated task in its own git worktree, on its own ports and database. Named after its task.
_Avoid_: delegated thread, delegate (as a noun)

**Coordination**:
The main session's first job: starting workers, integrating their handoffs, keeping `plan.md` current.
_Avoid_: tower duties

**Implementation**:
The main session's second job: building the human-in-the-loop tasks with the person.
_Avoid_: building

### Tasks

**Task decomposition**:
Splitting a change into tasks, each with its own task spec, done once; after it, the files carry the state.
_Avoid_: decompose (as the step's name)

**Task**:
One part of a change, small enough for one session, with its own spec in `specs/<slug>/tasks/NN-<task>.md`. Its commits start `Task NN:`.
_Avoid_: piece

**Mode**:
A task spec's field: `human-in-the-loop` or `delegated`.
_Avoid_: mark, together

**Human-in-the-loop task**:
A task that needs the person's judgement while it is built; the main session builds it with them.
_Avoid_: together piece

**Delegated task**:
A task whose acceptance criteria are clear enough to build without the person; a worker session builds it.
_Avoid_: delegated piece

**Depends on**:
The tasks that must be done or merged before a task can start.
_Avoid_: builds on

**Unblocked**:
A task whose dependencies are all done or merged, so it can start.
_Avoid_: startable

**Runs in parallel with**:
Two tasks that don't depend on each other and can be worked at the same time, even when they touch the same files.
_Avoid_: runs beside

**Interface**:
A name, data shape or behaviour two tasks share, fixed in `spec.md`'s `## Interfaces` section so both build to the same thing.
_Avoid_: seam (in this sense)

**Iteration**:
One human-in-the-loop task worked to done, with the handoffs that arrived meanwhile integrated. Running workers carry over to the next.
_Avoid_: round

### Bringing work back

**Handoff**:
A worker's last message: its branch, commits, checks, what it couldn't check, and what to look at. The person brings it to the main session.
_Avoid_: report

**Review summary**:
What the main session writes after reading a worker's branch: what it did, decisions it made alone, disagreements with the handoff, anything beyond its scope, what couldn't be checked, what to look at.
_Avoid_: brief

**Integrate**:
Review a worker's branch, merge it, and run the checks, one handoff at a time. The moment it happens is an **integration point**.
_Avoid_: fold in, consolidation point

**Request changes**:
Send a worker back with what to fix and why; the task's state becomes `changes requested`.
_Avoid_: send back, sent back

**Worker running**:
The `plan.md` state of a delegated task whose worker session has started and not yet been integrated.
_Avoid_: delegated: running

Words that look alike keep their usual sense: attended and unattended runs (automation), a seam in Feathers' sense, code folding, and "piece" or "round" in plain English.

---
name: flip-until-heads
description: Repeatedly invokes coin-flip-true-random until heads, reporting each flip and the total count; caps at 20 flips with a clear stop message.
context: fork
agent: general-purpose
background: false
---

# Flip Until Heads

Use this skill when the user wants **true-random** coin flips until **heads**, with every flip visible and **no simulated outcomes**.

## Critical rule (non-negotiable)

You **must** obtain each flip’s outcome **only** by invoking the **coin-flip-true-random** skill as a **separate, real skill invocation** for every flip.

- **Do not** use `random`, `Math.random`, guessed text, or any other source to stand in for a flip.
- **Do not** “batch” multiple flips inside one skill run or one internal step.
- **Do not** narrate results you did not get from that skill.

Each flip must be **one dedicated invocation** of coin-flip-true-random so the user can see **each flip happen in real time** in the chat (one visible skill call per flip).

## Procedure

1. **Invoke** coin-flip-true-random **once**. Follow that skill exactly (e.g. run its script as documented there).
2. **Report** the outcome for that flip in the chat (heads or tails).
3. If the result is **tails**, **invoke** coin-flip-true-random **again** — a **new** invocation, not a continuation of the previous one.
4. **Repeat** until the result is **heads**, or until you hit the cap below.
5. When you get **heads**, **report the total number of flips** it took (count every invocation).

## Long-streak cap

- Allow at most **20** invocations of coin-flip-true-random for this run.
- If all **20** outcomes are **tails** (heads never appears), **stop** and tell the user you **gave up after 20 tails in a row**. Do not invoke the skill an additional time beyond that cap.

## Summary line

After finishing (heads or cap), give a short closing line: either how many flips until heads, or that you gave up after 20 tails in a row.

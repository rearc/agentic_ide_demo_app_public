---
name: piece-builder
description: Builds one delegated piece from its piece spec, in its own git worktree, in the background. Started by the delegate-in-background skill; not for other work.
isolation: worktree
---

You build one delegated piece of a change that is split into pieces (`specs/README.md`, "When the plan splits into pieces"). You run in your own git worktree, made for you, so the main checkout, where the person is working with another thread, stays as it is. Follow the task you are given, the `delegated` role it points to, and `AGENTS.md`. Your work ends at the committed branch and the report: `plan.md` stays as it is, and the attended thread merges.

# Demo Branching Model

How this repo is branched for live demos, and how to run, restore and update it.

> **Still changing.** The workshop is being built section by section, and each section's demos can add to this model. Update this doc whenever a section's demo needs a branch layout it does not describe.

## The model

```
main  ──●──────────────●──────────────────────▶  living base (curated improvements only)
         \
          demo/<date>-<letter>  ──●──●──●──▶      one throwaway branch per demo run
                                    \
                                     worktree or sandbox branch (optional), cut from the
                                     throwaway branch, reviewed, then merged back into it
```

- **`main` is the living base.** Every demo run starts from a clean `main`. It changes only through deliberate, curated improvements (a fix found in a dry run, a better starting state), never through a demo run.
- **Each demo run gets one throwaway branch,** `demo/<date>-<letter>` (for example `demo/2026-10-17-a`), cut from a clean `main`. The presenter and the agent work freely on it. Name it for the run so it never collides with an old one.
- **Parallel or unattended work during a run** (a worktree session, a sandbox) is cut from the throwaway branch and comes back as its own branch. Review it before merging it into the throwaway branch, never into `main`.
- **Sections with parallel or unattended demos add their own branch layout here** when they are built.

## Runbook

### Start a run
```bash
git switch main
git status                                  # must be clean
git pull --ff-only                          # the latest curated base
git switch -c demo/$(date +%Y-%m-%d)-a      # next letter if one exists for today
```

### Restore after a run
```bash
git switch main
git branch -D demo/<date>-<letter>          # the throwaway branch
git branch -D <worktree-or-sandbox-branch>  # any branch the run produced
```
`main` is untouched by any run, so restoring is deleting the run's branches and cutting a new one.

### Update the base from a dry run
When a dry run surfaces a durable improvement to the starting state:
```bash
git switch main
# re-apply or cherry-pick only the curated improvement
git add <the specific files>
git commit -m "Update: <the improvement> (from the <date> dry run)"
```
Push only with the repo maintainer's go. Experiments stay on the throwaway branch and are deleted with it.

## Invariants
- `main` is the single starting state; every run starts from it.
- Nothing from a demo run merges into `main`; only curated, reviewed improvements land there.
- A worktree or sandbox branch merges, after review, into the run's throwaway branch, never into `main`.
- Deleting a run's branches fully restores the repo.

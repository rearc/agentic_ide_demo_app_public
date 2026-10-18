# NOTICE — upstream provenance

This package distributes four upstream skills it did not author, pulled from three upstream repos via APM-native per-skill references (per [ADR-0015](../../ADR.md#adr-0015-upstream-skills-are-declared-at-per-skill-subpath-granularity-not-whole-collection)). The skills are *referenced*, not vendored in-tree: APM resolves each reference at consumer `apm install` time, places the upstream content under `apm_modules/<owner>/<repo>/`, and deploys each skill to `.claude/skills/`.

The Rearc-authored content in `.apm/` (agents, instructions, skills, hooks) and the local `random-tools` server are original content governed by this repo's `LICENSE` (MIT, per [ADR-0028](../../ADR.md#adr-0028-repository-license-is-mit)); they are **not** covered by this NOTICE. This file records only the four cherry-picked upstream skills.

## Upstreams (3)

| Upstream repo | License (SPDX) | License travels as | Verified |
|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | **Apache-2.0** | **per-skill** `LICENSE.txt` inside `skills/frontend-design/` → travels with the skill dir (the repo has **no** root LICENSE) | `skills/frontend-design/LICENSE.txt` is the Apache-2.0 text; `SKILL.md` frontmatter `license: Complete terms in LICENSE.txt`; checked 2026-06-09 |
| [mattpocock/skills](https://github.com/mattpocock/skills) | **MIT** | `LICENSE` at repo root → `apm_modules/mattpocock/skills/LICENSE` | `gh api repos/mattpocock/skills/license` → `MIT`, 2026-06-09 |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | **MIT** | declared in repo `README.md` (`## License → MIT`) and in `skills/react-best-practices/SKILL.md` frontmatter (`license: MIT`); **no LICENSE file ships** at root or in the skill dir | README `## License` = `MIT`; SKILL.md frontmatter `license: MIT`; checked 2026-06-09 |

All three are permissive (Apache-2.0, MIT, MIT) and impose no redistribution constraint incompatible with Rearc's distribution model (private install now, curated public cut later per todo.md item 37). Two travel-of-license nuances are flagged for the public cut below.

### License-travel nuances (read before the public cut, todo.md item 37)

- **anthropics/skills has no root LICENSE.** GitHub's license endpoint 404s for the repo; the Apache-2.0 text ships as a **per-skill** `skills/frontend-design/LICENSE.txt`. Because APM deploys the whole skill directory (SKILL.md + companion files), that `LICENSE.txt` travels *with* the skill into the consumer's tree — so the Apache-2.0 attribution and (importantly) its §4 notice obligations are satisfied. This is fine, but it means the license sits next to the skill, **not** at `apm_modules/anthropics/skills/LICENSE` where the ADR-0015 "root LICENSE travels" assumption would put it. Verify it's still present in the deployed skill dir at pin time.
- **vercel-labs/agent-skills ships no LICENSE *file* at all** — neither at root nor in `skills/react-best-practices/`. The MIT grant exists only as prose in the repo README and as a `license: MIT` frontmatter line in `SKILL.md`. The frontmatter line *does* travel with the skill, but MIT's redistribution clause technically wants the full license text + copyright notice included. For private install this is acceptable; **for the public cut, ensure the MIT text and a Vercel copyright attribution are preserved** alongside the redistributed `react-best-practices` content (e.g., a short attribution line in this NOTICE plus the SKILL.md frontmatter, or a copied license stub if Vercel adds one upstream). Not a redistribution *blocker* — MIT permits redistribution — but a compliance loose end to close before going public.

No upstream is copyleft or otherwise non-permissive. **No redistribution blocker.**

## Vendored skills (4)

| Skill (deployed name) | Upstream path | Upstream repo | License |
|---|---|---|---|
| `frontend-design` | `anthropics/skills/skills/frontend-design` | anthropics/skills | Apache-2.0 |
| `grill-me` | `mattpocock/skills/skills/productivity/grill-me` | mattpocock/skills | MIT |
| `to-prd` | `mattpocock/skills/skills/engineering/to-prd` | mattpocock/skills | MIT |
| `react-best-practices` | `vercel-labs/agent-skills/skills/react-best-practices` | vercel-labs/agent-skills | MIT |

Two upstream skill names drifted since the demo app's legacy `skills-lock.json` was last refreshed — `vercel-react-best-practices` is now `react-best-practices` upstream (the SKILL.md frontmatter `name:` still reads `vercel-react-best-practices`), and `write-a-prd` is now `to-prd`. The kit follows upstream naming.

## MCP servers — out of NOTICE scope (skills-only, like pocock's)

This NOTICE stays **skills-only**. The kit's three MCP registrations in `apm.yml` are deliberately *not* upstream-provenance entries:

- **`context7`** is an external-service registration — a `name` + remote HTTP `url` pointing at a live service (`https://mcp.context7.com/mcp`). **No upstream code or content is redistributed**; the consumer's harness connects to the remote service at runtime under that service's own terms of use (Context7 free tier, no auth). There is no vendored artifact to record provenance or a license for. (A `clickup` registration was removed 2026-07-20 — deprecated SolutionReach-engagement artifact.)
- **`random-tools`** is **Rearc-authored** — a ~15-line demo `server.py` shipped in this kit at `mcp-servers/random-tools-mcp/`, original content under this repo's MIT `LICENSE`. It is not cherry-picked upstream content, so it has no upstream provenance record.

If a future MCP registration ever vendors third-party server code into the kit, *that* would warrant a provenance entry here; the current three do not.

## Pinning gate

All four skill refs are **intentionally unpinned** in 0.1.0 per [ADR-0024](../../ADR.md#adr-0024-rearcresearch-kit-upstream-deps-stay-unpinned-in-010-apm-0110-transitive-cleanup-on-uninstall-is-broken-under-pinning) — pinning a transitive dep breaks `apm uninstall`'s cleanup (the pinned lockfile entry omits `resolved_by`/`depth`, so the orphan-detector can't prune it). Because this kit ships its own `.apm/` content alongside the pulled skills, pinning would leak the deployed upstream skill dirs on uninstall. **Re-validated against APM 0.18.0** (todo.md item 15/17): the bug persists. APM prints an unpinned-deps warning at every install — that warning is the visible cost of correct uninstall behavior.

When the upstream APM bug is fixed (tracked as item 15 in [todo.md](../../todo.md)) — or a sidecar `teardown.sh` ships to handle the regression — pin each ref to a single SHA. The intended pins at the time of authoring this NOTICE (each repo's tip of `main`, resolved 2026-06-09) were:

```
anthropics/skills          57546260929473d4e0d1c1bb75297be2fdfa1949
mattpocock/skills          e3d8b735ef92ec9554b07f11f408089d81289eed
vercel-labs/agent-skills   4ec6f84b61cd3c931046c3e6e398f3ae7de372f7
```

The actual pin used at publish time should reflect whatever content review surfaces between now and then — bump deliberately, don't auto-track upstream once pinned.

## Update procedure (post-pin)

Once the ADR-0024 pinning gate clears and the deps are pinned:

1. Choose a target commit on each upstream's default branch (`main`). Diff against the current pinned SHA before bumping.
2. Verify each of the four skills still exists at the same upstream path (`skills/frontend-design`, `skills/productivity/grill-me`, `skills/engineering/to-prd`, `skills/react-best-practices`). Pocock's set has had renames before; vercel's skill name already drifted once.
3. Re-confirm the license-travel nuances above still hold — that anthropics still ships `frontend-design/LICENSE.txt` in the skill dir, and whether vercel-labs has added a LICENSE file (which would simplify the public-cut compliance note).
4. **Before bumping a SHA, run `apm audit` over the resolved upstream skill content** (`apm install`/`apm lock` first, then `apm audit` against the deployed files) — the offline hidden-Unicode / invisible-instruction scan. Clean is the bar; investigate any finding before bumping.
5. Bump the SHA on the affected entry in `apm.yml` (and the example pins above).
6. Run the harness — the workshop-demo-kit phase verifies all four skills resolve, deploy, and uninstall cleanly.
7. Commit with a message that names the upstream commit range diffed.

While the pinning gate is open: every `apm install` re-resolves to upstream tip-of-main, so drift is immediate. Mitigation is the harness (surfaces a missing skill) plus the pre-pin content review.

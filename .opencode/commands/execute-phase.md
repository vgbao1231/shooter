---
description: Run the current phase from scope -> docs -> implement -> test -> review -> report
---

Execute the current INKSHOT phase. If `$ARGUMENTS` is non-empty, treat it as the task/phase hint.

1. Read `docs/README.md` §7 (Phase status) and §8 (Next step) to identify the phase, its gate, and the next step.
2. Confirm scope with the user before implementing. Implement only within the phase's accepted scope (see `AGENTS.md`).
3. Run `pnpm typecheck` and `pnpm test`. If web or server changed, run `pnpm check:e2e` (dev server on 5173). If LAN/networking changed, run `pnpm check:e2e:lan` (dev server on 5173 + `pnpm host` on 8080).
4. If the diff is non-trivial (multi-file, networking, or contract change), have the `reviewer` subagent review it.
5. Report short: what changed, tests run + counts, remaining risks/gaps. Do not re-explain the architecture.

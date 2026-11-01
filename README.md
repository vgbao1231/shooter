# INKSHOT

A 2–4 player side-view LAN arena shooter with bots, built on the owner-authored `ROUNDS-style demo.html` as the visual/gameplay base. All art and code are original.

## Phase 1 — local training slice

```text
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # deterministic sim + movement/combat tests
pnpm build
pnpm check:e2e    # browser smoke test while `pnpm dev` is running
```

Controls: `A/D` move · `Space` jump · into wall + hold jump to climb · mouse aim · LMB shoot · RMB/`G` grenade · `1/2/3` guns · `C` cards · `R` reset · `F1` debug.

See `docs/README.md` for design, art direction, architecture, and roadmap. LAN/lobby/round flow arrive in later phases.

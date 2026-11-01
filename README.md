# INKSHOT

A 2–4 player side-view LAN arena shooter with bots, built on the owner-authored `ROUNDS-style demo.html` as the visual/gameplay base. All art and code are original.

## Phase 3 — LAN multiplayer

```text
pnpm install
pnpm dev          # http://localhost:5173 (local dev)
pnpm host         # build client + start the LAN host at http://<host-ip>:8080
pnpm test         # deterministic sim + movement/combat/net tests
pnpm build
pnpm check:e2e    # browser smoke test while `pnpm dev` is running
pnpm check:e2e:lan  # 2-browser LAN flow while `pnpm dev` (5173) + `pnpm host` (8080) run
```

Controls: `A/D` move · `Space` jump · into wall + hold jump to climb · mouse aim · LMB shoot · RMB/`G` grenade · `1/2/3` guns · `C` cards · `R` reset · `F1` debug.

See `docs/README.md` for design, art direction, architecture, roadmap, and LAN run instructions. The first client to join the LAN room is the host.


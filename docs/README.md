# INKSHOT — Phase 3

> **Status:** Phase 3 implemented (Colyseus LAN host, lobby, authoritative match). Owner approved Phase 1 feel and Phase 2 match mode. Remaining playtest: full multi-round LAN completion + real-LAN feel before Phase 4.
> **Game:** 2–4 player side-view LAN arena shooter with bots.
> **Art:** 100% owner-built characters, weapons, map, cards, VFX, and UI. No external art/audio assets.
> **Reference demo:** [ROUNDS-style demo.html](references/ROUNDS-style%20demo.html)
> **Production code:** pnpm workspace; `@inkshot/sim` fixed-step sim + `@inkshot/web` React/Canvas client + `@inkshot/server` Colyseus LAN host.

---

## 1. What is being built

**INKSHOT** is a fast, readable side-view arena shooter for 2–4 players on one LAN. Players fight in short rounds on a fixed arena using a single pistol, with cards that mutate it into a shotgun, an SMG, or something stranger, plus grenades. The host picks free-for-all or a team mode, and server-side bots fill empty slots or take over disconnected players.

The visual target is the owner-built demo: round-body fighters, noodle limbs, expressive eyes, chunky weapons, bright tracers, hit sparks, screen shake, and angular cards. The game is ROUNDS/Stick Fight-inspired in feel, but uses only original art and code. The demo HTML is also the production codebase base.

---

## 2. Core decisions

| Area | Decision |
|---|---|
| Players | 2–4 occupied slots, humans and/or bots |
| Modes | Training (1v1 sandbox) + Bot Gauntlet (waves) + Match (1 human vs 1–3 bots, first-to-N, Easy/Normal/Hard); LAN (2–4 humans + bots, host controls, first-to-N) |
| Match | One life per round; first to 3 or 5; draw replays; 75 s overheat |
| Combat | 100 HP; no shield, pickups, reload, or ammo in MVP |
| Pits | Floor gaps; falling out of the arena kills instantly |
| Weapons | Pistol only; shotgun/SMG are emulated by cards (`BUCKSHOT`, `RAPID`); grenade |
| Cards | 13-card catalog across Projectile / Combat / Defense / Movement / Passive; pick 1 of 3 or buy in the shop |
| Bots | Server-side; Easy/Normal/Hard; fill empty slots and take over drops |
| Gauntlet | Waves escalate; coins per clear; shop (damage / max HP / speed / random card); skins unlock at waves 3 / 5 / 8 |
| LAN | One host process serves client + WebSocket on one port (`pnpm host` → `http://<host-ip>:8080`); Colyseus 0.16 (deviation from 0.18); authoritative sim, snapshot + 50 ms interpolation (no prediction yet); no cloud/accounts/database |
| Art | Owner-authored vector/canvas art; no external asset packs, no ROUNDS assets |
| Stack | TypeScript, React, Canvas 2D, Vite, pnpm; Colyseus 0.16 (core + ws-transport) + colyseus.js 0.16 + Express |
| Arena | Pool of 2 mirrored 1280×720 arenas (Proving Grounds, Skyline), selectable pre-match |
| Platform | Desktop browser on LAN; keyboard + mouse; pointer lock keeps the cursor inside the arena |

---

## 3. Documents

| File | Purpose |
|---|---|
| [01-game-design.md](01-game-design.md) | Modes, rounds, controls, weapons, cards, bots, arena, HUD |
| [02-art-direction.md](02-art-direction.md) | Self-built visual language, palette, characters, weapons, map, VFX, UI |
| [03-technical-architecture.md](03-technical-architecture.md) | Stack, shared simulation, networking, bots, performance |
| [04-roadmap.md](04-roadmap.md) | Phases, tests, LAN release, risks, acceptance gates |
| [references/card-catalog.md](references/card-catalog.md) | The 13-card catalog and 5 categories |
| [references/ROUNDS-style demo.html](references/ROUNDS-style%20demo.html) | Owner-built reference prototype |

No asset-research, asset-inventory, or decision-log files are kept. Phase 0 is not a historical archive.

---

## 4. What the demo proves

The demo is the **reference prototype and the production codebase base**:

- 1280×720 Canvas rendering, full-viewport with `object-fit: cover`.
- One human vs. one bot on a mirrored arena (plus the Bot Gauntlet waves and the Match mode).
- Match: 1 human vs 1–3 bots, first-to-3/5, Easy/Normal/Hard, with sim-driven rounds (countdown → playing → round end → match end) and a Rematch overlay.
- LAN: 2–4 browsers on one LAN join a Colyseus host (`pnpm host` → `http://<host-ip>:8080`), fill a 4-slot lobby (host controls bot count/difficulty/target/arena), and play an authoritative match driven by the shared sim at 60 Hz (snapshots at 30 Hz, 50 ms interpolation, bot takeover on disconnect).
- Round-body fighter with noodle limbs, aim-following eyes, recoil, knockback, squash/stretch, and hit flash.
- Pistol-only combat; shotgun/SMG come from cards; grenade; bouncing and explosive bullets.
- Muzzle flash, tracers, impact sparks, debris, smoke, damage numbers, screen shake, hit-stop.
- Angular card overlay with three random cards from a 13-card catalog.
- Menu with mode + arena selection; gauntlet shop, coins, and skin unlocks.

The demo does **not** yet include teams, real 2v2/FFA mode pick, per-round card progression, or latency simulation. Those are later MVP scope, not claims of completion. **Phase 3 adds LAN**: 2–4 browsers on one LAN join a Colyseus host, fill a 4-slot lobby (host controls bot count/difficulty/target/arena), and play an authoritative match driven by the shared sim at 60 Hz (snapshots at 30 Hz, 50 ms interpolation). Multi-human FFA-style matches and bot takeover on disconnect work; the client does not predict yet.

---

## 5. Boundaries

- No external character, weapon, map, card, VFX, audio, or font assets are part of the production plan.
- No ROUNDS-extracted assets, screenshots, code, card art, or audio.
- No paid assets.
- No cloud, accounts, matchmaking, database, TLS, or public hosting.
- Phase 3 adds a Colyseus LAN host, a 4-slot lobby, and an authoritative match room (2–4 humans + bots). Client prediction/reconciliation is deferred; teams/FFA mode pick and LAN card offers are Phase 4+.

Production uses a system font stack. The demo's Google Fonts link is prototype-only and not used by the app.

---

## 6. Run

```text
pnpm install
pnpm dev            # http://127.0.0.1:5173 (local dev)
pnpm host           # build client + start LAN host at http://<host-ip>:8080
pnpm build
pnpm test           # deterministic sim + movement/combat/card/net tests
pnpm check:e2e      # while `pnpm dev` is running: browser smoke test (local)
pnpm check:e2e:lan  # while `pnpm dev` (5173) + `pnpm host` (8080) are running: 2-browser LAN flow
```

To disable pointer lock (e.g. for automated checks) open the game with `?noPointerLock=1`.

**LAN host:** run `pnpm host` on the host machine, then guests visit `http://<host-lan-ip>:8080`. The first client in the room is the host (controls start/rematch); everyone joins the same address. One room per host, 4 slots, bots fill the rest.

---

## 7. Phase 3 status

Implemented (on top of Phase 1/2):

- `apps/server`: Colyseus 0.16 host (core 0.16.26 + ws-transport 0.16.5) + Express static serving, one port (`pnpm host` → `http://<host-ip>:8080`, `/health`, SPA fallback).
- **Deviation:** roadmap said 0.18; the 0.18 server has no published client SDK and an incompatible handshake, so the matched 0.16 line is pinned (see `03-technical-architecture.md`).
- Single `GameRoom`: lobby (4 slots, host = first client, host controls bot count/difficulty/target/arena, ready/start) → match (authoritative sim 60 Hz, snapshots 30 Hz, round events, rematch).
- Shared wire protocol (`MSG` + `LobbyState`/`MatchStart`/`MatchEvent`/`NetInput`) in `packages/sim/src/protocol.ts`; snapshot serializer in `packages/sim/src/net.ts`.
- Client renders authoritative snapshots with 50 ms interpolation + local effect decay; **no prediction/reconciliation yet** (LAN latency acceptable).
- `createWorld({humanCount})` multi-human; bot takeover on disconnect (`isBot`/`botControlled`).
- LAN menu (host address + name + Connect), 4-slot lobby UI, LAN game screen, match-end overlay with host-only Rematch; DeckPanel hidden in LAN.
- In-canvas nameplates show real player names.
- `pnpm check:e2e:lan` 2-browser flow (connect → lobby → start → both playing → host moves, guest sees same x; 0 errors).
- 19 sim tests (16 prior + 3 net serializer/interpolate/decay).

Not yet: full multi-round LAN completion + real-LAN feel (playtest), teams/FFA mode pick, 1v2/1v3 team HP bonus, LAN card offers, per-round card progression, latency harness, client prediction, final balance, audio.

---

## 8. Next step

Owner plays a full multi-round LAN match on real hardware (2–4 browsers, host + guests, bot takeover, rematch). If LAN feel is acceptable on wired/Wi-Fi, Phase 4 adds mode/team picks, card offers, and client prediction before card balance.

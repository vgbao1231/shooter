# 03 — Technical Architecture

> **Status:** Phase 3 implemented: a Colyseus LAN host serves the built client + WebSocket on one port, with a 2–4 slot lobby (host controls, bot fill) and an authoritative match room running the shared sim at 60 Hz. The client renders authoritative snapshots with 50 ms interpolation; it does not predict yet.
> **Goal:** Server-authoritative 2–4 player LAN shooter with a shared simulation and server-side bots. Client prediction is deferred (authoritative + interpolation is acceptable on LAN).

---

## 1. Goals

| Goal | Consequence |
|---|---|
| Responsive control | Client prediction + reconciliation (deferred to Phase 4+; LAN uses authoritative + interpolation) |
| Authority | Host decides hits, damage, scores, rounds, cards |
| Shared rules | One pure TypeScript sim for client and host |
| LAN simplicity | One Node process serves client + WebSocket on one port |
| Small scope | No accounts, DB, cloud, matchmaking, or TLS |
| Testability | Deterministic input, seeded RNG, headless tests |
| Owner-built art | No external asset pipeline |

**Non-goals:** public internet, reconnect, rollback for all, P2P, Redis, multi-host, accounts, ranked, spectator, stored replays, anti-cheat beyond authority, split-screen, mobile.

---

## 2. Stack

TypeScript, React 19, Vite 8, Canvas 2D renderer, Vitest + Playwright smoke check, pnpm workspaces. LAN uses Colyseus **0.16** (`@colyseus/core@0.16.26` + `@colyseus/ws-transport@0.16.5` server, `colyseus.js@0.16.22` client) + Express for static serving, all pinned exact.

The Phase 1 client renders with **Canvas 2D** through `ArenaRenderer`; it does not own gameplay physics. Phaser is not used in Phase 1.

**Deviation from the roadmap (Colyseus 0.18 → 0.16):** the roadmap specified Colyseus 0.18, but the **0.18 server has no published client SDK** — `colyseus.js` tops out at 0.16.22, and its handshake is incompatible (the 0.18 server returns a flat matchmake response, while the 0.16 client expects `{room:...}`). The matched, working pair is core **0.16** + colyseus.js **0.16**, so we pin the 0.16 line (post-1.0, stable). `@colyseus/schema` is deliberately **not** used: rooms sync render snapshots as JSON messages, and the sim is the single authority (`NoneSerializer` default).

---

## 3. Layout

```text
shooter/
  apps/
    web/          # React + Vite + Canvas 2D client
    server/       # Colyseus LAN host: static client + GameRoom + sim authority
  packages/
    sim/          # pure fixed-step simulation (movement, combat, bot, net, protocol)
  docs/
```

Two apps and one sim package. `packages/bots`, `packages/protocol`, `packages/content` and `assets/` are planned splits for later phases; for now bot code, content, the net serializer, and the wire protocol live in `packages/sim`.

- `sim` has no React/DOM/Node imports and is unit-testable in Node.
- `web` renders and captures input; it does not invent gameplay rules.
- `server` owns authority, rooms, bots, and the LAN HTTP host.

---

## 4. Runtime

```text
Host machine
┌──────────────────────────────────────────┐
│ Node process (pnpm host)                 │
│  ├─ static HTTP server (built client)    │
│  ├─ Colyseus WebSocket (same port)       │
│  ├─ GameRoom: lobby → match (4 slots)    │
│  ├─ authoritative sim 60 Hz              │
│  └─ bot controllers                      │
└──────────────────────────────────────────┘
          ▲ HTTP + WS
   P1     P2     P3     P4   (same LAN)
```

Host: `http://<host-lan-ip>:8080` (run `pnpm host`; the built client is served from the same port). The first client in the room is the host (controls start/rematch); guests join the same address. One room per host, 4 slots, bots fill the rest. State in memory. No cloud, DB, accounts, or TLS.

---

## 5. Simulation

| Property | Value |
|---|---|
| Tick | 60 Hz |
| Step | 1/60 s |
| Arena | 1600 × 720 |
| Player collision | Circle vs. AABB platforms |
| Player radius | 16 px (small relative to the wide map so 2–4 players have room) |
| Health | 100, no shield, no ammo/reload |
| Movement | Run, jump, wall slide, wall jump, wall climb with stamina |
| Pits | Floor gaps; falling below the arena kills (no respawn) |
| Weapons | Pistol only; shotgun/SMG are emulated by cards (`BUCKSHOT`, `RAPID`); grenade |
| Modes | Training (1v1 sandbox), Vượt ải / Bot Gauntlet (level-select, escalating difficulty, all open), LAN (2–4 humans + bots, first-to-N) |
| Arenas | Proving Grounds + Skyline; distinct layouts + palettes, selectable pre-match, same layout per match |
| Cards | 13-card catalog across 5 categories; sandbox/shop pick in Phase 1, loser-picks in a later phase |
| Randomness | Seeded xorshift PRNG; no `Math.random()` in sim |
| Authority | Host (Phase 1 is local; Phase 3 adds the network host) |

The sim is a pure function of `(state, commands, dt)`. Rendering, particles, audio, and screen shake are outside it. Deterministic replay is covered by tests.

```ts
interface InputCommand {
  playerId: number;
  seq: number;
  move: -1 | 0 | 1;
  jumpHeld: boolean;
  shootHeld: boolean;
  grenadeHeld: boolean;
  aimX: number;
  aimY: number;
}
```

Humans and bots use the same command. `seq` increases; `move` is clamped; `aim` is a world point. There is no weapon switching: the pistol is the only weapon, and cards mutate its behavior. Host (future) applies edge detection and ignores client-supplied IDs, teams, scores, or card results.

**Step order:** input → movement/collision → fire/cooldowns → projectiles/grenades → damage/death/round checks → tick/hash.

---

## 6. Networking

- Host authoritative at 60 Hz via a fixed-step accumulator (Colyseus passes deltaTime in **milliseconds**; convert to seconds before accumulating).
- Client input at up to 60 Hz; host broadcasts snapshots at 30 Hz (every 2 ticks).
- Remote players interpolate **50 ms** in the past; the client renders from authoritative snapshots only — it never simulates gameplay.
- **No client prediction/reconciliation yet.** On LAN the authoritative + interpolation trade-off is acceptable; prediction/reconciliation is a Phase 4+ follow-up (the sim's `InputFrame`/`seq` is already shaped for it).
- Missing snapshot: hold the last one; effects decay locally for smooth VFX (client-side timers only, never gameplay).
- `createWorld({humanCount})` distributes humans across the first spawn points and bots across the rest.

**Rooms:**

- A single `GameRoom` class covers lobby → match (no cross-room migration): one process, one port.
- Lobby phase: four slots, host = first client, host controls bot count/difficulty/target/arena, ready/start.
- Match phase: authoritative sim at 60 Hz, snapshots at 30 Hz, round events, bot takeover on disconnect, rematch (host-only, after match end).
- Host disconnect mid-match: host controls off until the match ends; the host slot is bot-taken-over.

**Messages:** `lobby:setName`, `lobby:setReady`, `lobby:setConfig`, `lobby:start`, `match:rematch`, `match:input` → `lobby:update`, `match:start`, `match:snapshot`, `match:event`, `room:error`. Constants and payload types live in `packages/sim/src/protocol.ts` (`MSG`, `LobbyState`, `MatchStart`, `MatchEvent`, `NetInput`); the snapshot type is in `packages/sim/src/net.ts`.

Validate schema, range, rate, and host permission. Drop invalid input without crashing.

---

## 7. Bots

Server-side, three difficulties, same `InputCommand` pipeline. Read authoritative state only; no hidden information. Deterministic under a fixed seed. Fill empty slots; disconnected humans become Normal bots. No client-side bot logic.

In Phase 3 the server takes over on `onLeave` mid-match: it sets `isBot`/`botControlled` on the human's player and `createBotInput` lazily creates the bot brain, so the round continues without stalling.

Phase 1 training: 1 human + 1 Normal bot in a sandbox; cards are available via `C` for feel-testing. Bot Gauntlet is entered through a level-select (6 levels, Easy→Hard, 1→3 bots, arenas alternating, all open), awards coins for clears, and offers a shop (damage / max HP / speed / random card). Skins unlock at waves 3 / 5 / 8.

LAN match: the round/match state machine lives in the sim (deterministic, LAN-ready): `roundState` (`countdown`/`playing`/`roundEnd`/`matchEnd`), `roundTimer`, `roundNumber`, `matchTarget`, `matchOver`, `botDifficulty`, and per-player `score`. `stepWorld` drives the countdown freeze and the round-end → next-round/match-end transitions; `checkRoundOver` awards the round to the last side alive. The client reads this state and renders READY / round-result / match-end banners and a host-only Rematch overlay.

---

## 8. Content and assets

- Weapon stats, map layout, spawn sets, card data, and tuning live in `packages/sim` (`content.ts`, `arena.ts`). A separate `packages/content` can be split out later.
- Owner-authored art lives as Canvas 2D drawing code, React/CSS/SVG components, and inline shapes in the app.
- No downloaded art/audio packs.
- No external font requests in production; system font stack.
- Cards are React/SVG components; VFX are generated shapes/particles.

---

## 9. Security, performance, status

**Security:** LAN group is trusted. Host validates movement, weapons, cooldowns, damage, hostility, and card picks. Reject unknown fields, out-of-range values, excessive rate. Origin check. No accounts/tokens/DB. Sanitize names. No public exposure.

**Budgets:** 60 fps at 1600×720 with 4 players + VFX; host tick p95 < 4 ms with 4 players + 20 projectiles; ~500 live particles; no external asset/font requests; playable at 5–50 ms RTT, tested to 100 ms.

**Exists today:** a pnpm workspace with `packages/sim` (fixed-step sim + net serializer + protocol + tests), `apps/web` (React + Canvas 2D client), and `apps/server` (Colyseus LAN host). `pnpm dev` runs the menu → Training, Vượt ải / Bot Gauntlet (level-select), or LAN across two arenas; `pnpm host` builds the client and starts the LAN host at `http://0.0.0.0:8080` (built client + WebSocket on one port). `pnpm test` covers movement, collision, combat, cards, bullet wall-clamping, deterministic replay, the round flow, and the net serializer/interpolation/decay. `pnpm check:e2e` drives Training + Gauntlet (level-select) + the Esc pause overlay; `pnpm check:e2e:lan` (needs the Vite dev server on 5173 + the LAN host on 8080) drives a 2-browser LAN flow: connect → lobby (1 host + 1 guest + open slots) → host start → both reach playing → host moves and the guest sees the host at the same x. Pointer lock is removed (absolute mouse aim; Esc opens a pause/settings overlay). **Remaining playtest items:** full multi-round LAN completion and real-LAN feel before Phase 4.
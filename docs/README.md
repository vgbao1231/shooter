# INKSHOT — Phase 3

> **Status:** Phase 3 implemented (Colyseus LAN host, lobby, authoritative match). A post-Phase-3 UX batch removed pointer lock (absolute aim), added an Esc pause/settings overlay, collapsed to 3 modes (Training, Vượt ải/Bot Gauntlet with a level-select, LAN), added map previews (menu/lobby/level-select), widened the arenas to 1600×720 with `PLAYER_RADIUS=16`, and split the two arenas into distinct layouts + palettes (Proving Grounds: teal, tan, central pyramid; Skyline: dark, teal-sand, central tower + narrow pit + hanging swing blocks). A follow-up batch tuned movement (higher ground/air accel → less inertia), switched the canvas to `object-fit: contain` so the full map width fits the viewport (no cropped edges), redesigned Skyline (smaller pit, central tower, pendant swing platforms that physically sway when stood on/shots hit), and added real LAN teams (lobby columns per team, selectable sides, no friendly damage but effects still spawn) plus room codes + share links (`http://<host>/QH3Z5`, join by code). Remaining playtest: full multi-round LAN completion + real-LAN feel before Phase 4.
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
| Modes | Training (1v1 sandbox) + Vượt ải / Bot Gauntlet (level-select, escalating difficulty, all levels open) + LAN (2–4 humans + bots, host controls, first-to-N). Local Match (1 human vs 1–3 bots) removed — LAN covers multi-human |
| Match | One life per round; first to 3 or 5; draw replays; 75 s overheat |
| Combat | 100 HP; no shield, pickups, reload, or ammo in MVP |
| Pits | Floor gaps; falling out of the arena kills instantly |
| Weapons | Pistol only; shotgun/SMG are emulated by cards (`BUCKSHOT`, `RAPID`); grenade |
| Cards | 13-card catalog across Projectile / Combat / Defense / Movement / Passive; pick 1 of 3 or buy in the shop. In LAN, a **scored 1v1 round** offers the loser 1 of 3 cards (20 s auto-pick, no offer in team matches or draws) |
| Bots | Server-side; Easy/Normal/Hard; fill empty slots and take over drops |
| Gauntlet | Waves escalate; coins per clear; shop (damage / max HP / speed / random card); skins unlock at waves 3 / 5 / 8 |
| LAN | One host process serves client + WebSocket on one port (`pnpm host` → `http://<host-ip>:8080`); Colyseus 0.16 (deviation from 0.18); authoritative sim, snapshot + 50 ms interpolation (no prediction yet); room codes + share links (`http://<host>/CODE`); real teams (2–4, lobby columns, no friendly damage, per-team round scoring); no cloud/accounts/database |
| Art | Owner-authored vector/canvas art; no external asset packs, no ROUNDS assets |
| Stack | TypeScript, React, Canvas 2D, Vite, pnpm; Colyseus 0.16 (core + ws-transport) + colyseus.js 0.16 + Express |
| Arena | Pool of 2 distinct 1600×720 arenas (Proving Grounds, Skyline), each with its own layout + palette, selectable pre-match |
| Platform | Desktop browser on LAN; keyboard + mouse; absolute mouse aim (no pointer lock); Esc opens a pause/settings overlay |

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

- 1600×720 Canvas rendering, full-viewport with `object-fit: contain` (letterbox-aware pointer mapping) so the whole map width fits and no player is cropped.
- One human vs. one bot on a selectable arena (plus the Vượt ải / Bot Gauntlet level-select and waves).
- LAN: 2–4 browsers on one LAN join a Colyseus host (`pnpm host` → `http://<host-ip>:8080`), fill a 4-slot lobby (host picks team count + per-team bots + first-to + arena; no difficulty selector — bots are Normal), and play an authoritative match driven by the shared sim at 60 Hz (snapshots at 30 Hz, 50 ms interpolation, bot takeover on disconnect).
- Round-body fighter with noodle limbs, aim-following eyes, recoil, knockback, squash/stretch, and hit flash.
- Pistol-only combat; shotgun/SMG come from cards; grenade; bouncing and explosive bullets.
- Muzzle flash, tracers, impact sparks, debris, smoke, damage numbers, screen shake, hit-stop.
- Angular card overlay with three random cards from a 13-card catalog.
- Menu with mode + arena selection; map previews (menu, lobby, level-select); gauntlet level-select, shop, coins, and skin unlocks.

The demo does **not** yet include per-round card progression or latency simulation. Those are later MVP scope, not claims of completion. **Phase 3 adds LAN**: 2–4 browsers on one LAN join a Colyseus host via a room code or share link, pick a side in a team lobby (2–4 teams, no friendly damage), and play an authoritative match driven by the shared sim at 60 Hz (snapshots at 30 Hz, 50 ms interpolation). Multi-human matches, real teams, bot takeover on disconnect, and the scored-1v1 loser card offer work; the client does not predict yet.

---

## 5. Boundaries

- No external character, weapon, map, card, VFX, audio, or font assets are part of the production plan.
- No ROUNDS-extracted assets, screenshots, code, card art, or audio.
- No paid assets.
- No cloud, accounts, matchmaking, database, TLS, or public hosting.
- Phase 3 adds a Colyseus LAN host, a 4-slot lobby, and an authoritative match room (2–4 humans + bots). Client prediction/reconciliation is deferred; per-round card progression and team-match card offers are Phase 4+, but a **scored 1v1 loser card offer** (pick 1 of 3, 20 s auto-pick) already ships.

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

Pointer lock is removed: the mouse aims absolutely across the arena, and `Esc` opens the pause/settings overlay (Resume / Menu).

**LAN host:** run `pnpm host` on the host machine, then guests visit `http://<host-lan-ip>:8080`. The first client in the room is the host (controls start/rematch); everyone joins the same address. One room per host, 4 slots, bots fill the rest.

---

## 7. Phase 3 status

Implemented (on top of Phase 1/2):

- `apps/server`: Colyseus 0.16 host (core 0.16.26 + ws-transport 0.16.5) + Express static serving, one port (`pnpm host` → `http://<host-ip>:8080`, `/health`, SPA fallback).
- **Deviation:** roadmap said 0.18; the 0.18 server has no published client SDK and an incompatible handshake, so the matched 0.16 line is pinned (see `03-technical-architecture.md`).
- Single `GameRoom`: lobby (4 slots, host = first client, host picks team count + per-team bots + first-to + arena, ready/start) → match (authoritative sim 60 Hz, snapshots 30 Hz, round events, rematch).
- **Room codes + share links:** host `create`s a room with a 5-char code; `filterBy(["code"])` lets guests `join` that exact room by code (an unknown code errors, so nobody accidentally becomes host); the lobby shows the code + `http://<origin>/CODE` invite link (copy button), and visiting a `/CODE` URL auto-joins (the client derives the Colyseus host address — the page origin under `pnpm host`, or `:8080` on the same hostname under the Vite dev server on `:5173`). Duplicate codes are rejected server-side.
- **Real teams:** `LobbyConfig.teams` (2/3/4 sides; max 4 players, so no FFA). The lobby is a wide 2-column layout: "Pick your side" (team columns) left, "Match setup" (styled panel with an ARENA `<select>`, first-to, connected players, start button) right. Each team column has a host-only "+ Add bot" button (`LobbyConfig.botTeams`) instead of a global bot count; joining auto-assigns the least-loaded side and players can re-pick. `PlayerState.team` + `World.teamCount`/`teamScores` drive sim hostility: teammates take **no damage** (bullets are absorbed with a friendly-hit effect, grenade blasts spare teammates/owner), bots only target enemy teams, and round wins are scored per team (a team wins the match at the target). Team-colored ground markers + a HUD team scoreboard show sides in-match.
- Shared wire protocol (`MSG` + `LobbyState`/`MatchStart`/`MatchEvent`/`NetInput`) in `packages/sim/src/protocol.ts`; snapshot serializer in `packages/sim/src/net.ts`.
- Client renders authoritative snapshots with 50 ms interpolation + local effect decay; **no prediction/reconciliation yet** (LAN latency acceptable).
- `createWorld({humanCount, teamCount, playerTeams})` multi-human + team assignment; bot takeover on disconnect (`isBot`/`botControlled`).
- LAN menu (name + Create room / Join room by code; no host-address or persistent-code fields — the code is generated on create and shown in the lobby), team-column lobby UI, LAN game screen, match-end overlay with host-only Rematch; DeckPanel hidden in LAN (cards come from the loser offer, not a deck panel).
- In-canvas nameplates show real player names.
- **Loser picks card (LAN 1v1):** the sim is the single authority (`World.cardPick`). When a **scored 1v1 round ends** (exactly 2 players on 2 teams, no draw, match not decided), the loser is offered 1 of 3 cards it doesn't already own, picked deterministically; `stepMatchRoundOver` freezes the round-end phase until the pick (a bot loser auto-picks immediately). `MSG.PICK_CARD` (client→server) resolves it; `MSG.CARD_PICK` (`offer`/`resolved`) goes **only to the loser's session**. 20 s `CARD_PICK_TIMEOUT` auto-picks the first offer. Team matches (2v2/1v2/1v3) and draws offer nothing. The client shows a `CardOverlay mode="loser"` (no reroll/close, countdown).
- **Next round auto-loss after a loser card pick (fixed):** `startMatchRound` only respawned the **first** human (`players.find(e => !e.isBot)`) plus the bots, so in a 2–4 human LAN match the later humans stayed dead from the previous round and the next round instantly ended as their loss. It now respawns **every** human to its spawn (`allSpawns[index]`) and every bot to `allSpawns[humans.length + index]`, so after the loser picks a card the next round plays normally. Verified live: 1v1 host kills guest → guest picks a card → round 2 reaches `countdown` with the guest alive.
- **Lobby copy-link icon:** the invite link now has a small inline copy (clipboard) icon button next to the code (instead of the full-width "Copy link" button) that copies the share link and flashes a "Copied!" label. Verified: icon copies the URL and shows feedback.
- **Create-room hardening:** Colyseus 0.16 drops any `onMessage` received before its handler is registered, so a `LOBBY_UPDATE` broadcast from `onJoin` could arrive before the client attached handlers after `await create()`. The client now sends `MSG.REQUEST_LOBBY` after attaching handlers and the server re-sends the lobby payload (`sendLobbyTo`); the client keeps re-requesting every 500 ms until the lobby actually arrives (guards the `onJoin`-slot race), and `connectLan` has a 10 s timeout so a hung `create()` can't leave the button stuck. A "Waiting for the lobby…" state shows while the first payload is in flight.
- **Create-room on any dev port:** `defaultServerAddr()` now redirects **any** Vite dev port to the sibling `:8080` (was `:5173`-only), fixing the `:5174` 404 (see the perf bullet above for the full note).
- **Map redesign to match the references:** Proving Grounds is a solid stepped pyramid (dark body within the centre floor so the flanking pits stay clear, tan tier walks, crenellated crown), chunky H-notched towers, and a long front beam drawn last. Skyline is a construction site: central crane mast + top plate + rope-hung crane swing, mirrored side scaffolds, and 3 rope-hung swing blocks. Both render close to `docs/design/map-1.png` / `map-2.png`.
- **Pillar = backdrop (not solid):** the dark shapes (pyramid body, scaffold posts, crane mast) are visual-only — `collidablePlatforms()` filters `kind === "pillar"` out of the collision list, so only `frame` walls + walkable `block`s collide. This fixes a level bug where a front walkway was blocked by the pyramid body (map 1) and scaffold posts boxed the player in (map 2). Slope steps were raised above the beam lane and the Skyline spawn moved clear of a beam block so both maps traverse cleanly (verified: PG beam walked end-to-end, Skyline moves freely both directions).
- **Swing blocks react to explosions:** `explosionImpulseSwing` shoves every nearby wired/swing block away from a blast (radial angular + bob kick scaled by proximity and blast size), so they now react to players, bullets, **and** explosions (grenades + BLAST bullets).
- **Buckshot+blast perf:** a tight cluster of exploding pellets merges into one blast (absorb neighbours within 56 px of the first impact instead of spawning a full explosion per pellet); `explode()` scales particle counts by blast radius; `burst()` stops at `PARTICLE_CAP` (500→320) instead of push-then-splice; the renderer batches particle draws (one `lighter` pass) and skips alpha ≤ 0.02. Steady 60 FPS with the combo + grenades in a live stress test (min instant 59.5, particles peak ≈78).
- **Hit-stop stutter fix (the real "combo lag"):** `explode()` used to set `world.hitStop` on **every** blast, so a buckshot spread against an empty wall froze the whole sim ~0.084 s per shot (measured **23% of wall-clock** frozen during continuous fire). Hit-stop is now applied only when a blast actually connects with a player (`connected`), and both `explode()`/`applyDamage` only renew the beat once the previous one has decayed below 0.02 s — so a steady stream of hits reads as crisp accents, not a frozen screen. Measured: wall-only fire **0%** frozen (was 23%), a real 4-player firefight **1.1%** (was 15%), still 60 FPS at the 320-particle cap. Profiling confirmed sim (~3% of a core at 4 players) and snapshot serialize/apply (0.7 ms/s) were never the bottleneck — hit-stop was.
- **Create-room on any dev port:** `defaultServerAddr()` now uses `import.meta.env.DEV` to redirect **any** Vite dev port to the sibling `:8080` Colyseus host (it previously only handled `:5173`), so a dev server on `:5174` no longer POSTs to Vite and 404s (`http://localhost:5174/matchmake/create/lobby` → now `:8080`, 200). Production still uses `window.location.origin`.
- **Swing = rope (slack + no jolt):** the pendant swing blocks are now a rope model instead of a spring: `bob <= 0` is rope slack (block rises toward the anchor), `bob = 0` is taut, gravity pulls the block down and the rope catches it **inelastically** at 0 (no spring, no bounce, no stretch). Head-bump is **edge-triggered** (per-swing `headBumpers` Set) so holding jump into a block doesn't re-kick it every tick (the old continuous re-kick caused the erratic jolt); the kick runs before rope integration so the block moves the same tick. The renderer draws the rope as a sagging quadratic curve when slack. Traced: a jump under the dangle-left block pops `bob` to −24.9 then returns to 0 with exactly **1 zero-crossing** (no oscillation); holding jump for 200 ticks gives **0** large bob deltas (no jolt). `SWING_HEAD_PUSH` 0.22→0.4, `BOB_MIN` −30→−60; the old spring constants are marked legacy. Verified in-browser: the block pops cleanly and the rope visibly slackens (screenshot).
- **Guest join rendered the local training sim (fixed):** `connectLan()` never set `mode`, so a guest who joined via share link (auto-join) or code kept `mode === "training"`; when the match started the game screen fell through to `<GameCanvas>` (local training sandbox with bots) instead of `LanGame`. `connectLan` now calls `setMode("lan")`, so the authoritative LAN match renders for guests too. Verified: a guest joining by share link renders `mode:"match"` with the live players and sees the host move authoritatively.
- **Esc couldn't leave a LAN room (fixed):** the Esc handler returned early for `mode === "lan"`, so Esc was a no-op in the LAN lobby and in-match. A dedicated LAN Esc handler now disconnects and returns to the menu (same as the Menu button) from either the lobby or an in-progress match; it yields while a loser-card-pick overlay is up. Verified: guest Esc leaves the match to the menu.
- `pnpm check:e2e:lan` 2-browser flow (create room → code → guest joins → start → both playing → host moves, guest sees same x; 0 errors).
- 49 sim tests (movement, pits, combat, cards, arena layouts, net serializer/interpolate/decay, swing physics + explosion reaction, team hostility + round scoring, loser card pick, buckshot cluster merge).
- **Skyline redesign:** narrower pit (x700–900) with a central tower + crown and pendant swing platforms held by strings. `SwingPlatform`/`stepSwingPlatforms` make them deterministic pendulums with a **rope** model (see the rope bullet above): gravity restore, standing-player push, edge-triggered head-bump (jump up into a block → it pops up and the rope slackens), and bullet hits (shots kick the block along their travel direction), plus damping and clamps. They sway on contact and are rebuilt into `platformList` each tick so players/shots collide with their live position. Drawn with strings in the renderer + preview silhouettes.
- **Movement/feel:** `GROUND_ACCEL` 16→24 and `AIR_ACCEL` 5→9 (less inertia); canvas `object-fit: contain` (letterbox-aware pointer mapping) so the full 1600×720 map fits the viewport width and no player is cropped at the edges.
- **Movement inertia (tuned):** the exponential approach used the same `accel` to both start and stop, so releasing the key left the character sliding. Now `GROUND_ACCEL` 24→34 and `AIR_ACCEL` 9→16 (faster ramp to max speed), and a **stronger friction** (`GROUND_FRICTION` 44 / `AIR_FRICTION` 24) applies when there's no input so the character brakes crisply instead of drifting. Measured: ground reach-max 217ms→133ms, stop 217ms→83ms, slide 8px→1.9px; air reach-max 317ms→183ms, stop 383ms→83ms. In-browser: vx ramps to 320 in ~90ms and decays to 0 in ~60ms.
- `pnpm check:e2e:lan` 2-browser flow (create room → code → guest joins → start → both playing → host moves, guest sees same x; 0 errors).
- 27 sim tests (movement, pits, combat, cards, arena layouts, net serializer/interpolate/decay, swing physics, team hostility + round scoring).

Not yet: full multi-round LAN completion + real-LAN feel (playtest), 1v2/1v3 team HP bonus, per-round card progression (the 1v1 loser offer ships, but team-match offers and a full per-round progression are later), latency harness, client prediction, final balance, audio.

---

## 8. Next step

Owner plays a full multi-round LAN match on real hardware (2–4 browsers, host + guests, bot takeover, rematch). If LAN feel is acceptable on wired/Wi-Fi, Phase 4 adds mode/team picks, card offers, and client prediction before card balance.

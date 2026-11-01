# 04 — Roadmap

> **Status:** Phase 3 implemented (Colyseus LAN host, lobby, authoritative match), plus a post-Phase-3 UX batch: no pointer lock (absolute aim), Esc pause/settings overlay, 3 modes (Training / Vượt ải with level-select / LAN), map previews, 1600×720 arenas with `PLAYER_RADIUS=16`, and two distinct arena layouts + palettes. Owner approved Phase 1 feel and Phase 2 match mode. Remaining playtest: full multi-round LAN completion + real-LAN feel before Phase 4.
> **Estimate:** ~11–17 engineer-weeks for one developer at ~30–35 focused hours/week.
> **Target:** 2–4 player LAN shooter, two arenas, pistol-only combat with card emulation, grenades, bots, optional 1v1 cards.

---

## 1. Phases

| Phase | Name | Estimate | Gate |
|---|---|---|---|
| 0 | Documentation | 0.5 week | Owner approval |
| 1 | Foundation + vertical slice | 2–3 weeks | Feel/readability |
| 2 | Local 2–4 combat + bots | 2–3 weeks | Fun local match |
| 3 | LAN multiplayer | 3–4 weeks | Stable LAN feel |
| 4 | Modes, bots, cards | 1–2 weeks | Mode/card quality |
| 5 | Content + polish | 1–2 weeks | Finished-feeling build |
| 6 | LAN beta + hardening | 1 week | Stable sessions |
| 7 | Release | 0.5–1 week | Clean-machine host |

Estimates are ranges, not commitments.

---

## 2. Phase 0 — Documentation

**Goal:** Agree on scope, art, stack, and the first slice before production code.

- [x] Core game design.
- [x] Owner-built art direction.
- [x] Technical architecture.
- [x] Roadmap, tests, release plan.
- [x] Reference demo reviewed.
- [x] Old asset research and decision log removed.
- [x] No production code, package install, or external asset added.

Exit criteria:

- [x] Owner approves 2–4 player LAN scope.
- [x] Owner approves self-built art direction.
- [x] Owner approves stack.
- [x] Owner approves Phase 1 slice.

**Gate:** Do not start Phase 1 until all four are explicit. (Approved; Phase 1 is in progress.)

---

## 3. Phase 1 — Foundation + vertical slice

**Goal:** Prove movement, shooting, grenades, VFX, and the art pipeline locally.

Scope (implemented):

- pnpm workspace, TypeScript, Vitest.
- `apps/web`: Vite + React + Canvas 2D renderer + menu/HUD/card/shop/deck UI.
- `packages/sim`: fixed-step loop, movement, jump, wall climb/jump, circle-vs-AABB collision, combat, multi-bot.
- Weapon/map/card data inside `packages/sim`.
- Training (1 human + 1 Normal bot sandbox) and Bot Gauntlet (waves, coins, shop, skins).
- Two-arena pool (Proving Grounds, Skyline), selectable pre-match.
- Pistol-only combat; shotgun/SMG emulated via cards; grenade.
- Owner-authored fighter, weapons, arenas, VFX.
- Health, damage, hit flash, knockback, death, K.O.; gauntlet waves with shop and skin unlocks.
- 13-card catalog across Projectile / Combat / Defense / Movement / Passive; pick 1 of 3.
- Deck panel shows owned/unseen cards; bullet/grenade muzzle clamped against walls.
- Full-viewport map, no vitality block UI; absolute mouse aim (no pointer lock); Esc opens a pause/settings overlay.
- Debug overlay: FPS, tick, position, wall, bots, FX.
- Unit tests for movement/collision/combat/cards/bullet-path; deterministic replay test.
- Visual smoke test at 1440×900 via Playwright.

Non-goals: LAN, lobby, teams, rounds, 2–4 match flow, final card balance, audio.

Exit criteria:

- [x] `pnpm dev` runs from a clean checkout.
- [x] Movement feels responsive at 60 fps; no stuck/tunneling bugs (owner playtest).
- [x] Pistol/cards/grenades behave; no wall-clipped shots; sim tests pass; browser fire/K.O. verified.
- [x] Fighter reads at gameplay scale; four-color mock is distinguishable.
- [x] VFX match the demo and stay under the particle cap.
- [x] Deterministic replay passes.
- [x] Gauntlet wave/coin/shop/skin flow works; Esc opens the pause overlay.
- [x] Short recording demonstrates the slice (owner playtest).

**Gate:** Fix movement or art pipeline before Phase 2. Do not build modes on a bad core.

---

## 4. Phase 2 — Local 2–4 combat + bots

**Goal:** A complete local match with 2–4 slots, modes, rounds, bots, scoring — no network.

Phase 2 delivered the local match flow (1 human vs 1–3 bots, first-to-N, sim-driven rounds). The local Match mode has since been removed: LAN (Phase 3) covers multi-human, and the Gauntlet is entered through a level-select. Real 2v2/team matches with multiple humans need LAN (Phase 3); FFA was removed (4 players = 4 teams).

Scope (implemented):

- Round flow: countdown → playing → round end → score → next round → match end, all sim-driven (LAN + local).
- Round award: last side alive scores; bots respawn each round with scores kept.
- Health, damage, death (including pit fall-death) resolve each round.
- Server-side bots: Easy/Normal/Hard; same `InputCommand` pipeline.
- HUD: score on both fighter cards, round number + first-to target, READY / round-result / match-end banners, Rematch overlay.
- `C` (cards) is a Training/Gauntlet tool.
- Sim tests for the round flow; Playwright smoke drives Training + Gauntlet (level-select) to completion.

Deferred to Phase 3 (LAN): 2v2/1v2/1v3 with multiple humans, team hostility/friendly-fire, underdog HP, spawn sets per mode, overheat. FFA was removed (a 4-player free-for-all is just 4 teams).

Non-goals (Phase 2): LAN, real multi-human modes, full card progression, final menus/audio.

Exit criteria:

- [x] 1 human vs. 1 Normal bot is useful (owner playtest — owner approved Phase 2).
- [x] Round flow completes: countdown, round award, next round, match end, rematch.
- [x] Bot difficulty (Easy/Normal/Hard) is selectable and fed to the sim.
- [x] Sim tests pass for the round flow; Playwright smoke passes with no console errors.
- [x] 1v2/1v3 vs bots feel balanced (owner playtest — owner approved Phase 2).
- [x] All guns/grenades behave; no collision/cooldown exploits (sim tests + e2e).
- [ ] 60 fps with 1 human + 3 bots + VFX.
- [x] Playtest #1 top three feel problems documented (owner-approved Phase 2 gate).

**Gate:** Is the core fight fun? Tune before networking.

---

## 5. Phase 3 — LAN multiplayer

**Goal:** 2–4 browsers on one LAN complete a match through the host process.

Scope (implemented):

- `apps/server`: Colyseus **0.16** (core 0.16.26 + ws-transport 0.16.5) + Express static serving, run via `tsx`.
- **Deviation:** the roadmap said Colyseus 0.18, but 0.18 has no published client SDK (`colyseus.js` tops out at 0.16.22) and its handshake is incompatible — so the matched, pinned **0.16** line is used. Documented in `03-technical-architecture.md`.
- One process serves the built client + WebSocket on one port (`pnpm host` → `http://<host-ip>:8080`; `/health` + SPA fallback).
- Single `GameRoom`: lobby (four slots, host = first client, host controls bot count/difficulty/target/arena, ready/start) → match (authoritative sim, snapshots, round events, rematch).
- Sim 60 Hz via fixed-step accumulator (Colyseus passes deltaTime in ms → convert to s); client input up to 60 Hz; snapshots broadcast at 30 Hz.
- **No prediction/reconciliation yet** — the client renders authoritative snapshots with 50 ms interpolation and local effect decay; LAN latency makes this acceptable. Prediction is a Phase 4+ follow-up (the sim's `InputFrame`/`seq` is already shaped for it).
- Bot takeover on disconnect (`isBot`/`botControlled`; `createBotInput` creates the brain lazily); no pause/reconnect.
- Host disconnect mid-match: host controls off until the match ends; host slot becomes bot-controlled.
- Shared wire protocol (`MSG` + `LobbyState`/`MatchStart`/`MatchEvent`/`NetInput`) in `packages/sim/src/protocol.ts`; snapshot serializer (`serializeWorld`/`applySnapshot`/`createRenderWorld`/`decayEffects`/`interpolateSnapshots`) in `packages/sim/src/net.ts`.
- `createWorld({humanCount})` distributes humans across the first spawn points, bots across the rest.
- 2-browser Playwright LAN e2e (`pnpm check:e2e:lan`): connect → lobby (1 host + 2 guest + open slots) → host start → both reach playing → host moves and the guest sees the host at the same x. 0 errors.
- **Playtest #2 on real LAN is still to do** (full multi-round completion + real-LAN feel).

Non-goals: public internet, accounts, reconnect, Redis, multi-host, anti-cheat beyond authority. Also not in Phase 3: LAN card offers, latency harness.

Exit criteria:

- [ ] 1v1, 2v2 complete on LAN. *(2-browser flow works; 4-browser + real-LAN pending; FFA removed — 4 players = 4 teams)*
- [ ] 1v2/1v3 complete with correct teams and HP bonus. *(multi-human works; team hostility/HP bonus deferred)*
- [x] Human + bot match completes. *(2 humans + 1 bot reach playing and sync in e2e)*
- [x] Guest/host disconnect triggers bot takeover; match continues. *(server `onLeave` bot takeover; e2e-level)*
- [x] Local movement immediate; remote movement smooth. *(host move 240→415, guest sees x=415; interpolation)*
- [x] No persistent desync. *(authoritative snapshots + deterministic sim; e2e sync)*
- [ ] Host tick p95 < 4 ms with 4 players + 20 projectiles. *(not measured)*
- [ ] Playtest #2 issues documented. *(real-LAN playtest pending)*

**Gate:** Is LAN feel acceptable on wired/Wi-Fi? Full multi-round LAN completion + real-LAN feel before cards.

---

## 6. Phase 4 — Modes, bots, cards

**Goal:** Make every mode intentional and add the optional 1v1 card layer.

Scope:

- Tune 1v2/1v3 HP, spawn fairness, solo strategy.
- Tune 2v2/3-way/4-way readability and team pacing.
- Bot tuning: target selection, spacing, grenades, difficulty curve.
- Bot takeover quality.
- 13 cards: BLAST, BOUNCE, RAPID, BUCKSHOT, PIERCE, MEGA, FRAG, NITRO, VITAL, PLATE, DASH, SPRING, FORTUNE.
- Loser picks 1 of 3 after a scored 1v1 round.
- Host-validated offers; 20 s timeout auto-pick.
- Card UI: offer, hidden opponent state, match-long display, deck panel.
- Card effects: fire rate, spread, bounce, explosion, pierce, grenade cooldown/radius, HP, damage reduction, move/jump/climb, coin bonus.
- Rematch flow.
- Playtest #3: mode mix + cards.

Non-goals: cards outside 1v1, rarity/lore/collection/economy beyond the gauntlet.

Exit criteria:

- [ ] All modes selectable/completable from lobby.
- [ ] Bot difficulties feel different.
- [ ] Loser gets 1 of 3 offers in 1v1; winner none.
- [ ] Offers hidden from opponent.
- [ ] Every card matches text; host-authoritative.
- [ ] Timeout auto-picks; disconnect during pick continues.
- [ ] Full first-to-3 1v1 with cards completes on LAN.

---

## 7. Phase 5 — Content + polish

**Goal:** Make the MVP feel finished.

Scope: final character/arena/VFX pass; optional project-generated SFX; landing/LAN join/lobby/settings/credits; key remap, volume, crosshair, shake, reduced motion, colorblind, UI scale; onboarding; result/rematch; 720p–1080p layout; accessibility; playtest #4.

Non-goals: accounts, ranked, cosmetics, monetization, mobile, second arena, music, localization.

Exit criteria:

- [ ] Screenshots and motion look intentional.
- [ ] Settings work and persist locally.
- [ ] Colorblind/reduced-motion checks pass.
- [ ] HUD legible at 720p/1080p.
- [ ] Load/frame budgets met.
- [ ] No placeholder art in MVP path.
- [ ] No external asset/font requests.
- [ ] Playtest #4 issues triaged.

---

## 8. Phase 6 — LAN beta + hardening

Scope: 5+ LAN sessions; wired/Wi-Fi matrix, AP isolation, firewall, sleep/power; 4-slot headless soak; security review; netcode matrix; browser matrix; bug bash; release checklist.

Exit criteria:

- [ ] 20+ LAN matches, no critical desync.
- [ ] 2-hour host soak, <10% memory growth.
- [ ] No P0/P1 security issues.
- [ ] Error rate <1% of sessions.
- [ ] Four-player sessions on wired and good Wi-Fi.

---

## 9. Phase 7 — Release

Scope: production build; `pnpm host`/start script; LAN IP/port output; README with setup/firewall/join; version + `/health`; credits; optional zip; no cloud/domain/TLS/monitoring; hotfix process.

Exit criteria:

- [ ] Clean machine installs, builds, hosts from README.
- [ ] Four players join via LAN IP and complete a match.
- [ ] Host survives a full evening.
- [ ] No unresolved P0.
- [ ] Credits complete.

---

## 10. Tests and risks

**Tests:** unit sim (movement, collision, weapons, grenade, cards, rounds, overheat); determinism replay; integration (lobby, teams, bot fill/takeover); E2E (4-browser team match, 2v2, solo bot, card pick); LAN (2–4 machines, 5–100 ms, loss/jitter); performance (60 fps, host tick); manual playtests #1–#4.

| Risk | Impact | Mitigation |
|---|---|---|
| Movement/art feel wrong | High | Phase 1 gate |
| Four-player readability fails | High | Fixed camera, colors + badges, playtest |
| Netcode feels laggy | High | Interpolation + LAN matrix (prediction deferred to Phase 4+) |
| Bot quality poor | Medium | 3 difficulties, same input, tuning |
| Scope creep | High | One arena, 3 guns, 5 cards |
| Host CPU overload | Medium | 4-slot cap, particle cap, measure |
| Firewall/AP isolation | Medium | Setup guide, health check |
| Burnout | High | Phase gates, honest estimates |

---

## 11. Done and status

A phase is done only when scope is implemented, acceptance criteria are demonstrated, tests pass, no P0/P1 bugs are open, docs are updated, a build/recording exists, and the owner approves moving on.

**Current:** Phase 3 implemented, plus a post-Phase-3 UX batch. Owner approved Phase 1 feel and Phase 2 match mode. `apps/server` is a Colyseus 0.16 LAN host (static client + WebSocket on one port via `pnpm host`); `GameRoom` covers lobby → match (4 slots, host controls, bot fill/takeover, rematch); sim is authoritative at 60 Hz with 30 Hz snapshots and 50 ms client interpolation (no prediction yet). Pointer lock is removed (absolute aim); `Esc` opens a pause/settings overlay; the local Match mode is gone (3 modes: Training, Vượt ải/Bot Gauntlet with a level-select, LAN); map previews render in the menu, lobby, and level-select; both arenas are now 1600×720 with `PLAYER_RADIUS=16` and distinct layouts + palettes (Proving Grounds teal pyramid; Skyline dark rust towers). 19 sim tests pass (movement, collision, combat, cards, bullet-path, pits, deterministic replay, round flow, net serializer/interpolate/decay). `pnpm check:e2e` covers Training, Gauntlet (level-select → level 1), and the Esc pause overlay with no console errors; `pnpm check:e2e:lan` covers a 2-browser LAN flow (connect → lobby → host start → both playing → host moves, guest sees the same x) with no console errors. Next: owner playtest of a full multi-round LAN match on real hardware before Phase 4.
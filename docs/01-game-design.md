# 01 — Game Design

> **Status:** Phase 3 LAN implemented (2–4 browsers on one LAN complete an authoritative match via the host). A UX batch removed pointer lock (absolute aim), added an Esc pause overlay, collapsed to 3 modes (Training / Vượt ải with level-select / LAN), added map previews, widened arenas to 1600×720 (`PLAYER_RADIUS=16`), split the two arenas into distinct layouts + palettes, and added real teams (2–4 sides; FFA removed) with swing platforms on Skyline. Per-round card picks remain later phases.
> **Scope:** 2–4 player LAN shooter, two-arena pool, one life per round, bots, optional 1v1 cards. Phase 3 delivers LAN (multi-human + bots) for a shared first-to-N match; teams and the card layer are Phase 4+.

---

## 1. Concept

Two to four round-body fighters brawl on one fixed screen. Each round is short: move, aim, shoot, throw a grenade, use the arena, and be the last player or team alive. The host picks the mode; bots fill empty slots.

The MVP deliberately has **no shield, ammo, reload, pickups, respawn, or weapon switching**. Depth comes from movement, aim, the pistol, cards that mutate it into a shotgun/SMG/stranger, grenades, positioning, and the 1v1 card layer. Phase 1 adds a **Bot Gauntlet** mode (waves, coins, shop upgrades, skin unlocks) that is the only progression in the slice.

**Pillars:** readable chaos, fast rounds, one-more-round, LAN first, original art.

---

## 2. Match

| Rule | Value |
|---|---|
| Slots | 2–4 humans and/or bots |
| Life | One per round, 100 HP, no respawn |
| Round win | Last player/team alive |
| Draw | All remaining players die in the same tick; no score; replay |
| Pit death | Falling into a floor gap (void) kills instantly — no respawn |
| Match target | Host selects first to 3 or first to 5 |
| Overheat | At 75 s, escalating damage until the round ends |
| Round cap | None |
| Friendly fire | Off in team modes (all LAN matches are team-based; no FFA) |
| Spawns | Fixed per mode; no spawn invulnerability |

```text
Lobby → Countdown 1.6 s → Playing → RoundEnd 1.9 s
      → next round (or MatchEnd)
      → CardPick (1v1, scored round only; Phase 4)
```

A draw skips card selection and replays the round. The sim drives the LAN match (and the local gauntlet/training worlds): countdown freezes play until it elapses, a round ends when one side remains, the winner scores, a round-end banner shows, and the next round starts or the match ends when a side reaches the target. `C` (cards) is a Training/Gauntlet tool; the local Match mode was removed (LAN covers multi-human).

---

## 3. Modes

| Mode | Players | Teams | Notes |
|---|---|---|---|
| Training (Phase 1) | 1 human + 1 bot | None | Sandbox; cards via `C`; feel-testing |
| Bot Gauntlet (Phase 1) | 1 human + bots | None | Level-select (6 levels, escalating difficulty, all open); waves escalate; coins → shop upgrades; skins at waves 3/5/8 |
| Team (Phase 3 LAN) | 2–4 | 2/3/4 sides | Lobby columns; friendly fire off; removed FFA (a 4-player "free-for-all" is just 4 teams) |
| Duel | 2 | 1v1 | Cards enabled (Phase 4) |
| Team | 4 | 2v2 | Friendly fire off (Phase 3 LAN) |
| Asymmetric | 3 | 1v2 | Solo player +50 max HP (Phase 3 LAN) |
| Asymmetric | 4 | 1v3 | Solo player +100 max HP (Phase 3 LAN) |

- No 3-team mode in MVP.
- Team sizes must sum to the occupied slot count.
- The solo player starts on the right side.
- Bots occupy real slots.
- Gauntlet rewards scale with wave and `FORTUNE` adds +25% coins.

---

## 4. Controls

| Input | Action |
|---|---|
| `A`/`D` or `←`/`→` | Move |
| `W`, `↑`, or `Space` | Jump |
| Into wall + hold jump | Wall climb (stamina-limited; tap jump to wall-jump) |
| Mouse | Aim |
| Hold left mouse | Shoot (pistol) |
| Right mouse or `G` | Grenade |
| `C` | Cards (sandbox / shop pick) |
| `Esc` | Pause/settings overlay (Resume / Menu) |
| `R` | Reset sandbox (Phase 1) |
| `F1` | Debug overlay |

Keyboard + mouse only. One human per browser; no split-screen. The mouse aims absolutely across the arena (no pointer lock); `Esc` opens the pause/settings overlay in local modes.

---

## 5. Combat

### Health

- 100 max HP, no regeneration, no shield.
- No headshots.
- Horizontal knockback is part of the simulation.
- Hit feedback: short hit-stop, white flash, spark, damage number, small camera kick.

### Weapons

The **pistol is the only weapon** — no ammo or reload. Cards emulate the shotgun and SMG rather than granting separate guns.

| Weapon | Damage | Rate | Speed | Spread | Role |
|---|---|---|---|---|---|
| Pistol | 12 | 0.28 s | 1000 px/s | 0.02 | Precise default |
| Pistol + `BUCKSHOT` | 12 × 7 | ×1.25 slower | 1000 px/s | +0.20 | Close range (shotgun) |
| Pistol + `RAPID` | 12 | ×0.6 faster | 1000 px/s | 0.02 | Sustained pressure (SMG) |

Bullets collide with platforms and players. Recoil pushes the shooter; buckshot pushes more. The host resolves all hits. Bullet and grenade spawn points are clamped against walls so shots never originate inside a platform.

### Grenade

| Property | Value |
|---|---|
| Fuse | 1.7 s |
| Body radius | 14 px (small ball) |
| Blast radius | 135 px (+45 with `NITRO`) |
| Damage | 45 center, falls off (+15 with `NITRO`) |
| Cooldown | 1.2 s (0.5 s with `FRAG`) |
| Throw | Toward cursor; bounces off platforms |

### Overheat

After 75 s, all living players take escalating damage until a winner remains. This prevents stalemates.

---

## 6. Cards

- After a scored round, the **loser** picks 1 of 3 cards (Phase 2+).
- Winner gets nothing; no card after a draw.
- One copy per player; effects last the match.
- Offers are host-authoritative and hidden from the opponent.
- 20 s timeout; auto-pick the first card.
- No cards in 2v2, 1v2, or 1v3 (team LAN matches).
- Phase 1 sandbox: player picks 1 of 3 freely with `C` to test feel. Gauntlet buys upgrades from the shop and draws a random card.
- Deck panel shows every card and which are owned vs. unseen.

### 13-card catalog by category (source: `references/card-catalog.md`)

| Card | Category | Effect |
|---|---|---|
| **BLAST** | Projectile | Bullets explode on impact; blast pushes the shooter too |
| **BOUNCE** | Projectile | Bullets ricochet off walls twice |
| **RAPID** | Projectile | Fire rate ×1.7 (SMG feel) |
| **BUCKSHOT** | Projectile | +6 pellets, wider spread, slower fire (shotgun feel) |
| **PIERCE** | Projectile | Bullets pass through one enemy |
| **MEGA** | Projectile | +4 bullet damage |
| **FRAG** | Combat | Grenade cooldown 0.5 s |
| **NITRO** | Combat | +45 blast radius, +15 grenade damage |
| **VITAL** | Defense | +30 max HP |
| **PLATE** | Defense | -25% damage taken |
| **DASH** | Movement | +22% move speed |
| **SPRING** | Movement | +12% jump, +25% climb |
| **FORTUNE** | Passive | +25% gauntlet coins |

No rarity, lore, collection, or card art pack.

---

## 7. Bots

- Server-side; Easy, Normal, Hard.
- Same `InputCommand` pipeline as humans.
- Fill empty slots; take over disconnected humans.
- No pause, no reconnect in MVP.
- Read only authoritative state; no hidden information.
- Deterministic under a fixed seed.
- Phase 1 training preset: 1 human + 1 Normal bot in a sandbox; cards are available via `C` for feel-testing. Gauntlet waves spawn one bot per wave and escalate.
- Phase 2 Match preset was 1 human vs 1–3 bots; the local Match mode is now removed (LAN covers multi-human). The Gauntlet is entered through a level-select with 6 levels (Easy→Hard, 1→3 bots, arenas alternating), all open for now.

---

## 8. Arena and HUD

**Arena pool:** two distinct 1600×720 arenas, selectable pre-match, each dense enough that wall-climbing matters: **Proving Grounds** (teal background, tan platforms, a crenellated castle on a central stepped pyramid, symmetric stepped side platforms, tall side towers) and **Skyline** (dark background, rust/red platforms, two symmetric stepped tower clusters flanking a wide central pit). Each has a **segmented floor with deadly pits (voids)** between the segments and tall side structures. Falling into a pit drops you out of the arena and kills you. Fighters (radius 16) are small relative to the wide map so 2–4 players have room. Each arena carries its own palette (background + platform colors); the renderer reads it from `ArenaDefinition.palette`. Spawn sets for every mode. The map renders full-viewport with `object-fit: cover`.

**HUD:**

- Top: mode, round, score, timer, alive/out state.
- Top-left/top-right: compact player HP bars (large vitality block removed).
- Bottom left: deck panel (owned vs. unseen cards).
- No weapon panel (pistol-only; grenade/cooldown are omitted from the HUD).
- Player chips: color, badge, name, `BOT`/`HOST` tag.
- Team modes: team score, teammate HP, solid/dashed team markers.
- Banners: countdown (`READY` + round number), `ROUND` result (`takes it` + score), match end, `OVERHEAT`, `K.O.`, `DRAW`, `WAVE CLEAR`, `GAUNTLET OVER`.
- LAN match: score shown on both fighter cards (e.g. `Score 2 / 3`); round number and first-to target in the mode line; match-end overlay with host-only Rematch.
- Cards: hand, offer overlay, opponent “choosing…” state.
- Gauntlet: coins, wave, shop overlay, game-over overlay.

---

## 9. MVP cuts

No shield, ammo, reload, pickups, respawn, 3-team mode, split-screen, public online, accounts, ranked, reconnect, spectator, replays, mobile, or external art/audio packs. Weapon switching is removed; cards provide shotgun/SMG feel.

These are post-MVP candidates, not hidden scope.

---

## 10. Acceptance

- Full 4-player team match (2v2) complete; FFA removed (4 players = 4 teams).
- 1v2/1v3 apply the correct HP bonus.
- 1 human vs. 1 Normal bot is useful.
- All guns/grenades behave; no collision/cooldown exploits.
- Overheat ends stalls; draws replay.
- Full 1v1 with cards completes; offers are hidden and host-validated.
- Four players readable at 1600×720; 60 fps with VFX.
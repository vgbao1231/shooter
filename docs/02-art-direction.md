# 02 — Art Direction

> **Status:** Target direction from the owner-built demo.
> **Rule:** Characters, weapons, arena, cards, VFX, UI, and audio are owner-built. No external art/audio assets.

---

## 1. Visual thesis

**A dark, toy-like proving ground with soft round fighters and hard graphic violence.**

The arena is quiet and geometric. Fighters are colorful and expressive. Guns are chunky. Bullets are bright lines. Impacts are sharp sparks and paper-like debris. The demo at [ROUNDS-style demo.html](references/ROUNDS-style%20demo.html) is the reference, not final art.

Preserve from the demo:

- 1600×720 side view; arenas are distinct layouts (not mirrored).
- Round body, two large eyes, readable mouth.
- Noodle arms/legs with springy motion.
- Eyes following aim; squash/stretch on jump/land.
- Recoil, knockback, hit flash, short hit-stop.
- Muzzle flash, tracers, sparks, dust, debris, screen shake.
- Angular cards with colored glow.
- Dark arena, saturated platforms and effects.

---

## 2. Character

- **Body:** one round/gumdrop mass; no separate torso/head.
- **Face:** white eyes, dark pupils, simple brows, small mouth; eyes track aim.
- **Limbs:** four noodle limbs; arms hold the gun, legs run and dangle.
- **Weapon:** front hand, rotates to aim, flips when facing left.
- **Hit:** white flash, squash, damage number, knockback.
- **Death:** flatten/roll, X eyes, ink splat; no gore.
- **Size:** 170–200 px tall at 1600×720; tune in Phase 1.

Four player colors, each with a badge:

| Slot | Color | Badge |
|---|---|---|
| P1 | Blue `#4da3ff` | Circle |
| P2 | Orange `#ff9b3d` | Triangle |
| P3 | Green `#8be04e` | Square |
| P4 | Purple `#c78bff` | Diamond |

Bots get an antenna + `BOT` tag. Host gets `HOST`. Team modes use solid vs. dashed rings/brackets, not color alone.

---

## 3. Arena

- Background gradient: `#14444b → #0a1b27`.
- Platforms: `#ff4f8b → #ff8a5b`.
- Pillars/cover: `#7a3f34`.
- Void/edges: `#061018`; ink: `#0b0b12`.
- Soft diagonal shadows; brush-like platform streaks, not photo textures.
- Mirrored layout; no tile-set identity.
- Background low-contrast; gameplay shapes crisp.
- Dense, frame-filling structures; the map is large relative to the fighter so climbing reads clearly.
- Two arenas for MVP: Proving Grounds (crenellated castle on a stepped pyramid) and Skyline (central spire, wide base, corner towers); both share the palette, differ in silhouette.

---

## 4. Weapons

Flat vector shapes with dark outlines:

| Weapon | Color | Silhouette |
|---|---|---|
| Pistol | `#9a9ab0` | Short slide, small grip |
| Grenade | `#4b5a3a` | Round body, fuse, blinking light |

The pistol is the only drawn weapon; shotgun/SMG silhouettes are not used (cards mutate the pistol instead). Card accents borrow the old weapon colors (`#b8895c`, `#7aa6bd`). Clear grip and muzzle sockets. No realistic military detail. No external weapon art.

---

## 5. VFX

Simple shapes, short lifetimes, capped:

| Effect | Treatment |
|---|---|
| Muzzle flash | Yellow/white spike + smoke puff, ~70 ms |
| Tracer | Player-color line + white core, ~80 ms |
| Impact | 9–15 sparks + ring, ~140–220 ms |
| Dust | 3–8 soft circles, ~220 ms |
| Debris | Small rects/circles with gravity |
| Explosion | Orange rings, fire, smoke, debris, shake |
| Damage number | Yellow `-N`, floats and fades |
| Hit flash | White body flash, ~120 ms |
| Death | Ink splat + X eyes, no gore |
| Overheat | Red/orange rim pulse + label |

Particle cap ~500. No bloom, lens flare, motion blur, or screen-filling smoke. Shake and hit-stop are cosmetic/client-side.

---

## 6. Cards and UI

**Cards:** 200×300 px, angular cut corners, dark navy face, colored border/glow, simple face icon + abstract symbol, heavy title, 2–3 effect lines (green/red). 13 cards across Projectile/Combat/Defense/Movement/Passive. Built in React/CSS/SVG; no card art pack.

**HUD:** dark ink panels, paper text, player-color chips. Top: mode/round/score/timer. Top-left/right: compact HP bars (no large vitality block). Bottom left: deck panel. Bottom right: weapon + grenade cooldown. Bot/host tags. Large short banners. No UI covering the arena.

**Typography:** system stack `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. The demo loads Lilita One from Google Fonts for convenience; that is prototype-only. No external font requests in production; self-host a licensed font only after approval.

---

## 7. Palette

| Token | Value | Use |
|---|---|---|
| `ink` | `#061018` | Void, outlines, shadows |
| `arena-top` | `#14444b` | Background top |
| `arena-bottom` | `#0a1b27` | Background bottom |
| `platform-a` | `#ff4f8b` | Platform start |
| `platform-b` | `#ff8a5b` | Platform end |
| `pillar` | `#7a3f34` | Cover |
| `paper` | `#e8e6df` | Light text |
| `muted` | `#9a9aa6` | Secondary text |
| `p1` | `#4da3ff` | Player 1 |
| `p2` | `#ff9b3d` | Player 2 |
| `p3` | `#8be04e` | Player 3 |
| `p4` | `#c78bff` | Player 4 |
| `muzzle` | `#ffd57a` | Muzzle/impact |
| `damage` | `#ffe27a` | Damage text |
| `danger` | `#ff5a4d` | Overheat/negative |

At most four player colors plus one effect hue on screen. Backgrounds stay desaturated.

---

## 8. Asset policy

Allowed: owner-authored SVG, Canvas 2D, CSS, code-generated shapes, map/card data, system fonts, project-generated audio or none.

Not allowed: downloaded character/weapon/map/card/VFX/UI/audio packs, ROUNDS-extracted assets, paid packs, traced ROUNDS characters, external font requests in release.

All art is versioned as source (SVG/TS/CSS), not as an opaque downloaded pack.

---

## 9. Readability gates

- Silhouette: facing, aim, weapon, HP readable in black.
- Grayscale: four players and two teams distinguishable.
- Four-player test: find self, teammate, enemies in <1 s.
- Squint test at 50%; motion test at 30/60 fps.
- Originality test: not a traced ROUNDS character.
- No-network test: release makes zero external asset/font requests.

These are Phase 1–2 gates, not claims about the demo.
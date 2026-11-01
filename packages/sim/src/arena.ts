import type { Platform, SwingPlatform } from "./types";

export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 720;

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface ArenaPalette {
  backgroundTop: string;
  backgroundBottom: string;
  blockA: string;
  blockB: string;
  blockEdge: string;
  blockStrokeA: string;
  blockStrokeB: string;
  pillar: string;
  pillarShade: string;
  shadow: string;
}

export interface ArenaDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  platforms: Platform[];
  palette: ArenaPalette;
  swings?: SwingPlatform[];
  spawns: {
    player: SpawnPoint;
    bot: SpawnPoint;
    bots: SpawnPoint[];
  };
}

/** Current collision rect of a swing platform given its angle and bob. */
export function swingRect(
  def: SwingPlatform,
  angle: number,
  bob = 0,
  index?: number,
): Platform {
  const cx = def.anchorX + def.length * Math.sin(angle);
  const cy = def.anchorY + def.length * Math.cos(angle) + bob;
  return {
    x: cx - def.w / 2,
    y: cy - def.h / 2,
    w: def.w,
    h: def.h,
    kind: "block",
    ...(index !== undefined ? { swingIndex: index } : {}),
  };
}

/**
 * Two distinct 1600×720 arenas. Fighters (radius 16) are small relative to
 * the wide map so 2–4 players have room. Each arena carries its own palette
 * (background + platform colors) so the two maps read differently.
 *
 * Proving Grounds follows the reference demo's teal arena: a central stepped
 * pyramid with a crenellated castle peak, symmetric stepped side platforms,
 * two tall H-notched side towers, and a segmented floor with deadly pits.
 *
 * Skyline is a darker, lower arena: two symmetric stepped tower clusters on
 * either side of a wide central pit, rust/red platforms, no central structure.
 * Falling into any pit drops the player out of the arena and kills them.
 */

const mirrors = (platforms: Platform[]): Platform[] =>
  platforms.map((platform) => ({
    ...platform,
    x: ARENA_WIDTH - platform.x - platform.w,
  }));

// Walls + ceiling only. The bottom is open; the floor is segmented blocks
// with gaps (pits) so players can fall out and die.
const FRAME: Platform[] = [
  { x: 0, y: 0, w: 20, h: 720, kind: "frame" },
  { x: 1580, y: 0, w: 20, h: 720, kind: "frame" },
  { x: 0, y: 0, w: 1600, h: 20, kind: "frame" },
];

// --- Proving Grounds: teal arena, tan platforms, crenellated central pyramid.

const PG_PALETTE: ArenaPalette = {
  backgroundTop: "#1a4a5a",
  backgroundBottom: "#07131f",
  blockA: "#c9b9a1",
  blockB: "#8c7f6e",
  blockEdge: "rgba(255,244,225,.55)",
  blockStrokeA: "rgba(255,244,225,.16)",
  blockStrokeB: "rgba(58,48,34,.18)",
  pillar: "#101820",
  pillarShade: "rgba(0,0,0,.34)",
  shadow: "rgba(4,20,28,.22)",
};

const PG_FLOOR: Platform[] = [
  { x: 20, y: 688, w: 500, h: 32, kind: "block" }, // left floor 20-520
  { x: 1080, y: 688, w: 500, h: 32, kind: "block" }, // right floor 1080-1580
]; // one BIG central pit: x520-1080 (the pyramid sits in it, per the reference)

// A long continuous walkway in front of the pyramid (the reference map's wide
// beam near the bottom). It reads as a thin bridge crossing the pit safely; the
// pit still catches a careless step off its ends or a drop behind it.
const PG_BEAM: Platform[] = [
  { x: 140, y: 600, w: 1320, h: 20, kind: "block" },
];

// Big stepped ziggurat pyramid (the reference's dominant central mass). The
// dark body is a `pillar` backdrop; each tier top is a collidable `block` walk
// inset toward the centre, so from the side it reads as a staircase. Tiers are
// spaced ~92px vertically (well within a 185px jump) and never crowd a lane.
const PG_CENTER: Platform[] = [
  // Dark body (visual-only; the pit below stays a deadly drop). Extends down to
  // the floor line so the pyramid reads as rising out of the pit behind the beam.
  { x: 560, y: 440, w: 480, h: 248, kind: "pillar" }, // body base (440-688)
  { x: 620, y: 348, w: 360, h: 92, kind: "pillar" }, // body mid (348-440)
  { x: 680, y: 256, w: 240, h: 92, kind: "pillar" }, // body upper (256-348)
  { x: 720, y: 164, w: 160, h: 92, kind: "pillar" }, // body top (164-256)
  // Tier walks (collidable). Wide base inset toward the centre, well-spaced.
  { x: 560, y: 440, w: 480, h: 22, kind: "block" }, // tier 1 walk (top 440)
  { x: 620, y: 348, w: 360, h: 22, kind: "block" }, // tier 2 walk (top 348)
  { x: 680, y: 256, w: 240, h: 22, kind: "block" }, // tier 3 walk (top 256)
  { x: 720, y: 164, w: 160, h: 22, kind: "block" }, // tier 4 walk (top 164)
  // Crown (castle peak with a notch) — high, clear of tier 4 by 42px.
  { x: 730, y: 88, w: 140, h: 24, kind: "block" }, // crown base (top 88)
  { x: 736, y: 32, w: 44, h: 40, kind: "block" }, // crown tooth left
  { x: 820, y: 32, w: 44, h: 40, kind: "block" }, // crown tooth right
  { x: 736, y: 74, w: 128, h: 16, kind: "block" }, // crown connector
];

const PG_LEFT: Platform[] = [
  // A lone pit column between the tower and the pyramid, well-separated from
  // both (256px from the tower, 140px from the pyramid) so it never wedges a
  // player — it's a mid-pit hop platform, matching the reference's spaced blocks.
  { x: 350, y: 498, w: 70, h: 22, kind: "block" }, // column cap (top 498)
  { x: 360, y: 520, w: 50, h: 168, kind: "pillar" }, // column body (520-688)
  { x: 30, y: 260, w: 64, h: 428, kind: "block" }, // tower column (bottom 688)
  { x: 30, y: 190, w: 30, h: 70, kind: "block" }, // tower prong L
  { x: 64, y: 190, w: 30, h: 70, kind: "block" }, // tower prong R
  { x: 30, y: 260, w: 64, h: 22, kind: "block" }, // tower notch connector
];

export const PROVING_GROUNDS: ArenaDefinition = {
  id: "proving-grounds",
  name: "Proving Grounds",
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  platforms: [
    ...FRAME,
    ...PG_FLOOR,
    ...PG_CENTER,
    ...PG_LEFT,
    ...mirrors(PG_LEFT),
    ...PG_BEAM, // drawn last so the walkway sits in front of the pyramid
  ],
  palette: PG_PALETTE,
  spawns: {
    player: { x: 260, y: 584 }, // on the beam (top 600), clear of the column cap (350-420)
    bot: { x: 1340, y: 584 },
    bots: [
      { x: 1340, y: 584 },
      { x: 800, y: 148 }, // on tier 4 (top 164)
      { x: 460, y: 584 }, // on the beam, clear of the column cap (350-420)
      { x: 1160, y: 584 }, // on the beam, clear of the mirrored column cap (1180-1250)
    ],
  },
};

// --- Skyline: darker arena, rust/red platforms, two tower clusters + central pit.

const SKY_PALETTE: ArenaPalette = {
  backgroundTop: "#12333c",
  backgroundBottom: "#06141a",
  blockA: "#b98d5e",
  blockB: "#7a5533",
  blockEdge: "rgba(255,230,200,.5)",
  blockStrokeA: "rgba(255,230,200,.14)",
  blockStrokeB: "rgba(74,42,18,.2)",
  pillar: "#241610",
  pillarShade: "rgba(0,0,0,.4)",
  shadow: "rgba(2,10,14,.25)",
};

const SKY_FLOOR: Platform[] = [
  { x: 20, y: 688, w: 680, h: 32, kind: "block" }, // left floor 20-700
  { x: 900, y: 688, w: 680, h: 32, kind: "block" }, // right floor 900-1580
]; // central pit: x700-900 (narrower than before)

// Central crane tower: a tall mast with a fixed top plate (with a collar), a
// rope-hung platform that swings (see `swing.ts`), and two lower beams. Sits in
// the central pit so players must cross on the hanging platform or the side
// scaffolds.
const SKY_CENTER: Platform[] = [
  { x: 786, y: 200, w: 28, h: 488, kind: "pillar" }, // mast (top 200, bottom 688)
  { x: 750, y: 180, w: 100, h: 26, kind: "block" }, // top plate (top 180)
  { x: 768, y: 206, w: 64, h: 18, kind: "block" }, // collar below the top plate
  { x: 740, y: 420, w: 120, h: 26, kind: "block" }, // mid beam (top 420)
  { x: 740, y: 560, w: 120, h: 26, kind: "block" }, // lower beam (top 560)
];

const SKY_SIDE: Platform[] = [
  { x: 60, y: 280, w: 130, h: 26, kind: "block" }, // top platform (top 280)
  { x: 62, y: 234, w: 28, h: 46, kind: "pillar" }, // top platform post L (backdrop)
  { x: 160, y: 234, w: 28, h: 46, kind: "pillar" }, // top platform post R (backdrop)
  { x: 110, y: 306, w: 26, h: 382, kind: "pillar" }, // tall post (bottom 688)
  { x: 60, y: 440, w: 380, h: 26, kind: "block" }, // long mid beam (top 440)
  { x: 390, y: 466, w: 24, h: 90, kind: "pillar" }, // post under mid beam
  { x: 80, y: 570, w: 340, h: 26, kind: "block" }, // long low beam (top 570)
  { x: 200, y: 500, w: 30, h: 44, kind: "block" }, // block on low beam
];

// Blocks held by strings from the ceiling; a standing player, a shot, or a
// blast pushes them and they swing back under gravity (see `swing.ts`).
const SKY_SWINGS: SwingPlatform[] = [
  { id: "crane", anchorX: 800, anchorY: 20, length: 200, w: 110, h: 26 },
  { id: "dangle-left", anchorX: 330, anchorY: 20, length: 330, w: 44, h: 44 },
  { id: "dangle-right", anchorX: 1270, anchorY: 20, length: 330, w: 44, h: 44 },
];

export const SKYLINE: ArenaDefinition = {
  id: "skyline",
  name: "Skyline",
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  platforms: [
    ...FRAME,
    ...SKY_FLOOR,
    ...SKY_CENTER,
    ...SKY_SIDE,
    ...mirrors(SKY_SIDE),
  ],
  palette: SKY_PALETTE,
  swings: SKY_SWINGS,
  spawns: {
    player: { x: 280, y: 554 }, // on the low beam (top 570), clear of the block at x200-230
    bot: { x: 1380, y: 554 },
    bots: [
      { x: 1380, y: 554 },
      { x: 280, y: 424 }, // on the mid beam (top 440)
      { x: 600, y: 672 }, // left floor
      { x: 1000, y: 672 }, // right floor
    ],
  },
};

export const ARENAS: Record<string, ArenaDefinition> = {
  [PROVING_GROUNDS.id]: PROVING_GROUNDS,
  [SKYLINE.id]: SKYLINE,
};

export const ARENA_ORDER = [PROVING_GROUNDS.id, SKYLINE.id];

export function getArena(id?: string): ArenaDefinition {
  return (id && ARENAS[id]) || PROVING_GROUNDS;
}

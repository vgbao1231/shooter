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
  { x: 20, y: 688, w: 520, h: 32, kind: "block" }, // left floor 20-540
  { x: 600, y: 688, w: 400, h: 32, kind: "block" }, // center floor 600-1000
  { x: 1060, y: 688, w: 520, h: 32, kind: "block" }, // right floor 1060-1580
]; // pits: x540-600 and x1000-1060

// A long continuous walkway in front of the pyramid (the reference map's wide
// beam near the bottom). It reads as a thin bridge; the pits behind still catch
// a careless step off its ends.
const PG_BEAM: Platform[] = [
  { x: 140, y: 600, w: 1320, h: 20, kind: "block" },
];

// Solid stepped pyramid: a dark body with tan walkable tier tops and a
// crenellated crown, matching the reference map's dominant central mass. The
// body sits within the centre floor (600-1000) so the flanking pits stay clear.
const PG_CENTER: Platform[] = [
  { x: 620, y: 460, w: 360, h: 228, kind: "pillar" }, // body base (460-688)
  { x: 680, y: 340, w: 240, h: 120, kind: "pillar" }, // body mid (340-460)
  { x: 720, y: 240, w: 160, h: 100, kind: "pillar" }, // body upper (240-340)
  { x: 620, y: 438, w: 360, h: 22, kind: "block" }, // tier 1 walk (top 438)
  { x: 680, y: 318, w: 240, h: 22, kind: "block" }, // tier 2 walk (top 318)
  { x: 720, y: 218, w: 160, h: 22, kind: "block" }, // tier 3 walk (top 218)
  { x: 730, y: 150, w: 140, h: 24, kind: "block" }, // crown base (top 150)
  { x: 736, y: 92, w: 44, h: 42, kind: "block" }, // crown tooth left
  { x: 820, y: 92, w: 44, h: 42, kind: "block" }, // crown tooth right
  { x: 736, y: 134, w: 128, h: 16, kind: "block" }, // crown connector
];

const PG_LEFT: Platform[] = [
  { x: 330, y: 520, w: 100, h: 24, kind: "block" }, // slope step low (top 520, above the beam lane)
  { x: 450, y: 470, w: 110, h: 24, kind: "block" }, // slope step high (top 470)
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
    player: { x: 260, y: 584 },
    bot: { x: 1340, y: 584 },
    bots: [
      { x: 1340, y: 584 },
      { x: 800, y: 202 }, // on tier 3 (top 218)
      { x: 520, y: 584 },
      { x: 1080, y: 584 },
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

// Central crane tower: a tall mast with a fixed top plate, a rope-hung platform
// that swings (see `swing.ts`), and two lower beams. Sits in the central pit so
// players must cross on the hanging platform or the side scaffolds.
const SKY_CENTER: Platform[] = [
  { x: 786, y: 200, w: 28, h: 488, kind: "pillar" }, // mast (top 200, bottom 688)
  { x: 750, y: 180, w: 100, h: 26, kind: "block" }, // top plate (top 180)
  { x: 740, y: 420, w: 120, h: 26, kind: "block" }, // mid beam (top 420)
  { x: 740, y: 560, w: 120, h: 26, kind: "block" }, // lower beam (top 560)
];

const SKY_SIDE: Platform[] = [
  { x: 60, y: 280, w: 130, h: 26, kind: "block" }, // top platform (top 280)
  { x: 110, y: 306, w: 26, h: 382, kind: "pillar" }, // tall post (bottom 688)
  { x: 150, y: 340, w: 30, h: 26, kind: "block" }, // post bump
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

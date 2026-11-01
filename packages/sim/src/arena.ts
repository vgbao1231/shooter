import type { Platform } from "./types";

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface ArenaDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  platforms: Platform[];
  spawns: {
    player: SpawnPoint;
    bot: SpawnPoint;
    bots: SpawnPoint[];
  };
}

/**
 * Both arenas follow the reference layout: a tall dense central structure
 * (stepped pyramid with a crenellated castle peak), segmented side floors
 * with deadly pits (voids) between them, elevated side platforms and tall
 * side towers. The bottom is open — anyone who falls into a pit drops out
 * of the arena and dies. Fighters (radius 20) are small relative to the map,
 * matching the ROUNDS-style proportion of the reference demo.
 */

const mirrors = (platforms: Platform[]): Platform[] =>
  platforms.map((platform) => ({
    ...platform,
    x: ARENA_WIDTH - platform.x - platform.w,
  }));

// Walls + ceiling only. The bottom is open; the floor is segmented blocks
// with gaps (pits) so players can fall out and die.
const FRAME: Platform[] = [
  { x: 0, y: 0, w: 24, h: 720, kind: "frame" },
  { x: 1256, y: 0, w: 24, h: 720, kind: "frame" },
  { x: 0, y: 0, w: 1280, h: 24, kind: "frame" },
];

// --- Proving Grounds: crenellated castle on a stepped pyramid. ---

const PG_FLOOR: Platform[] = [
  { x: 0, y: 690, w: 300, h: 30, kind: "block" }, // left floor
  { x: 420, y: 690, w: 440, h: 30, kind: "block" }, // center floor
  { x: 980, y: 690, w: 300, h: 30, kind: "block" }, // right floor
]; // pits: x300-420 and x860-980

const PG_CENTER: Platform[] = [
  { x: 590, y: 150, w: 100, h: 34, kind: "block" }, // crown center
  { x: 510, y: 180, w: 80, h: 40, kind: "block" }, // crown left
  { x: 690, y: 180, w: 80, h: 40, kind: "block" }, // crown right
  { x: 530, y: 220, w: 220, h: 32, kind: "block" }, // castle base
  { x: 622, y: 252, w: 36, h: 88, kind: "pillar" }, // neck (climbable)
  { x: 500, y: 340, w: 280, h: 34, kind: "block" }, // upper tier
  { x: 440, y: 460, w: 400, h: 40, kind: "block" }, // mid tier
  { x: 420, y: 600, w: 440, h: 90, kind: "block" }, // base (reaches center floor)
];

const PG_LEFT: Platform[] = [
  { x: 160, y: 480, w: 160, h: 34, kind: "block" }, // left mid (overhangs pit)
  { x: 200, y: 350, w: 130, h: 30, kind: "block" }, // left upper
  { x: 30, y: 420, w: 70, h: 270, kind: "block" }, // left tower
  { x: 30, y: 340, w: 70, h: 40, kind: "block" }, // left tower cap
  { x: 100, y: 600, w: 90, h: 28, kind: "block" }, // left ledge
];

export const PROVING_GROUNDS: ArenaDefinition = {
  id: "proving-grounds",
  name: "Proving Grounds",
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  platforms: [...FRAME, ...PG_FLOOR, ...PG_CENTER, ...PG_LEFT, ...mirrors(PG_LEFT)],
  spawns: {
    player: { x: 240, y: 460 },
    bot: { x: 1040, y: 460 },
    bots: [
      { x: 1040, y: 460 },
      { x: 640, y: 320 },
      { x: 1170, y: 360 },
      { x: 520, y: 440 },
    ],
  },
};

// --- Skyline: central spire on a wide base, stepped side ledges. ---

const SKY_FLOOR: Platform[] = [
  { x: 0, y: 690, w: 320, h: 30, kind: "block" }, // left floor
  { x: 400, y: 690, w: 480, h: 30, kind: "block" }, // center floor
  { x: 960, y: 690, w: 320, h: 30, kind: "block" }, // right floor
]; // pits: x320-400 and x880-960

const SKY_CENTER: Platform[] = [
  { x: 580, y: 150, w: 120, h: 26, kind: "block" }, // spire top
  { x: 630, y: 170, w: 20, h: 150, kind: "pillar" }, // spire shaft
  { x: 500, y: 320, w: 280, h: 30, kind: "block" }, // upper ledge
  { x: 440, y: 460, w: 400, h: 36, kind: "block" }, // mid ledge
  { x: 400, y: 600, w: 480, h: 90, kind: "block" }, // base (reaches center floor)
];

const SKY_LEFT: Platform[] = [
  { x: 160, y: 520, w: 180, h: 34, kind: "block" }, // left wide mid
  { x: 220, y: 380, w: 140, h: 30, kind: "block" }, // left upper
  { x: 30, y: 460, w: 80, h: 230, kind: "block" }, // left tower
  { x: 30, y: 360, w: 80, h: 50, kind: "block" }, // left tower cap
  { x: 100, y: 600, w: 90, h: 28, kind: "block" }, // left ledge
];

export const SKYLINE: ArenaDefinition = {
  id: "skyline",
  name: "Skyline",
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  platforms: [...FRAME, ...SKY_FLOOR, ...SKY_CENTER, ...SKY_LEFT, ...mirrors(SKY_LEFT)],
  spawns: {
    player: { x: 250, y: 500 },
    bot: { x: 1030, y: 500 },
    bots: [
      { x: 1030, y: 500 },
      { x: 640, y: 440 },
      { x: 1170, y: 380 },
      { x: 520, y: 440 },
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

export const ACTIVE_ARENA = PROVING_GROUNDS;

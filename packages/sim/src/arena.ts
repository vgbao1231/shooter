import type { Platform, PlatformKind, SwingPlatform } from "./types";

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
 * Two 1600×720 arenas rebuilt to match the reference SVGs in `docs/design/`.
 * The reference art is 16:9, but the arena is 2.22:1, so each map is scaled by
 * ONE common constant (chosen to keep the 32px character ≈1.3–1.5 blocks, per
 * the reference's own proportion) and centred in the arena. The sides beyond
 * the outermost platform are open pit — falling below the lowest floor (or off
 * the map edge) is a death, matching the reference's "vực" (abyss).
 *
 * Solid (`block`) = beige/tan platforms (collision). Decor (`pillar`) = dark
 * columns, the big mountain triangle, and connector bars (visual only — a dark
 * column is never ground). `frame` = arena walls/ceiling.
 */

// A transform mapping one map's reference-SVG pixel coords into the arena.
// `s` is the single per-map scale constant; `ox`/`oy` centre it horizontally
// and bottom-align the pit to the arena floor line.
interface MapTransform {
  s: number;
  ox: number;
  oy: number;
}

const at =
  (m: MapTransform) =>
  (x: number, y: number, w: number, h: number, kind: PlatformKind): Platform => ({
    x: x * m.s + m.ox,
    y: y * m.s + m.oy,
    w: w * m.s,
    h: h * m.s,
    kind,
  });

// Walls + ceiling only. The bottom and the sides of the centred map are open;
// the pit below the lowest floor is the death zone.
const FRAME: Platform[] = [
  { x: 0, y: 0, w: 20, h: 720, kind: "frame" },
  { x: 1580, y: 0, w: 20, h: 720, kind: "frame" },
  { x: 0, y: 0, w: 1600, h: 20, kind: "frame" },
];

// --- Proving Grounds: reference map1_clean.svg (1024×576, 1 unit = 28px).
// Character ~24×36 in the reference → scale 32/36 keeps the 32px character at
// ≈1.29 blocks. Centred: content spans x≈345–1255 in the arena.
const PG_PALETTE: ArenaPalette = {
  backgroundTop: "#0c3556",
  backgroundBottom: "#0a2a47",
  blockA: "#b3a8a0",
  blockB: "#8c8178",
  blockEdge: "rgba(214,205,198,.6)",
  blockStrokeA: "rgba(214,205,198,.16)",
  blockStrokeB: "rgba(58,48,34,.18)",
  pillar: "#08162b",
  pillarShade: "rgba(0,0,0,.4)",
  shadow: "rgba(4,20,28,.22)",
};

const PG_XF: MapTransform = { s: 32 / 36, ox: 345, oy: 208 };
const pg = at(PG_XF);

// The big dark mountain/triangle behind the pyramid (reference polygon
// 469,122 555,122 857,455 166,455), approximated as stacked pillar slices so
// it reads as a solid stepped backdrop without touching the rect-only renderer.
const PG_MOUNTAIN: Platform[] = [
  pg(416.3, 122, 191.2, 58, "pillar"),
  pg(364.5, 180, 294.7, 57, "pillar"),
  pg(312.4, 237, 398.7, 57, "pillar"),
  pg(260.6, 294, 502.2, 57, "pillar"),
  pg(208.7, 351, 605.7, 57, "pillar"),
  pg(166, 408, 691, 47, "pillar"),
];

// Dark vertical pillars hanging below the platforms (decor, never ground).
const PG_PILLARS: Platform[] = [
  // below the CENTER PLAT
  pg(445, 280, 28, 172, "pillar"),
  pg(550, 280, 28, 172, "pillar"),
  // below the TOP U
  pg(527, 180, 28, 85, "pillar"),
  // below LS / RS
  pg(294, 366, 28, 86, "pillar"),
  pg(351, 366, 29, 86, "pillar"),
  pg(644, 366, 28, 86, "pillar"),
  pg(702, 366, 28, 86, "pillar"),
  // below SB blocks
  pg(240, 423, 28, 29, "pillar"),
  pg(755, 423, 28, 29, "pillar"),
  // towers (upper)
  pg(37, 352, 29, 86, "pillar"),
  pg(95, 352, 28, 86, "pillar"),
  pg(898, 352, 29, 86, "pillar"),
  pg(957, 352, 29, 86, "pillar"),
  // towers (feet)
  pg(37, 466, 29, 110, "pillar"),
  pg(95, 466, 28, 110, "pillar"),
  pg(898, 466, 29, 110, "pillar"),
  pg(957, 466, 29, 110, "pillar"),
  // under the FLOOR beam
  pg(196, 467, 28, 109, "pillar"),
  pg(283, 467, 28, 109, "pillar"),
  pg(369, 467, 28, 109, "pillar"),
  pg(455, 467, 28, 109, "pillar"),
  pg(540, 467, 28, 109, "pillar"),
  pg(626, 467, 28, 109, "pillar"),
  pg(712, 467, 28, 109, "pillar"),
  pg(798, 467, 28, 109, "pillar"),
];

// Beige/tan solid platforms (collision).
const PG_BLOCKS: Platform[] = [
  // FLOOR — the main walkway beam
  pg(166, 452, 691, 15, "block"),
  // CENTER PLAT + supports
  pg(426, 265, 173, 15, "block"),
  pg(441, 237, 28, 28, "block"),
  pg(556, 237, 28, 28, "block"),
  // TOP U-shape (teeth + connector)
  pg(469, 122, 28, 28, "block"),
  pg(528, 122, 27, 28, "block"),
  pg(469, 150, 86, 30, "block"),
  // LS (left slope) + RS (right slope)
  pg(351, 309, 29, 28, "block"),
  pg(294, 337, 86, 29, "block"),
  pg(644, 309, 28, 28, "block"),
  pg(644, 337, 86, 29, "block"),
  // SB (small blocks on the slope)
  pg(240, 395, 28, 28, "block"),
  pg(755, 395, 28, 28, "block"),
  // LEFT TOWER (H shape: prongs + connector + feet)
  pg(37, 266, 29, 86, "block"),
  pg(95, 266, 28, 86, "block"),
  pg(66, 294, 29, 29, "block"),
  pg(37, 438, 29, 28, "block"),
  pg(95, 438, 28, 28, "block"),
  // RIGHT TOWER (H shape)
  pg(898, 266, 29, 86, "block"),
  pg(957, 266, 29, 86, "block"),
  pg(927, 294, 30, 29, "block"),
  pg(898, 438, 29, 28, "block"),
  pg(957, 438, 29, 28, "block"),
];

export const PROVING_GROUNDS: ArenaDefinition = {
  id: "proving-grounds",
  name: "Proving Grounds",
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  // Mountain first (backdrop), then dark pillars, then solid blocks on top.
  platforms: [...FRAME, ...PG_MOUNTAIN, ...PG_PILLARS, ...PG_BLOCKS],
  palette: PG_PALETTE,
  spawns: {
    // Symmetric on the highest platform each side (the tower prong tops).
    player: { x: 391, y: 428 },
    bot: { x: 1209, y: 428 },
    bots: [
      { x: 1209, y: 428 },
      { x: 800, y: 428 }, // on the CENTER PLAT (top 443.6 → stand y 427.6)
      { x: 550, y: 594 }, // on the FLOOR beam (top 609.8 → stand y 593.8)
      { x: 1050, y: 594 }, // on the FLOOR beam
    ],
  },
};

// --- Skyline: reference map2_clean.svg (2576×1078, 1 unit = 54px).
// Character ~72×80 in the reference → scale 32/80 keeps the 32px character at
// ≈1.48 blocks. Playable region x326–x2250; centred in the arena.
const SKY_PALETTE: ArenaPalette = {
  backgroundTop: "#123743",
  backgroundBottom: "#050b1a",
  blockA: "#8a5a3a",
  blockB: "#6f4630",
  blockEdge: "rgba(255,235,215,.5)",
  blockStrokeA: "rgba(255,235,215,.14)",
  blockStrokeB: "rgba(40,20,10,.2)",
  pillar: "#1f1a20",
  pillarShade: "rgba(0,0,0,.45)",
  shadow: "rgba(2,10,14,.25)",
};

const SKY_XF: MapTransform = { s: 32 / 80, ox: 284.8, oy: 288.8 };
const sk = at(SKY_XF);

// The central mountain (reference polygon 1207,440 1369,440 1420,1078 1150,1078),
// approximated as stacked pillar slices (decor).
const SKY_MOUNTAIN: Platform[] = [
  sk(1197.2, 440, 180.6, 110, "pillar"),
  sk(1187.3, 550, 199.3, 110, "pillar"),
  sk(1177.5, 660, 217.9, 110, "pillar"),
  sk(1167.7, 770, 236.4, 110, "pillar"),
  sk(1157.9, 880, 255, 110, "pillar"),
  sk(1150, 990, 270, 88, "pillar"),
];

// Dark pillar columns (decor, never ground).
const SKY_PILLARS: Platform[] = [
  // centre pillars
  sk(809, 483, 53, 161, "pillar"),
  sk(1714, 483, 54, 161, "pillar"),
  sk(1207, 777, 53, 301, "pillar"),
  sk(1315, 777, 54, 301, "pillar"),
  // below the SB upper blocks
  sk(653, 590, 54, 54, "pillar"),
  sk(977, 590, 53, 54, "pillar"),
  sk(1546, 590, 53, 54, "pillar"),
  sk(1869, 590, 54, 54, "pillar"),
  // left tower columns
  sk(571, 670, 54, 408, "pillar"),
  sk(734, 670, 54, 408, "pillar"),
  sk(895, 670, 54, 408, "pillar"),
  sk(1057, 670, 54, 408, "pillar"),
  // right tower columns
  sk(1466, 670, 54, 408, "pillar"),
  sk(1627, 670, 54, 408, "pillar"),
  sk(1789, 670, 54, 408, "pillar"),
  sk(1951, 670, 54, 408, "pillar"),
];

// Beige/rust solid platforms (collision).
const SKY_BLOCKS: Platform[] = [
  // CENTER stack (3 platforms on the mountain)
  sk(1207, 440, 162, 53, "block"),
  sk(1207, 568, 162, 54, "block"),
  sk(1207, 724, 162, 53, "block"),
  // LEFT tower
  sk(755, 430, 161, 53, "block"), // TOP-PLAT
  sk(653, 537, 54, 53, "block"), // SB upper
  sk(977, 537, 53, 53, "block"), // SB upper
  sk(515, 644, 647, 26, "block"), // MAIN
  sk(679, 779, 54, 53, "block"), // LOW small
  sk(949, 779, 54, 53, "block"), // LOW small
  sk(515, 832, 647, 27, "block"), // LOW
  sk(395, 732, 53, 53, "block"), // HANG (off the side)
  // RIGHT tower
  sk(1660, 430, 161, 53, "block"), // TOP-PLAT
  sk(1546, 537, 53, 53, "block"), // SB upper
  sk(1869, 537, 54, 53, "block"), // SB upper
  sk(1414, 644, 647, 26, "block"), // MAIN
  sk(1574, 779, 53, 53, "block"), // LOW small
  sk(1843, 779, 54, 53, "block"), // LOW small
  sk(1414, 832, 647, 27, "block"), // LOW
  sk(2128, 732, 53, 53, "block"), // HANG (off the side)
];

export const SKYLINE: ArenaDefinition = {
  id: "skyline",
  name: "Skyline",
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  platforms: [...FRAME, ...SKY_MOUNTAIN, ...SKY_PILLARS, ...SKY_BLOCKS],
  palette: SKY_PALETTE,
  spawns: {
    // Symmetric on the highest platform each side (the TOP-PLAT).
    player: { x: 619, y: 445 },
    bot: { x: 981, y: 445 },
    bots: [
      { x: 981, y: 445 },
      { x: 720, y: 530 }, // on the left MAIN (top 546.4 → stand y 530.4)
      { x: 1000, y: 530 }, // on the right MAIN (top 546.4 → stand y 530.4)
      { x: 800, y: 562 }, // on the CENTER stack bottom (top 578.4 → stand y 562.4)
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

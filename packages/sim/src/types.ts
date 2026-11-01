export type WeaponId = "pistol" | "shotgun" | "smg";

export type CardId =
  | "BLAST"
  | "BOUNCE"
  | "RAPID"
  | "BUCKSHOT"
  | "PIERCE"
  | "MEGA"
  | "FRAG"
  | "NITRO"
  | "VITAL"
  | "PLATE"
  | "DASH"
  | "SPRING"
  | "FORTUNE";

export type CardCategory =
  | "projectile"
  | "combat"
  | "defense"
  | "movement"
  | "passive";

export type PlatformKind = "frame" | "block" | "pillar";

export type BotDifficulty = "easy" | "normal" | "hard";

export type RoundState = "countdown" | "playing" | "roundEnd" | "matchEnd";

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  rate: number;
  speed: number;
  damage: number;
  count: number;
  spread: number;
  length: number;
  thickness: number;
  color: string;
  kick: number;
  push: number;
  bulletRadius: number;
}

export interface CardLine {
  tone: "pos" | "neg";
  text: string;
}

export interface CardSpec {
  id: CardId;
  name: string;
  category: CardCategory;
  accent: string;
  description: string;
  lines: CardLine[];
  art: CardId;
}

export interface InputFrame {
  playerId: number;
  seq: number;
  move: -1 | 0 | 1;
  jumpHeld: boolean;
  shootHeld: boolean;
  grenadeHeld: boolean;
  aimX: number;
  aimY: number;
}

export interface PlayerState {
  id: number;
  slot: number;
  name: string;
  color: string;
  isBot: boolean;
  botControlled: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  grounded: boolean;
  wallDir: -1 | 0 | 1;
  wallClimbing: boolean;
  climbStamina: number;
  maxHealth: number;
  health: number;
  aimAngle: number;
  aimX: number;
  aimY: number;
  weaponId: WeaponId;
  fireCooldown: number;
  grenadeCooldown: number;
  cards: CardId[];
  hitFlash: number;
  squash: number;
  recoil: number;
  alive: boolean;
  deathTimer: number;
  skin: string;
  score: number;
  prevJumpHeld: boolean;
  prevGrenadeHeld: boolean;
}

export interface Bullet {
  id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  bounces: number;
  explodes: boolean;
  pierce: number;
  hitIds: number[];
  color: string;
  dead: boolean;
  trail: Array<{ x: number; y: number }>;
}

export interface Grenade {
  id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  blastRadius: number;
  damage: number;
  fuse: number;
  rotation: number;
  dead: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  light: boolean;
  shard: boolean;
}

export interface Ring {
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  filled: boolean;
}

export interface MuzzleFlash {
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  value: string;
  life: number;
}

export interface BotBrain {
  decisionTimer: number;
  strafeDir: -1 | 0 | 1;
  jumpTimer: number;
  grenadeTimer: number;
  weaponTimer: number;
}

export interface World {
  tick: number;
  time: number;
  seed: number;
  rngState: number;
  fxState: number;
  mode: "training" | "gauntlet" | "match";
  arenaId: string;
  players: PlayerState[];
  platformList: Platform[];
  bullets: Bullet[];
  grenades: Grenade[];
  particles: Particle[];
  rings: Ring[];
  flashes: MuzzleFlash[];
  texts: FloatingText[];
  bots: Map<number, BotBrain>;
  nextEntityId: number;
  hitStop: number;
  shake: number;
  resetTimer: number;
  roundOver: boolean;
  winnerId: number | null;
  botEnabled: boolean;
  botDifficulty: BotDifficulty;
  roundState: RoundState;
  roundTimer: number;
  roundNumber: number;
  matchTarget: number;
  matchOver: boolean;
}

export interface PlayerHud {
  id: number;
  name: string;
  color: string;
  isBot: boolean;
  health: number;
  maxHealth: number;
  alive: boolean;
  weaponId: WeaponId;
  grenadeCooldown: number;
  grenadeReadyIn: number;
  cards: CardId[];
  grounded: boolean;
  wallDir: -1 | 0 | 1;
  wallClimbing: boolean;
  climbStamina: number;
  x: number;
  y: number;
  skin: string;
  score: number;
}

export interface HudState {
  tick: number;
  fps: number;
  player: PlayerHud;
  bot: PlayerHud;
  bots: PlayerHud[];
  botsAlive: number;
  roundOver: boolean;
  winnerId: number | null;
  resetIn: number;
  bulletCount: number;
  particleCount: number;
  mode: "training" | "gauntlet" | "match";
  arenaId: string;
  roundState: RoundState;
  roundNumber: number;
  matchTarget: number;
  matchOver: boolean;
}
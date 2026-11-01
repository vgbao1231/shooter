import { ROUND_COUNTDOWN } from "./constants";
import type {
  Bullet,
  FloatingText,
  Grenade,
  MuzzleFlash,
  Particle,
  PlayerState,
  Ring,
  RoundState,
  WeaponId,
  World,
} from "./types";

/**
 * Network snapshot of the render-relevant world state.
 *
 * Phase 3 sends these over the LAN as JSON (Colyseus rooms, message-based sync;
 * the sim stays the single authority). Only the fields the Canvas renderer reads
 * are serialized, so the snapshot stays small at 30 Hz for 2–4 clients.
 */

export interface SnapshotPlayer {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  color: string;
  isBot: boolean;
  radius: number;
  recoil: number;
  squash: number;
  hitFlash: number;
  grounded: boolean;
  wallDir: -1 | 0 | 1;
  weaponId: WeaponId;
}

export interface SnapshotBullet {
  x: number;
  y: number;
  color: string;
  explodes: boolean;
  radius: number;
  trail: Array<{ x: number; y: number }>;
}

export interface SnapshotGrenade {
  x: number;
  y: number;
  fuse: number;
  radius: number;
  rotation: number;
}

export interface SnapshotParticle {
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  light: boolean;
  shard: boolean;
  size: number;
}

export interface SnapshotRing {
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  filled: boolean;
}

export interface SnapshotFlash {
  x: number;
  y: number;
  angle: number;
  size: number;
  life: number;
  maxLife: number;
}

export interface SnapshotText {
  x: number;
  y: number;
  value: string;
  life: number;
}

export interface NetworkSnapshot {
  tick: number;
  shake: number;
  roundOver: boolean;
  winnerId: number | null;
  roundState: RoundState;
  roundNumber: number;
  matchTarget: number;
  matchOver: boolean;
  players: SnapshotPlayer[];
  bullets: SnapshotBullet[];
  grenades: SnapshotGrenade[];
  particles: SnapshotParticle[];
  rings: SnapshotRing[];
  flashes: SnapshotFlash[];
  texts: SnapshotText[];
}

export function serializeWorld(world: World): NetworkSnapshot {
  return {
    tick: world.tick,
    shake: world.shake,
    roundOver: world.roundOver,
    winnerId: world.winnerId,
    roundState: world.roundState,
    roundNumber: world.roundNumber,
    matchTarget: world.matchTarget,
    matchOver: world.matchOver,
    players: world.players.map((player) => ({
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      aimAngle: player.aimAngle,
      health: player.health,
      maxHealth: player.maxHealth,
      alive: player.alive,
      color: player.color,
      isBot: player.isBot,
      radius: player.radius,
      recoil: player.recoil,
      squash: player.squash,
      hitFlash: player.hitFlash,
      grounded: player.grounded,
      wallDir: player.wallDir,
      weaponId: player.weaponId,
    })),
    bullets: world.bullets.map((bullet) => ({
      x: bullet.x,
      y: bullet.y,
      color: bullet.color,
      explodes: bullet.explodes,
      radius: bullet.radius,
      trail: bullet.trail,
    })),
    grenades: world.grenades.map((grenade) => ({
      x: grenade.x,
      y: grenade.y,
      fuse: grenade.fuse,
      radius: grenade.radius,
      rotation: grenade.rotation,
    })),
    particles: world.particles.map((particle) => ({
      x: particle.x,
      y: particle.y,
      color: particle.color,
      life: particle.life,
      maxLife: particle.maxLife,
      light: particle.light,
      shard: particle.shard,
      size: particle.size,
    })),
    rings: world.rings.map((ring) => ({
      x: ring.x,
      y: ring.y,
      size: ring.size,
      life: ring.life,
      maxLife: ring.maxLife,
      color: ring.color,
      filled: ring.filled,
    })),
    flashes: world.flashes.map((flash) => ({
      x: flash.x,
      y: flash.y,
      angle: flash.angle,
      size: flash.size,
      life: flash.life,
      maxLife: flash.maxLife,
    })),
    texts: world.texts.map((text) => ({
      x: text.x,
      y: text.y,
      value: text.value,
      life: text.life,
    })),
  };
}

function playerFromSnapshot(snap: SnapshotPlayer): PlayerState {
  return {
    id: snap.id,
    slot: snap.id,
    name: snap.name,
    color: snap.color,
    isBot: snap.isBot,
    botControlled: snap.isBot,
    x: snap.x,
    y: snap.y,
    vx: snap.vx,
    vy: snap.vy,
    radius: snap.radius,
    grounded: snap.grounded,
    wallDir: snap.wallDir,
    wallClimbing: false,
    climbStamina: 100,
    maxHealth: snap.maxHealth,
    health: snap.health,
    aimAngle: snap.aimAngle,
    aimX: snap.x + Math.cos(snap.aimAngle) * 200,
    aimY: snap.y + Math.sin(snap.aimAngle) * 200,
    weaponId: snap.weaponId,
    fireCooldown: 0,
    grenadeCooldown: 0,
    cards: [],
    hitFlash: snap.hitFlash,
    squash: snap.squash,
    recoil: snap.recoil,
    alive: snap.alive,
    deathTimer: 0,
    skin: "default",
    score: 0,
    prevJumpHeld: false,
    prevGrenadeHeld: false,
  };
}

/**
 * Build a bare, render-only World for a networked client. The client hydrates
 * this from snapshots and feeds it straight to the Canvas renderer; it never
 * owns gameplay rules.
 */
export function createRenderWorld(
  arenaId: string,
  platformList: World["platformList"],
): World {
  return {
    tick: 0,
    time: 0,
    seed: 0,
    rngState: 0,
    fxState: 0,
    mode: "match",
    arenaId,
    players: [],
    platformList,
    bullets: [],
    grenades: [],
    particles: [],
    rings: [],
    flashes: [],
    texts: [],
    bots: new Map(),
    nextEntityId: 1,
    hitStop: 0,
    shake: 0,
    resetTimer: 0,
    roundOver: false,
    winnerId: null,
    botEnabled: true,
    botDifficulty: "normal",
    roundState: "countdown",
    roundTimer: ROUND_COUNTDOWN,
    roundNumber: 1,
    matchTarget: 3,
    matchOver: false,
  };
}

/**
 * Copy an authoritative snapshot into a render-only World, replacing the
 * dynamic entity arrays. Keeps `platformList` (set once at join).
 */
export function applySnapshot(world: World, snap: NetworkSnapshot): void {
  world.tick = snap.tick;
  world.shake = snap.shake;
  world.roundOver = snap.roundOver;
  world.winnerId = snap.winnerId;
  world.roundState = snap.roundState;
  world.roundNumber = snap.roundNumber;
  world.matchTarget = snap.matchTarget;
  world.matchOver = snap.matchOver;
  world.players = snap.players.map(playerFromSnapshot);
  world.bullets = snap.bullets.map(
    (bullet): Bullet => ({
      id: 0,
      ownerId: 0,
      x: bullet.x,
      y: bullet.y,
      vx: 0,
      vy: 0,
      radius: bullet.radius,
      damage: 0,
      bounces: 0,
      explodes: bullet.explodes,
      pierce: 0,
      hitIds: [],
      color: bullet.color,
      dead: false,
      trail: bullet.trail,
    }),
  );
  world.grenades = snap.grenades.map(
    (grenade): Grenade => ({
      id: 0,
      ownerId: 0,
      x: grenade.x,
      y: grenade.y,
      vx: 0,
      vy: 0,
      radius: grenade.radius,
      blastRadius: 0,
      damage: 0,
      fuse: grenade.fuse,
      rotation: grenade.rotation,
      dead: false,
    }),
  );
  world.particles = snap.particles.map(
    (particle): Particle => ({
      x: particle.x,
      y: particle.y,
      vx: 0,
      vy: 0,
      life: particle.life,
      maxLife: particle.maxLife,
      size: particle.size,
      color: particle.color,
      gravity: 0,
      light: particle.light,
      shard: particle.shard,
    }),
  );
  world.rings = snap.rings.map(
    (ring): Ring => ({
      x: ring.x,
      y: ring.y,
      size: ring.size,
      life: ring.life,
      maxLife: ring.maxLife,
      color: ring.color,
      filled: ring.filled,
    }),
  );
  world.flashes = snap.flashes.map(
    (flash): MuzzleFlash => ({
      x: flash.x,
      y: flash.y,
      angle: flash.angle,
      life: flash.life,
      maxLife: flash.maxLife,
      size: flash.size,
    }),
  );
  world.texts = snap.texts.map(
    (text): FloatingText => ({
      x: text.x,
      y: text.y,
      value: text.value,
      life: text.life,
    }),
  );
}

/**
 * Advance effect timers locally between snapshots so VFX fade smoothly on the
 * client even though it does not run the simulation.
 */
export function decayEffects(world: World, dt: number): void {
  world.particles = world.particles.filter((particle) => {
    particle.life -= dt;
    return particle.life > 0;
  });
  world.rings = world.rings.filter((ring) => {
    ring.life -= dt;
    return ring.life > 0;
  });
  world.flashes = world.flashes.filter((flash) => {
    flash.life -= dt;
    return flash.life > 0;
  });
  world.texts = world.texts.filter((text) => {
    text.life -= dt;
    return text.life > 0;
  });
  world.shake = Math.max(0, world.shake - dt * 2.4);
}

/** Interpolate player positions between two snapshots for smooth remote movement. */
export function interpolateSnapshots(
  from: NetworkSnapshot,
  to: NetworkSnapshot,
  alpha: number,
): NetworkSnapshot {
  const players = to.players.map((next) => {
    const prev = from.players.find((entry) => entry.id === next.id);
    if (!prev) return next;
    const lerp = (a: number, b: number): number => a + (b - a) * alpha;
    return {
      ...next,
      x: lerp(prev.x, next.x),
      y: lerp(prev.y, next.y),
      vx: lerp(prev.vx, next.vx),
      vy: lerp(prev.vy, next.vy),
      aimAngle: lerp(prev.aimAngle, next.aimAngle),
      recoil: lerp(prev.recoil, next.recoil),
      squash: lerp(prev.squash, next.squash),
      hitFlash: lerp(prev.hitFlash, next.hitFlash),
    };
  });
  return { ...to, players };
}

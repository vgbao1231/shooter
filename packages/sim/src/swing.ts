import { swingRect } from "./arena";
import {
  BOB_MIN,
  GRAVITY,
  SWING_BULLET_BOB,
  SWING_DAMPING,
  SWING_EXPLOSION_PUSH,
  SWING_HEAD_PUSH,
  SWING_MAX_ANGLE,
  SWING_PLAYER_PUSH,
  SWING_BULLET_PUSH,
} from "./constants";
import type { Platform, World } from "./types";

/**
 * Platforms hanging from a rope at an anchor. Modeled as a rope: the block
 * swings as a pendulum when the rope is taut, and the rope visibly slackens
 * (the block rises toward the anchor) when bumped, then gravity pulls it back
 * down and the rope catches it. A player standing on one (offset from the
 * anchor) tips it; a head-bump from below (edge-triggered, once per contact)
 * or a bullet hit pops the block up and lets the rope go slack. Deterministic
 * and fixed-step like the rest of the sim.
 *
 * State is (angle, bob): `angle` is the swing from vertical; `bob <= 0` is
 * rope slack (block raised toward the anchor), `bob = 0` is taut. Gravity
 * always pulls the block down, and the rope is an inelastic stop at `bob = 0`.
 *
 * Each tick we rebuild `world.platformList` = static platforms + the current
 * swing rects, so collision (players, bullets, bots) sees the moving blocks.
 */
export function stepSwingPlatforms(world: World, dt: number): void {
  if (world.swingDefs.length === 0) return;
  const rects: Platform[] = [];
  for (let index = 0; index < world.swingDefs.length; index += 1) {
    const def = world.swingDefs[index];
    if (!def) continue;
    const state = (world.swingState[index] ??= {
      angle: 0,
      angVel: 0,
      bob: 0,
      bobVel: 0,
    });
    const cx = def.anchorX + def.length * Math.sin(state.angle);
    const cy = def.anchorY + def.length * Math.cos(state.angle) + state.bob;
    const halfW = def.w / 2;
    const halfH = def.h / 2;

    // --- Head-bump from below: edge-triggered (once per contact) so a player
    // holding jump into the block doesn't re-kick it every tick and jolt it.
    // Runs before the rope integration so the kick moves the block this tick.
    const bottom = cy + halfH;
    const bumpers = (state.headBumpers ??= new Set<number>());
    for (const player of world.players) {
      if (!player.alive) continue;
      const headY = player.y - player.radius;
      const underBlock =
        player.vy < -60 &&
        Math.abs(player.x - cx) < halfW + player.radius * 0.9 &&
        headY >= bottom - 4 &&
        headY <= bottom + player.radius + 8;
      if (underBlock) {
        if (!bumpers.has(player.id)) {
          bumpers.add(player.id);
          state.bobVel += player.vy * SWING_HEAD_PUSH;
          state.angVel += (player.x - cx) * SWING_HEAD_PUSH * 0.6;
        }
      } else {
        bumpers.delete(player.id);
      }
    }

    // --- Pendulum swing (side to side). The rope constrains the block to the
    // circle when taut; restoring torque fades as the rope slackens.
    const tautness = state.bob >= 0 ? 1 : Math.max(0, 1 + state.bob / BOB_MIN);
    let angAccel =
      -(GRAVITY / def.length) * Math.sin(state.angle) * (0.35 + 0.65 * tautness);
    for (const player of world.players) {
      if (!player.alive || !player.grounded) continue;
      const onPlatform =
        Math.abs(player.x - cx) < halfW + player.radius &&
        Math.abs(player.y - cy) < halfH + player.radius + 6;
      if (onPlatform) {
        angAccel += ((player.x - def.anchorX) * SWING_PLAYER_PUSH) / def.length;
      }
    }
    angAccel -= SWING_DAMPING * state.angVel;
    state.angVel += angAccel * dt;
    state.angle += state.angVel * dt;
    if (state.angle > SWING_MAX_ANGLE) {
      state.angle = SWING_MAX_ANGLE;
      state.angVel = Math.min(0, state.angVel);
    } else if (state.angle < -SWING_MAX_ANGLE) {
      state.angle = -SWING_MAX_ANGLE;
      state.angVel = Math.max(0, state.angVel);
    }

    // --- Rope slack. `bob <= 0` is the block being closer to the anchor than
    // the rope length (slack); gravity pulls it back down and the rope catches
    // it inelastically at `bob = 0` (no spring, no bounce, no stretch).
    state.bobVel += GRAVITY * dt;
    state.bob += state.bobVel * dt;
    if (state.bob > 0) {
      state.bob = 0;
      state.bobVel = 0;
    } else if (state.bob < BOB_MIN) {
      state.bob = BOB_MIN;
      state.bobVel = Math.max(0, state.bobVel);
    }

    rects.push(swingRect(def, state.angle, state.bob, index));
  }
  world.swingRects = rects;
  world.platformList = [...world.staticPlatforms, ...rects];
}

/**
 * A shot hit a swing block: kick it along the bullet's travel direction so the
 * block sways (sideways) and pops up/down (vertical), then the spring settles.
 */
export function impulseSwing(
  world: World,
  index: number,
  vx: number,
  vy: number,
): void {
  const state = world.swingState[index];
  if (!state) return;
  const speed = Math.max(1, Math.hypot(vx, vy));
  const nx = vx / speed;
  const ny = vy / speed;
  state.angVel += nx * SWING_BULLET_PUSH;
  state.bobVel += ny * SWING_BULLET_PUSH * SWING_BULLET_BOB;
}

/**
 * An explosion near a swing block pushes it away from the blast (radially) and
 * pops it up/down, scaled by proximity and blast size. Called by `explode()` so
 * wired blocks react to grenades and BLAST bullets, not just players and shots.
 */
export function explosionImpulseSwing(
  world: World,
  x: number,
  y: number,
  radius: number,
): void {
  for (let index = 0; index < world.swingDefs.length; index += 1) {
    const def = world.swingDefs[index];
    const state = world.swingState[index];
    if (!def || !state) continue;
    const cx = def.anchorX + def.length * Math.sin(state.angle);
    const cy = def.anchorY + def.length * Math.cos(state.angle) + state.bob;
    const dx = cx - x;
    const dy = cy - y;
    const distance = Math.hypot(dx, dy) || 1;
    // Reach: the blast plus a generous margin so even a large block on the
    // edge of the blast gets shoved.
    const reach = radius + Math.max(def.w, def.h);
    if (distance > reach) continue;
    const factor = (1 - distance / reach) * Math.min(1.5, radius / 120);
    const nx = dx / distance;
    const ny = dy / distance;
    state.angVel += nx * factor * SWING_EXPLOSION_PUSH;
    state.bobVel += ny * factor * SWING_EXPLOSION_PUSH * SWING_BULLET_BOB;
  }
}
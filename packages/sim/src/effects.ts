import { ARENA_HEIGHT } from "./arena";
import { PARTICLE_CAP } from "./constants";
import { nextRandom } from "./rng";
import type { World } from "./types";

interface BurstOptions {
  gravity?: number;
  light?: boolean;
  shard?: boolean;
  sizeScale?: number;
}

function fxRandom(world: World): number {
  const next = nextRandom(world.fxState);
  world.fxState = next.state;
  return next.value;
}

export function burst(
  world: World,
  x: number,
  y: number,
  angle: number,
  spread: number,
  speed: number,
  count: number,
  color: string,
  options: BurstOptions = {},
): void {
  for (let index = 0; index < count; index += 1) {
    if (world.particles.length >= PARTICLE_CAP) break; // budget reached: drop extras
    const direction = angle + (fxRandom(world) - 0.5) * spread;
    const velocity = speed * (0.3 + fxRandom(world) * 0.7);
    const life = 0.25 + fxRandom(world) * 0.45;
    world.particles.push({
      x,
      y,
      vx: Math.cos(direction) * velocity,
      vy: Math.sin(direction) * velocity,
      life,
      maxLife: life,
      size: (2 + fxRandom(world) * 3) * (options.sizeScale ?? 1),
      color,
      gravity: options.gravity ?? 500,
      light: options.light ?? false,
      shard: options.shard ?? false,
    });
  }
}

export function spawnImpact(
  world: World,
  x: number,
  y: number,
  nx: number,
  ny: number,
): void {
  const angle = Math.atan2(ny, nx);
  burst(world, x, y, angle, 1.5, 420, 9, "#ffd27a", {
    gravity: 300,
    light: true,
  });
  burst(world, x, y, angle, 2, 240, 6, "#5a5880", { gravity: 900 });
  world.rings.push({
    x,
    y,
    size: 28,
    life: 0.22,
    maxLife: 0.22,
    color: "#ffe9b0",
    filled: false,
  });
  world.shake = Math.min(1, world.shake + 0.05);
}

export function spawnMuzzle(
  world: World,
  x: number,
  y: number,
  angle: number,
  size: number,
): void {
  world.flashes.push({
    x,
    y,
    angle,
    life: 0.07,
    maxLife: 0.07,
    size,
  });
  burst(world, x, y, angle, 0.9, 520, 6, "#ffd57a", {
    gravity: 200,
    light: true,
  });
}

export function spawnDamageText(world: World, x: number, y: number, amount: number): void {
  world.texts.push({
    x: x + (fxRandom(world) - 0.5) * 30,
    y: y - 30,
    value: `-${Math.max(1, Math.round(amount))}`,
    life: 0.8,
  });
}

export function spawnClimbDust(world: World, x: number, y: number, wallDir: -1 | 1): void {
  burst(world, x - wallDir * 10, y + 14, -Math.PI / 2, 1.8, 90, 2, "#9d9bbd", {
    gravity: 160,
  });
}

export function updateEffects(world: World, dt: number): void {
  for (const particle of world.particles) {
    particle.vy += particle.gravity * dt;
    particle.vx *= 1 - 1.2 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (particle.y > ARENA_HEIGHT - 32 && particle.vy > 0) {
      particle.y = ARENA_HEIGHT - 32;
      particle.vy *= -0.35;
      particle.vx *= 0.6;
    }
    particle.life -= dt;
  }

  for (const ring of world.rings) ring.life -= dt;
  for (const flash of world.flashes) flash.life -= dt;
  for (const text of world.texts) {
    text.y -= 60 * dt;
    text.life -= dt;
  }

  for (const list of [world.particles, world.rings, world.flashes, world.texts]) {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const item = list[index];
      if (item && item.life <= 0) list.splice(index, 1);
    }
  }

  if (world.particles.length > PARTICLE_CAP) {
    world.particles.splice(0, world.particles.length - PARTICLE_CAP);
  }
  world.shake = Math.max(0, world.shake - 1.8 * dt);
}

export { fxRandom };
import { ARENA_HEIGHT, ARENA_WIDTH } from "./arena";
import {
  GRENADE_BODY_RADIUS,
  GRENADE_DAMAGE,
  GRENADE_FUSE,
  GRENADE_RADIUS,
  HIT_STOP_BOOM,
  HIT_STOP_HURT,
  SANDBOX_RESET_DELAY,
} from "./constants";
import { WEAPONS } from "./content";
import { burst, spawnDamageText, spawnImpact, spawnMuzzle } from "./effects";
import { circleVsAabb, raycastPlatforms } from "./geometry";
import { nextRandom } from "./rng";
import { explosionImpulseSwing, impulseSwing } from "./swing";
import { grenadeCooldownFor } from "./world";
import type { Bullet, Grenade, PlayerState, World } from "./types";

function simRandom(world: World): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

/**
 * Whether two players are on the same team in team mode. In free-for-all
 * (teamCount 1) nobody is a teammate, so everyone is hostile.
 */
export function sameTeam(world: World, aId: number, bId: number): boolean {
  if (world.teamCount <= 1) return false;
  const a = world.players.find((player) => player.id === aId);
  const b = world.players.find((player) => player.id === bId);
  if (!a || !b) return false;
  return a.team === b.team;
}

/** Visual feedback for a shot that hit a teammate: no damage, but effects. */
function spawnFriendlyHit(world: World, x: number, y: number, nx: number, ny: number): void {
  const angle = Math.atan2(ny, nx);
  burst(world, x, y, angle, 1.5, 380, 9, "#9be0ff", {
    gravity: 300,
    light: true,
  });
  world.rings.push({
    x,
    y,
    size: 24,
    life: 0.2,
    maxLife: 0.2,
    color: "#9be0ff",
    filled: false,
  });
}

function fireCooldownFor(player: PlayerState): number {
  const weapon = WEAPONS.pistol;
  let multiplier = player.cards.includes("RAPID") ? 0.6 : 1;
  if (player.cards.includes("BUCKSHOT")) multiplier *= 1.25;
  return weapon.rate * multiplier;
}

function clampSpawnToWall(
  world: World,
  x0: number,
  y0: number,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  const hit = raycastPlatforms(world.platformList, x0, y0, targetX, targetY);
  if (!hit || hit.t <= 0.0001 || hit.t >= 1) return { x: targetX, y: targetY };
  const t = Math.max(0.02, hit.t - 0.03);
  return { x: x0 + (targetX - x0) * t, y: y0 + (targetY - y0) * t };
}

export function fireWeapon(world: World, player: PlayerState): void {
  if (!player.alive || player.fireCooldown > 0) return;
  const weapon = WEAPONS.pistol;
  const angle = player.aimAngle;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const muzzleTargetX = player.x + directionX * (player.radius + 6 + weapon.length);
  const muzzleTargetY = player.y + directionY * (player.radius + 6 + weapon.length);
  const muzzle = clampSpawnToWall(
    world,
    player.x,
    player.y,
    muzzleTargetX,
    muzzleTargetY,
  );
  const hasBuckshot = player.cards.includes("BUCKSHOT");
  const pelletCount = weapon.count + (hasBuckshot ? 6 : 0);
  const spread = weapon.spread + (hasBuckshot ? 0.2 : 0);

  player.fireCooldown = fireCooldownFor(player);
  player.recoil = weapon.kick;

  for (let index = 0; index < pelletCount; index += 1) {
    const pelletAngle = angle + (simRandom(world) - 0.5) * 2 * spread;
    const speed = weapon.speed * (0.92 + simRandom(world) * 0.16);
    const bullet: Bullet = {
      id: world.nextEntityId++,
      ownerId: player.id,
      x: muzzle.x,
      y: muzzle.y,
      vx: Math.cos(pelletAngle) * speed,
      vy: Math.sin(pelletAngle) * speed,
      radius: weapon.bulletRadius + (player.cards.includes("BLAST") ? 2 : 0),
      damage: weapon.damage + (player.cards.includes("MEGA") ? 4 : 0),
      bounces: player.cards.includes("BOUNCE") ? 2 : 0,
      explodes: player.cards.includes("BLAST"),
      pierce: player.cards.includes("PIERCE") ? 1 : 0,
      hitIds: [],
      color: player.color,
      dead: false,
      trail: [],
    };
    world.bullets.push(bullet);
  }

  spawnMuzzle(world, muzzle.x, muzzle.y, angle, weapon.length * 0.9);
  burst(
    world,
    player.x + directionX * (player.radius + 10),
    player.y + directionY * (player.radius + 10),
    angle + Math.PI,
    1.1,
    180,
    3,
    "#f1c24b",
    { gravity: 1400, shard: true, sizeScale: 1.2 },
  );
  player.vx -= directionX * weapon.push;
  player.vy -= directionY * weapon.push * 0.3;
  world.shake = Math.min(1, world.shake + pelletCount * 0.04 + weapon.kick * 0.01);
}

export function throwGrenade(world: World, player: PlayerState): void {
  if (!player.alive || player.grenadeCooldown > 0) return;
  const aimDx = player.aimX - player.x;
  const aimDy = player.aimY - player.y;
  const distance = Math.max(1, Math.hypot(aimDx, aimDy));
  const dx = aimDx / distance;
  const dy = aimDy / distance;
  const speed = Math.max(350, Math.min(1000, distance * 1.5));
  const origin = clampSpawnToWall(
    world,
    player.x,
    player.y,
    player.x + dx * (player.radius + 8),
    player.y + dy * (player.radius + 8),
  );
  player.grenadeCooldown = grenadeCooldownFor(player);
  world.grenades.push({
    id: world.nextEntityId++,
    ownerId: player.id,
    x: origin.x,
    y: origin.y,
    vx: dx * speed + player.vx * 0.4,
    vy: dy * speed - 140 + player.vy * 0.4,
    radius: GRENADE_BODY_RADIUS,
    blastRadius: player.cards.includes("NITRO") ? GRENADE_RADIUS + 45 : GRENADE_RADIUS,
    damage: player.cards.includes("NITRO") ? GRENADE_DAMAGE + 15 : GRENADE_DAMAGE,
    fuse: GRENADE_FUSE,
    rotation: 0,
    dead: false,
  });
  player.recoil = 10;
}

export function checkRoundOver(world: World): void {
  if (world.roundOver) return;
  const alive = world.players.filter((player) => player.alive);

  // Team mode: the round ends when only one team still has living members.
  if (world.teamCount > 1) {
    const aliveTeams = new Set(alive.map((player) => player.team));
    if (aliveTeams.size > 1) return;
    world.roundOver = true;
    // A total wipe (no survivors) is a draw: nobody scores.
    const survivor = alive[0];
    world.winnerId = survivor?.id ?? null;
    world.resetTimer = SANDBOX_RESET_DELAY;
    if (world.mode === "match" && survivor) {
      const winningTeam = survivor.team;
      world.teamScores[winningTeam] = (world.teamScores[winningTeam] ?? 0) + 1;
    }
    return;
  }

  if (alive.length > 1) return;
  world.roundOver = true;
  world.winnerId = alive[0]?.id ?? null;
  world.resetTimer = SANDBOX_RESET_DELAY;
  if (world.mode === "match" && world.winnerId !== null) {
    const winner = world.players.find((player) => player.id === world.winnerId);
    if (winner) winner.score += 1;
  }
}

function applyDamage(
  world: World,
  target: PlayerState,
  amount: number,
  knockX: number,
  knockY: number,
  heavy: boolean,
  check = true,
): void {
  if (!target.alive || amount <= 0) return;
  const reduced = target.cards.includes("PLATE") ? amount * 0.75 : amount;
  target.health = Math.max(0, target.health - reduced);
  target.hitFlash = 0.12;
  target.vx += knockX;
  target.vy += knockY;
  // A slow-mo accent on impact, but don't chain it: only start/renew the beat
  // if the previous one has mostly decayed, so a steady stream of hits (4-player
  // buckshot+blast) reads as crisp impacts rather than a frozen screen.
  if (world.hitStop < 0.02) {
    world.hitStop = Math.max(world.hitStop, heavy ? HIT_STOP_BOOM : HIT_STOP_HURT);
  }
  world.shake = Math.min(1, world.shake + (heavy ? 0.2 : 0.12));
  spawnDamageText(world, target.x, target.y, reduced);
  burst(
    world,
    target.x,
    target.y,
    Math.atan2(knockY, knockX),
    1.2,
    460,
    heavy ? 18 : 12,
    target.color,
    { light: true },
  );
  world.rings.push({
    x: target.x,
    y: target.y,
    size: heavy ? 46 : 36,
    life: 0.25,
    maxLife: 0.25,
    color: "#ffffff",
    filled: false,
  });

  if (target.health <= 0) {
    target.alive = false;
    target.deathTimer = 0;
    burst(world, target.x, target.y, 0, 6.3, 360, 24, "#e8e6df", {
      gravity: 700,
      light: true,
    });
    burst(world, target.x, target.y, 0, 6.3, 260, 16, target.color, {
      gravity: 900,
      shard: true,
    });
    world.shake = Math.min(1, world.shake + 0.4);
  }
  if (check) checkRoundOver(world);
}

/** Kill a player who fell into a pit (out of the arena). */
export function killFallen(world: World, player: PlayerState, check = true): void {
  if (!player.alive) return;
  player.health = 0;
  player.alive = false;
  player.deathTimer = 0;
  burst(world, player.x, player.y, 0, 6.3, 360, 24, "#e8e6df", {
    gravity: 700,
    light: true,
  });
  burst(world, player.x, player.y, 0, 6.3, 260, 16, player.color, {
    gravity: 900,
    shard: true,
  });
  world.shake = Math.min(1, world.shake + 0.4);
  if (check) checkRoundOver(world);
}

export function explode(
  world: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
  ownerId?: number,
): void {
  // Shake + rings + sparks for every blast (cheap, and visual only). Hit-stop
  // is deliberately NOT applied here: with BUCKSHOT+BLAST you fire a spread of
  // explodable pellets, and a blast that only hits a wall (nobody) would
  // freeze the whole sim every shot — the 4-player lag. Hit-stop is applied
  // below only when the blast actually connects with a player.
  world.shake = Math.min(1, world.shake + 0.25 + radius / 220);
  world.rings.push(
    { x, y, size: radius * 1.15, life: 0.3, maxLife: 0.3, color: "#ff9d3c", filled: true },
    { x, y, size: radius * 1.6, life: 0.4, maxLife: 0.4, color: "#fff3c4", filled: true },
  );
  // Scale the particle budget with the blast size: a small bullet blast (radius
  // ~55) needs far fewer sparks than a grenade (radius ~135). Buckshot+blast
  // spawns many blasts per second, so keeping each one light is what keeps
  // 4-player sims smooth.
  const scale = Math.max(0.4, Math.min(1.1, radius / 135));
  burst(world, x, y, 0, 6.3, radius * 2.6, Math.round(16 * scale), "#ff8a2b", {
    light: true,
    gravity: -60,
    sizeScale: 3.5,
  });
  burst(world, x, y, 0, 6.3, radius * 5, Math.round(26 * scale), "#ffd27a", {
    light: true,
    gravity: 600,
  });
  burst(world, x, y, 0, 6.3, radius * 2, Math.round(12 * scale), "#4a4866", {
    gravity: -90,
    sizeScale: 3,
  });
  burst(world, x, y, -Math.PI / 2, 2.6, radius * 4, Math.round(10 * scale), "#7a3f34", {
    gravity: 1100,
  });

  // Wired/swing blocks near the blast get shoved away from it (players, shots,
  // and now explosions all move them).
  explosionImpulseSwing(world, x, y, radius);

  let connected = false;
  for (const target of world.players) {
    if (!target.alive) continue;
    if (ownerId !== undefined && sameTeam(world, ownerId, target.id)) continue;
    const dx = target.x - x;
    const dy = target.y - y;
    const distance = Math.hypot(dx, dy) || 1;
    const factor = 1 - distance / (radius + target.radius);
    if (factor <= 0) continue;
    connected = true;
    applyDamage(
      world,
      target,
      Math.round(damage * factor),
      (dx / distance) * factor * 1200,
      (dy / distance) * factor * 1200 - 120,
      true,
      false, // defer the round check until every target is resolved
    );
  }
  // A blast can kill the last members of every team in one call; only check
  // once all damage is applied so a simultaneous total wipe is a draw rather
  // than a win for whichever player happened to be processed last.
  checkRoundOver(world);

  // Only a blast that actually connects with a player earns the slow-mo beat.
  // Empty-wall buckshot blasts don't freeze the game (that was the lag). The
  // beat only renews once the previous one has decayed, so a constant stream of
  // hits (4-player buckshot+blast) reads as impact, not a frozen screen.
  if (connected && world.hitStop < 0.02) {
    world.hitStop = Math.max(world.hitStop, 0.02 + radius / 4000);
  }
}

/**
 * A buckshot spread that lands as a tight cluster in one tick should explode
 * as ONE blast, not one full explosion (and particle burst) per pellet. Mark
 * any other live, nearby explodable bullet as dead so it's absorbed into the
 * first one that detonates. Same look, a fraction of the per-frame cost.
 */
function absorbExplosionCluster(world: World, bullet: Bullet): void {
  for (const other of world.bullets) {
    if (other === bullet || !other.explodes || other.dead) continue;
    if (Math.hypot(other.x - bullet.x, other.y - bullet.y) < 56) {
      other.dead = true;
    }
  }
}

function hitPlayerWithBullet(world: World, bullet: Bullet, target: PlayerState): void {
  if (bullet.explodes) {
    bullet.dead = true;
    absorbExplosionCluster(world, bullet);
    explode(
      world,
      bullet.x,
      bullet.y,
      40 + bullet.damage * 3.5,
      Math.round(bullet.damage * 1.5),
      bullet.ownerId,
    );
    return;
  }
  applyDamage(world, target, bullet.damage, bullet.vx * 0.1, -140, false);
  if (bullet.pierce > 0) {
    bullet.pierce -= 1;
    bullet.hitIds.push(target.id);
  } else {
    bullet.dead = true;
  }
}

export function updateBullets(world: World, dt: number): void {
  const substeps = 2;
  for (const bullet of world.bullets) {
    for (let step = 0; step < substeps; step += 1) {
      if (bullet.dead) break;
      bullet.x += (bullet.vx * dt) / substeps;
      bullet.y += (bullet.vy * dt) / substeps;

      for (const platform of world.platformList) {
        const contact = circleVsAabb(bullet.x, bullet.y, bullet.radius, platform);
        if (!contact) continue;
        bullet.x += contact.nx * contact.penetration;
        bullet.y += contact.ny * contact.penetration;
        // A shot pushes a hanging swing block along its travel direction.
        if (platform.swingIndex !== undefined) {
          impulseSwing(world, platform.swingIndex, bullet.vx, bullet.vy);
        }
        if (bullet.explodes) {
          // A buckshot spread hits a wall as a tight cluster in one tick;
          // absorb the neighbours into this single blast instead of spawning
          // a separate full explosion (and particle burst) per pellet. Same
          // look, a fraction of the per-frame cost.
          absorbExplosionCluster(world, bullet);
          explode(
            world,
            bullet.x,
            bullet.y,
            40 + bullet.damage * 3.5,
            Math.round(bullet.damage * 1.5),
            bullet.ownerId,
          );
          bullet.dead = true;
          break;
        }
        const intoSurface = bullet.vx * contact.nx + bullet.vy * contact.ny;
        if (bullet.bounces > 0) {
          if (intoSurface < 0) {
            bullet.vx -= 2 * intoSurface * contact.nx;
            bullet.vy -= 2 * intoSurface * contact.ny;
          }
          bullet.bounces -= 1;
          spawnImpact(world, bullet.x, bullet.y, contact.nx, contact.ny);
        } else {
          spawnImpact(world, bullet.x, bullet.y, contact.nx, contact.ny);
          bullet.dead = true;
        }
        break;
      }
      if (bullet.dead) break;

      for (const target of world.players) {
        if (!target.alive || target.id === bullet.ownerId) continue;
        if (bullet.hitIds.includes(target.id)) continue;
        if (
          Math.hypot(target.x - bullet.x, target.y - bullet.y) <
          target.radius + bullet.radius
        ) {
          // Teammates: the shot lands with an effect but deals no damage.
          if (sameTeam(world, bullet.ownerId, target.id)) {
            const dx = target.x - bullet.x;
            const dy = target.y - bullet.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            spawnFriendlyHit(world, bullet.x, bullet.y, dx / distance, dy / distance);
            bullet.dead = true;
            break;
          }
          hitPlayerWithBullet(world, bullet, target);
          break;
        }
      }
    }

    bullet.trail.push({ x: bullet.x, y: bullet.y });
    if (bullet.trail.length > 7) bullet.trail.shift();
    if (
      bullet.x < -100 ||
      bullet.x > ARENA_WIDTH + 100 ||
      bullet.y < -100 ||
      bullet.y > ARENA_HEIGHT + 100
    ) {
      bullet.dead = true;
    }
  }
  world.bullets = world.bullets.filter((bullet) => !bullet.dead);
}

export function updateGrenades(world: World, dt: number): void {
  for (const grenade of world.grenades) {
    grenade.vy += 1700 * dt;
    grenade.x += grenade.vx * dt;
    grenade.y += grenade.vy * dt;
    grenade.fuse -= dt;
    grenade.rotation += grenade.vx * dt * 0.02;

    for (const platform of world.platformList) {
      const contact = circleVsAabb(
        grenade.x,
        grenade.y,
        grenade.radius,
        platform,
      );
      if (!contact) continue;
      grenade.x += contact.nx * contact.penetration;
      grenade.y += contact.ny * contact.penetration;
      const intoSurface =
        grenade.vx * contact.nx + grenade.vy * contact.ny;
      if (intoSurface < 0) {
        grenade.vx -= 1.5 * intoSurface * contact.nx;
        grenade.vy -= 1.5 * intoSurface * contact.ny;
        grenade.vx *= 0.93;
        if (contact.ny < -0.5 && intoSurface < -120) {
          burst(
            world,
            grenade.x,
            grenade.y + grenade.radius,
            -Math.PI / 2,
            2,
            100,
            3,
            "#9d9bbd",
            { gravity: 250 },
          );
        }
      }
    }

    if (grenade.fuse <= 0) {
      grenade.dead = true;
      explode(world, grenade.x, grenade.y, grenade.blastRadius, grenade.damage, grenade.ownerId);
    }
  }
  world.grenades = world.grenades.filter((grenade) => !grenade.dead);
}

export function incrementGrenadeTimers(world: World, dt: number): void {
  for (const player of world.players) {
    player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt);
  }
}
import {
  AIR_ACCEL,
  CLIMB_STAMINA_DRAIN,
  CLIMB_STAMINA_MAX,
  CLIMB_STAMINA_REGEN,
  GRAVITY,
  GROUND_ACCEL,
  JUMP_SPEED,
  MOVE_SPEED,
  WALL_CLIMB_SPEED,
  WALL_JUMP_SPEED_X,
  WALL_JUMP_SPEED_Y,
  WALL_SLIDE_SPEED,
} from "./constants";
import { burst, spawnClimbDust } from "./effects";
import { circleVsAabb, touchingSide } from "./geometry";
import type { PlayerState, World } from "./types";

export function movePlayer(
  world: World,
  player: PlayerState,
  move: -1 | 0 | 1,
  jumpHeld: boolean,
  jumpPressed: boolean,
  dt: number,
): void {
  const moveSpeed = MOVE_SPEED * (player.cards.includes("DASH") ? 1.22 : 1);
  const jumpSpeed = JUMP_SPEED * (player.cards.includes("SPRING") ? 1.12 : 1);
  const wallJumpY = WALL_JUMP_SPEED_Y * (player.cards.includes("SPRING") ? 1.12 : 1);
  const climbSpeed = WALL_CLIMB_SPEED * (player.cards.includes("SPRING") ? 1.25 : 1);
  const targetSpeed = move * moveSpeed;
  const accel = player.grounded ? GROUND_ACCEL : AIR_ACCEL;
  player.vx += (targetSpeed - player.vx) * Math.min(1, accel * dt);

  player.wallClimbing = false;

  if (player.grounded) {
    player.climbStamina = Math.min(
      CLIMB_STAMINA_MAX,
      player.climbStamina + CLIMB_STAMINA_REGEN * dt,
    );
  }

  if (jumpPressed) {
    if (player.grounded) {
      player.vy = -jumpSpeed;
      player.grounded = false;
      player.squash = 1.3;
      burst(world, player.x, player.y + player.radius, Math.PI / 2, 2.5, 140, 6, "#9d9bbd", {
        gravity: 250,
      });
    } else if (player.wallDir !== 0) {
      const wallDir = player.wallDir;
      player.vx = -wallDir * WALL_JUMP_SPEED_X;
      player.vy = -wallJumpY;
      player.climbStamina = Math.max(0, player.climbStamina - 0.22);
      player.wallDir = 0;
      player.squash = 1.22;
      burst(
        world,
        player.x - wallDir * player.radius,
        player.y,
        -Math.PI / 2,
        2.4,
        160,
        5,
        "#9d9bbd",
        { gravity: 250 },
      );
    }
  }

  const pressingIntoWall =
    !player.grounded && player.wallDir !== 0 && move === player.wallDir;
  const climbWallDir = player.wallDir;

  if (pressingIntoWall && jumpHeld && player.climbStamina > 0 && climbWallDir !== 0) {
    player.wallClimbing = true;
    player.vy = -climbSpeed;
    player.climbStamina = Math.max(0, player.climbStamina - CLIMB_STAMINA_DRAIN * dt);
    if (world.tick % 6 === 0) {
      spawnClimbDust(world, player.x, player.y, climbWallDir);
    }
  } else if (pressingIntoWall && player.vy > WALL_SLIDE_SPEED) {
    player.vy = WALL_SLIDE_SPEED;
  }
}

export function stepPlayerPhysics(world: World, player: PlayerState, dt: number): void {
  const wasGrounded = player.grounded;
  const fallSpeed = player.vy;
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.grounded = false;

  for (const platform of world.platformList) {
    const contact = circleVsAabb(player.x, player.y, player.radius, platform);
    if (!contact) continue;
    player.x += contact.nx * contact.penetration;
    player.y += contact.ny * contact.penetration;
    const velocityIntoSurface =
      player.vx * contact.nx + player.vy * contact.ny;
    if (velocityIntoSurface < 0) {
      player.vx -= velocityIntoSurface * contact.nx;
      player.vy -= velocityIntoSurface * contact.ny;
    }
    if (contact.ny < -0.5) player.grounded = true;
  }

  if (!wasGrounded && player.grounded && fallSpeed > 350) {
    player.squash = 0.7;
    burst(world, player.x, player.y + player.radius, -Math.PI / 2, 2.8, 170, 8, "#9d9bbd", {
      gravity: 250,
    });
    if (fallSpeed > 700) world.shake = Math.min(1, world.shake + 0.12);
  }

  player.squash += (1 - player.squash) * Math.min(1, 12 * dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);

  if (player.grounded) {
    player.wallDir = 0;
  } else {
    const left = touchingSide(
      world.platformList,
      player.x,
      player.y,
      player.radius,
      -1,
    );
    const right = touchingSide(
      world.platformList,
      player.x,
      player.y,
      player.radius,
      1,
    );
    player.wallDir = left ? -1 : right ? 1 : 0;
  }
}
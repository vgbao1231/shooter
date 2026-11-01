import { FIXED_DT } from "./constants";
import { segmentBlocked } from "./geometry";
import { nextRandom } from "./rng";
import type { BotBrain, InputFrame, PlayerState, World } from "./types";

function brainFor(world: World, bot: PlayerState): BotBrain {
  const existing = world.bots.get(bot.id);
  if (existing) return existing;
  const created: BotBrain = {
    decisionTimer: 0,
    strafeDir: 1,
    jumpTimer: 0,
    grenadeTimer: 2,
    weaponTimer: 0,
  };
  world.bots.set(bot.id, created);
  return created;
}

function random(world: World): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

/** True when a solid platform surface is at/just below (x, y). */
function hasSupportAhead(world: World, x: number, y: number): boolean {
  for (const platform of world.platformList) {
    if (platform.kind === "frame") continue;
    if (x >= platform.x - 2 && x <= platform.x + platform.w + 2) {
      if (y >= platform.y - 6 && y <= platform.y + platform.h) return true;
    }
  }
  return false;
}

export function createBotInput(
  world: World,
  bot: PlayerState,
  difficulty: "easy" | "normal" | "hard" = "normal",
): InputFrame {
  const target = world.players
    .filter((player) => player.alive && !player.isBot)
    .sort(
      (left, right) =>
        Math.hypot(left.x - bot.x, left.y - bot.y) -
        Math.hypot(right.x - bot.x, right.y - bot.y),
    )[0];

  const neutral: InputFrame = {
    playerId: bot.id,
    seq: world.tick,
    move: 0,
    jumpHeld: false,
    shootHeld: false,
    grenadeHeld: false,
    aimX: bot.x + Math.cos(bot.aimAngle) * 400,
    aimY: bot.y + Math.sin(bot.aimAngle) * 400,
  };

  if (!bot.alive || !target) return neutral;

  const brain = brainFor(world, bot);
  brain.decisionTimer -= FIXED_DT;
  brain.jumpTimer = Math.max(0, brain.jumpTimer - FIXED_DT);
  brain.grenadeTimer = Math.max(0, brain.grenadeTimer - FIXED_DT);
  brain.weaponTimer -= FIXED_DT;

  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const aimErrorBase =
    difficulty === "easy" ? 0.13 : difficulty === "hard" ? 0.045 : 0.08;
  const aimError = (random(world) - 0.5) * aimErrorBase;
  const aimAngle = Math.atan2(dy, dx) + aimError;

  if (brain.decisionTimer <= 0) {
    brain.decisionTimer = 0.55 + random(world) * 1.1;
    const roll = random(world);
    brain.strafeDir = roll < 0.36 ? -1 : roll < 0.72 ? 1 : 0;
    if (bot.grounded && (dy < -80 || random(world) < 0.22)) {
      brain.jumpTimer = 0.16;
    }
  }

  let move: -1 | 0 | 1 = 0;
  if (Math.abs(dx) > 360) {
    move = dx > 0 ? 1 : -1;
  } else if (Math.abs(dx) < 150) {
    move = dx > 0 ? -1 : 1;
  } else {
    move = brain.strafeDir;
  }

  if (bot.wallDir !== 0 && target.y < bot.y - 40) {
    move = bot.wallDir;
    if (bot.vy > 0 && random(world) < 0.72) brain.jumpTimer = 0.2;
  }

  // Do not walk into a pit: jump if there is runway, otherwise back off.
  if (bot.grounded && move !== 0) {
    const feetY = bot.y + bot.radius;
    const edgeX = bot.x + move * bot.radius;
    const aheadX = bot.x + move * (bot.radius + 8);
    if (!hasSupportAhead(world, aheadX, feetY)) {
      if (hasSupportAhead(world, edgeX, feetY)) {
        brain.jumpTimer = 0.22;
      } else {
        move = move === 1 ? -1 : 1;
      }
    }
  }

  const sightBlocked = segmentBlocked(
    world.platformList,
    bot.x,
    bot.y,
    target.x,
    target.y,
  );
  const fireChance =
    difficulty === "easy" ? 0.9 : difficulty === "hard" ? 2.4 : 1.55;
  const shootHeld =
    !sightBlocked &&
    distance < 1000 &&
    random(world) < FIXED_DT * fireChance;

  let grenadeHeld = false;
  if (
    !sightBlocked &&
    distance > 240 &&
    distance < 680 &&
    brain.grenadeTimer <= 0
  ) {
    grenadeHeld = true;
    brain.grenadeTimer = 3.2 + random(world) * 2.4;
  }

  return {
    playerId: bot.id,
    seq: world.tick,
    move,
    jumpHeld: brain.jumpTimer > 0,
    shootHeld,
    grenadeHeld,
    aimX: bot.x + Math.cos(aimAngle) * 600,
    aimY: bot.y + Math.sin(aimAngle) * 600,
  };
}
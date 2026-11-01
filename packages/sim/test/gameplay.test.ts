import { describe, expect, it } from "vitest";
import {
  applyCard,
  createWorld,
  explode,
  fireWeapon,
  FIXED_DT,
  getBot,
  getPlayer,
  ROUND_COUNTDOWN,
  ROUND_END_DELAY,
  stepWorld,
} from "../src";
import type { InputFrame, World } from "../src";

function input(
  playerId: number,
  overrides: Partial<InputFrame> = {},
): InputFrame {
  const player = getWorldPlayer(overrides.aimX, overrides.aimY);
  return {
    playerId,
    seq: 0,
    move: 0,
    jumpHeld: false,
    shootHeld: false,
    grenadeHeld: false,
    aimX: player.x,
    aimY: player.y,
    ...overrides,
  };
}

function getWorldPlayer(aimX?: number, aimY?: number) {
  return { x: aimX ?? 640, y: aimY ?? 360 };
}

function step(
  world: World,
  commands: InputFrame[],
  ticks: number,
): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    stepWorld(
      world,
      commands.map((command, index) => ({
        ...command,
        seq: world.tick + index,
      })),
    );
  }
}

describe("movement", () => {
  it("falls onto the arena and settles", () => {
    const world = createWorld({ seed: 1 });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;

    step(world, [input(0)], 90);
    expect(player.grounded).toBe(true);
    expect(player.y).toBeGreaterThan(350);
    expect(player.health).toBe(100);
  });

  it("moves horizontally without tunneling through the left wall", () => {
    const world = createWorld({ seed: 2 });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    player.x = 46;
    player.y = 300;
    player.vx = 0;

    step(world, [input(0, { move: -1 })], 45);
    // Left frame wall ends at x=24; player radius 20 → rests at x≈44.
    expect(player.x).toBeGreaterThanOrEqual(43);
    expect(player.x).toBeLessThan(45);
  });

  it("climbs a wall while holding jump into it", () => {
    const world = createWorld({ seed: 3 });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    player.x = 46;
    player.y = 300;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.prevJumpHeld = true;

    const startY = player.y;
    step(world, [input(0, { move: -1, jumpHeld: true })], 25);
    expect(player.wallClimbing || player.y < startY).toBe(true);
    expect(player.y).toBeLessThan(startY - 20);
  });
});

describe("combat", () => {
  it("fires a pistol bullet and damages the bot", () => {
    const world = createWorld({ seed: 4, botEnabled: false });
    const player = getPlayer(world, 0);
    const bot = getBot(world);
    expect(player && bot).toBeDefined();
    if (!player || !bot) return;

    player.x = 480;
    player.y = 580;
    player.grounded = true;
    bot.x = 700;
    bot.y = 580;
    player.aimAngle = 0;
    player.aimX = 900;
    player.aimY = 580;
    player.weaponId = "pistol";
    fireWeapon(world, player);
    step(world, [input(0)], 20);

    expect(bot.health).toBeLessThan(100);
  });

  it("applies grenade damage with falloff and can end the round", () => {
    const world = createWorld({ seed: 5, botEnabled: false });
    const player = getPlayer(world, 0);
    const bot = getBot(world);
    expect(player && bot).toBeDefined();
    if (!player || !bot) return;

    player.x = 500;
    player.y = 618;
    bot.x = 620;
    bot.y = 618;
    explode(world, player.x, player.y, 135, 45);

    expect(player.health).toBe(55);
    expect(bot.health).toBeGreaterThan(55);
    expect(bot.health).toBeLessThan(100);
  });

  it("changes fire cooldown when RAPID is applied", () => {
    const world = createWorld({ seed: 6, botEnabled: false });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    player.weaponId = "pistol";
    applyCard(world, player, "RAPID");
    fireWeapon(world, player);
    expect(player.fireCooldown).toBeCloseTo(0.168, 3);
  });
});

describe("pits", () => {
  it("kills a player who falls into a pit (out of the arena)", () => {
    const world = createWorld({ seed: 40, botEnabled: false });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    // Over the left pit (x300-420): no floor below → fall and die.
    player.x = 360;
    player.y = 600;
    player.vx = 0;
    player.vy = 0;
    step(world, [input(0)], 80);
    expect(player.alive).toBe(false);
    expect(player.health).toBe(0);
  });

  it("does not kill a player standing on solid floor", () => {
    const world = createWorld({ seed: 41, botEnabled: false });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    // On the central base platform (x420-860).
    player.x = 640;
    player.y = 580;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    step(world, [input(0)], 40);
    expect(player.alive).toBe(true);
  });
});

describe("fixed step", () => {
  it("advances exactly one tick per step", () => {
    const world = createWorld({ seed: 8 });
    stepWorld(world, [input(0)]);
    expect(world.tick).toBe(1);
    expect(world.time).toBeCloseTo(FIXED_DT, 6);
  });
});

/** Step a match world until the round countdown elapses and play begins. */
function tickUntilPlaying(world: World): void {
  let guard = 0;
  while (world.roundState === "countdown" && guard < 200) {
    step(world, [input(0)], 1);
    guard += 1;
  }
  expect(world.roundState).toBe("playing");
}

/** Clear hitStop so the round-over state machine can advance. */
function clearHitStop(world: World): void {
  let guard = 0;
  while (world.hitStop > 0 && guard < 30) {
    step(world, [input(0)], 1);
    guard += 1;
  }
}

/** Kill the first bot via an explosion and enter the roundEnd banner. */
function killBot(world: World): void {
  const player = getPlayer(world, 0);
  const bot = getBot(world);
  expect(player).toBeDefined();
  expect(bot).toBeDefined();
  if (!player || !bot) return;
  // Safe, separated positions on the central base platform (x420-860, no pits).
  player.x = 500;
  player.y = 580;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  bot.x = 640;
  bot.y = 580;
  bot.vx = 0;
  bot.vy = 0;
  bot.grounded = true;
  bot.health = 1;
  explode(world, bot.x, bot.y, 80, 100);
  clearHitStop(world);
  step(world, [input(0)], 1); // roundOver → stepMatchRoundOver → roundEnd
  expect(world.roundOver).toBe(true);
  expect(world.winnerId).toBe(player.id);
  expect(world.roundState).toBe("roundEnd");
}

describe("match", () => {
  it("starts in countdown and freezes play until it elapses", () => {
    const world = createWorld({
      seed: 50,
      mode: "match",
      botCount: 1,
      botDifficulty: "normal",
      matchTarget: 2,
    });
    expect(world.roundState).toBe("countdown");
    expect(world.roundTimer).toBeCloseTo(ROUND_COUNTDOWN, 5);

    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    player.x = 640;
    player.y = 580;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    const startX = player.x;

    // Input is ignored while the countdown freezes play.
    step(world, [input(0, { move: 1 })], 10);
    expect(world.roundState).toBe("countdown");
    expect(player.x).toBeCloseTo(startX, 3);
    expect(world.tick).toBe(10);

    tickUntilPlaying(world);
  });

  it("awards a round to the winner and starts the next countdown", () => {
    const world = createWorld({
      seed: 51,
      mode: "match",
      botCount: 1,
      botDifficulty: "normal",
      matchTarget: 2,
    });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;

    tickUntilPlaying(world);
    killBot(world);
    expect(player.score).toBe(1);

    // Step through the roundEnd delay into the next round's countdown.
    step(world, [input(0)], Math.ceil(ROUND_END_DELAY / FIXED_DT) + 5);
    expect(world.roundNumber).toBe(2);
    expect(world.roundState).toBe("countdown");
    expect(world.roundOver).toBe(false);
    expect(world.winnerId).toBeNull();
    expect(getBot(world)?.alive).toBe(true);
    // Score persists across rounds.
    expect(player.score).toBe(1);
  });

  it("ends the match when a player reaches the target score", () => {
    const world = createWorld({
      seed: 52,
      mode: "match",
      botCount: 1,
      botDifficulty: "normal",
      matchTarget: 2,
    });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;

    tickUntilPlaying(world);
    killBot(world); // score 1
    step(world, [input(0)], Math.ceil(ROUND_END_DELAY / FIXED_DT) + 5);

    tickUntilPlaying(world);
    killBot(world); // score 2 → reaches target
    expect(player.score).toBe(2);

    step(world, [input(0)], Math.ceil(ROUND_END_DELAY / FIXED_DT) + 5);
    expect(world.matchOver).toBe(true);
    expect(world.roundState).toBe("matchEnd");
  });
});
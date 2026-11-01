import { describe, expect, it } from "vitest";
import {
  applyCard,
  createWorld,
  explode,
  fireWeapon,
  FIXED_DT,
  getArena,
  getBot,
  getPlayer,
  impulseSwing,
  pickCard,
  ARENAS,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  CARD_CATALOG,
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

  it("does not tunnel through a solid wall", () => {
    const world = createWorld({ seed: 2, botEnabled: false });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    // On the right-floor lane, push right into the mirrored tower column.
    player.x = 1350;
    player.y = 672;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;

    step(world, [input(0, { move: 1 })], 45);
    // Tower column left face x=1510; player radius 16 → rests at x≈1494.
    expect(player.x).toBeGreaterThanOrEqual(1488);
    expect(player.x).toBeLessThan(1500);
  });

  it("climbs a wall while holding jump into it", () => {
    const world = createWorld({ seed: 3 });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    // Press right into the right tower's clean left face (x=1506).
    player.x = 1490;
    player.y = 380;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.prevJumpHeld = true;

    const startY = player.y;
    step(world, [input(0, { move: 1, jumpHeld: true })], 25);
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

    // Clear horizontal lane on the right floor; the bullet travels right.
    player.x = 1150;
    player.y = 672;
    player.grounded = true;
    bot.x = 1400;
    bot.y = 672;
    player.aimAngle = 0;
    player.aimX = 1500;
    player.aimY = 672;
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
    // Over the left pit (x540-600) at floor level, under the front beam: no
    // floor below → fall and die.
    player.x = 570;
    player.y = 672;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    step(world, [input(0)], 80);
    expect(player.alive).toBe(false);
    expect(player.health).toBe(0);
  });

  it("does not kill a player standing on solid floor", () => {
    const world = createWorld({ seed: 41, botEnabled: false });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    // On the long front beam (top 600).
    player.x = 300;
    player.y = 584;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    step(world, [input(0)], 40);
    expect(player.alive).toBe(true);
  });
});

describe("arenas", () => {
  it("keeps every platform and spawn inside the 1600×720 bounds", () => {
    for (const arena of Object.values(ARENAS)) {
      for (const platform of arena.platforms) {
        expect(platform.x).toBeGreaterThanOrEqual(0);
        expect(platform.y).toBeGreaterThanOrEqual(0);
        expect(platform.x + platform.w).toBeLessThanOrEqual(ARENA_WIDTH);
        expect(platform.y + platform.h).toBeLessThanOrEqual(ARENA_HEIGHT);
        expect(platform.w).toBeGreaterThan(0);
        expect(platform.h).toBeGreaterThan(0);
      }
      const spawns = [arena.spawns.player, arena.spawns.bot, ...arena.spawns.bots];
      for (const spawn of spawns) {
        expect(spawn.x).toBeGreaterThanOrEqual(0);
        expect(spawn.x).toBeLessThanOrEqual(ARENA_WIDTH);
        expect(spawn.y).toBeGreaterThanOrEqual(0);
        expect(spawn.y).toBeLessThanOrEqual(ARENA_HEIGHT);
      }
      expect(arena.width).toBe(ARENA_WIDTH);
      expect(arena.height).toBe(ARENA_HEIGHT);
    }
  });

  it("Skyline: a player on the right floor survives, but the central pit kills", () => {
    const arena = getArena("skyline");
    expect(arena.id).toBe("skyline");

    // Standing on the right floor (x960-1580, top y688).
    const safe = createWorld({ seed: 60, arenaId: "skyline", botEnabled: false });
    const safePlayer = getPlayer(safe, 0);
    expect(safePlayer).toBeDefined();
    if (safePlayer) {
      safePlayer.x = 1200;
      safePlayer.y = 672;
      safePlayer.vx = 0;
      safePlayer.vy = 0;
      safePlayer.grounded = true;
      step(safe, [input(0)], 40);
      expect(safePlayer.alive).toBe(true);
    }

    // Over the central pit slot (x700-760 gap): no floor below → fall and die.
    const pit = createWorld({ seed: 61, arenaId: "skyline", botEnabled: false });
    const pitPlayer = getPlayer(pit, 0);
    expect(pitPlayer).toBeDefined();
    if (pitPlayer) {
      pitPlayer.x = 730;
      pitPlayer.y = 600;
      pitPlayer.vx = 0;
      pitPlayer.vy = 0;
      step(pit, [input(0)], 80);
      expect(pitPlayer.alive).toBe(false);
      expect(pitPlayer.health).toBe(0);
    }
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

describe("swing platforms", () => {
  it("a displaced swing returns toward equilibrium over time", () => {
    const world = createWorld({ seed: 9, arenaId: "skyline", botEnabled: false });
    expect(world.swingDefs.length).toBeGreaterThan(0);
    const state = world.swingState[0];
    expect(state).toBeDefined();
    if (!state) return;
    state.angle = 0.4;
    state.angVel = 0;
    step(world, [input(0)], 300);
    expect(Math.abs(state.angle)).toBeLessThan(0.1);
  });

  it("a player standing on a swing tips it away from the anchor", () => {
    const world = createWorld({ seed: 10, arenaId: "skyline", botEnabled: false });
    const state = world.swingState[0];
    const def = world.swingDefs[0];
    const player = getPlayer(world, 0);
    expect(state && def && player).toBeDefined();
    if (!state || !def || !player) return;
    // Stand on the crane block (anchor 800,20 → centre ~800,220), offset right.
    const cx = def.anchorX + def.length * Math.sin(state.angle);
    const cy = def.anchorY + def.length * Math.cos(state.angle) + state.bob;
    player.x = cx + 45;
    player.y = cy - def.h / 2 - player.radius;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    step(world, [input(0)], 60);
    expect(state.angle).toBeGreaterThan(0.01);
  });

  it("a bullet impulse kicks a swing block sideways and up", () => {
    const world = createWorld({ seed: 11, arenaId: "skyline", botEnabled: false });
    const state = world.swingState[0];
    expect(state).toBeDefined();
    if (!state) return;
    // A fast shot travelling right and slightly up.
    impulseSwing(world, 0, 600, -200);
    expect(state.angVel).toBeGreaterThan(0); // sways right
    expect(state.bobVel).toBeLessThan(0); // pops up
  });

  it("a shot that reaches a swing block sways it (bullet contact)", () => {
    const world = createWorld({ seed: 12, arenaId: "skyline", botEnabled: false });
    const state = world.swingState[0];
    const def = world.swingDefs[0];
    const shooter = getPlayer(world, 0);
    expect(state && def && shooter).toBeDefined();
    if (!state || !def || !shooter) return;
    const cx = def.anchorX + def.length * Math.sin(state.angle);
    const cy = def.anchorY + def.length * Math.cos(state.angle) + state.bob;
    // Shooter to the left of the block, aiming straight right into its centre.
    shooter.x = cx - 300;
    shooter.y = cy;
    shooter.vx = 0;
    shooter.vy = 0;
    shooter.grounded = true;
    shooter.aimAngle = 0;
    shooter.aimX = cx;
    shooter.aimY = cy;
    shooter.weaponId = "pistol";
    fireWeapon(world, shooter);
    step(world, [input(0)], 30);
    expect(Math.abs(state.angle)).toBeGreaterThan(0.01);
  });

  it("a player jumping up into a swing block pops it upward (bob < 0)", () => {
    const world = createWorld({ seed: 13, arenaId: "skyline", botEnabled: false });
    const state = world.swingState[0];
    const def = world.swingDefs[0];
    const player = getPlayer(world, 0);
    expect(state && def && player).toBeDefined();
    if (!state || !def || !player) return;
    const cx = def.anchorX + def.length * Math.sin(state.angle);
    const cy = def.anchorY + def.length * Math.cos(state.angle) + state.bob;
    const bottom = cy + def.h / 2;
    // Put the player's head just under the block, moving up fast.
    player.x = cx;
    player.y = bottom + player.radius + 4;
    player.vx = 0;
    player.vy = -400;
    player.grounded = false;
    step(world, [input(0)], 1);
    expect(state.bob).toBeLessThan(0);
  });

  it("an explosion near a swing block shoves it away from the blast", () => {
    const world = createWorld({ seed: 22, arenaId: "skyline", botEnabled: false });
    const state = world.swingState[0];
    const def = world.swingDefs[0];
    expect(state && def).toBeDefined();
    if (!state || !def) return;
    const cx = def.anchorX + def.length * Math.sin(state.angle);
    const cy = def.anchorY + def.length * Math.cos(state.angle) + state.bob;
    // Explode to the LEFT of the block → the block sways right.
    explode(world, cx - def.w, cy, 80, 100);
    expect(state.angVel).toBeGreaterThan(0);
  });

  it("a buckshot cluster merges into one blast (no per-pellet explosion)", () => {
    const world = createWorld({
      seed: 21,
      arenaId: "proving-grounds",
      botEnabled: false,
    });
    // Two exploding pellets in a tight cluster flying into the left tower's
    // right face (from open air, the realistic case for a buckshot spread).
    const makeBullet = (x: number) => ({
      id: world.nextEntityId++,
      ownerId: 0,
      x,
      y: 360,
      vx: -900,
      vy: 0,
      radius: 6,
      damage: 8,
      bounces: 0,
      explodes: true,
      pierce: 0,
      hitIds: [] as number[],
      color: "#fff",
      dead: false,
      trail: [] as Array<{ x: number; y: number }>,
    });
    world.bullets.push(makeBullet(200), makeBullet(206));
    const ringsBefore = world.rings.length;
    step(world, [input(0)], 12);
    // One merged blast → exactly 2 rings (two separate blasts would be 4).
    expect(world.rings.length - ringsBefore).toBe(2);
  });
});

describe("team mode", () => {
  it("teammates don't take bullet damage (effects still fire)", () => {
    const world = createWorld({
      seed: 12,
      mode: "training",
      humanCount: 2,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 0],
      botEnabled: false,
    });
    const shooter = getPlayer(world, 0);
    const mate = getPlayer(world, 1);
    expect(shooter && mate).toBeDefined();
    if (!shooter || !mate) return;
    shooter.x = 1100;
    shooter.y = 672;
    shooter.grounded = true;
    mate.x = 1400;
    mate.y = 672;
    mate.grounded = true;
    shooter.aimAngle = 0;
    shooter.aimX = 1500;
    shooter.aimY = 672;
    shooter.weaponId = "pistol";
    fireWeapon(world, shooter);
    step(world, [input(0), input(1)], 20);
    expect(mate.health).toBe(100);
  });

  it("enemies take bullet damage in team mode", () => {
    const world = createWorld({
      seed: 12,
      mode: "training",
      humanCount: 2,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 1],
      botEnabled: false,
    });
    const shooter = getPlayer(world, 0);
    const enemy = getPlayer(world, 1);
    expect(shooter && enemy).toBeDefined();
    if (!shooter || !enemy) return;
    shooter.x = 1100;
    shooter.y = 672;
    shooter.grounded = true;
    enemy.x = 1400;
    enemy.y = 672;
    enemy.grounded = true;
    shooter.aimAngle = 0;
    shooter.aimX = 1500;
    shooter.aimY = 672;
    shooter.weaponId = "pistol";
    fireWeapon(world, shooter);
    step(world, [input(0), input(1)], 20);
    expect(enemy.health).toBeLessThan(100);
  });

  it("team mode: a normal bullet kill ends the round (no deadlock)", () => {
    const world = createWorld({
      seed: 17,
      mode: "training",
      humanCount: 2,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 1],
      botEnabled: false,
    });
    const shooter = getPlayer(world, 0);
    const enemy = getPlayer(world, 1);
    expect(shooter && enemy).toBeDefined();
    if (!shooter || !enemy) return;
    shooter.x = 1100;
    shooter.y = 672;
    shooter.grounded = true;
    enemy.x = 1400;
    enemy.y = 672;
    enemy.grounded = true;
    enemy.health = 10; // one pistol hit (12 dmg) kills
    shooter.aimAngle = 0;
    shooter.aimX = 1500;
    shooter.aimY = 672;
    shooter.weaponId = "pistol";
    fireWeapon(world, shooter);
    step(world, [input(0), input(1)], 20);
    expect(enemy.alive).toBe(false);
    expect(world.roundOver).toBe(true);
  });

  it("a grenade spares teammates and the owner in team mode", () => {
    const world = createWorld({
      seed: 13,
      mode: "training",
      humanCount: 2,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 0],
      botEnabled: false,
    });
    const a = getPlayer(world, 0);
    const b = getPlayer(world, 1);
    expect(a && b).toBeDefined();
    if (!a || !b) return;
    a.x = 500;
    a.y = 618;
    b.x = 620;
    b.y = 618;
    explode(world, a.x, a.y, 135, 45, a.id);
    expect(a.health).toBe(100);
    expect(b.health).toBe(100);
  });

  it("team mode: wiping one team ends the round and scores the other", () => {
    const world = createWorld({
      seed: 14,
      mode: "match",
      humanCount: 3,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 0, 1],
      botEnabled: false,
    });
    const a0 = getPlayer(world, 0);
    const enemy = getPlayer(world, 2);
    expect(a0 && enemy).toBeDefined();
    if (!a0 || !enemy) return;
    a0.x = 300;
    a0.y = 600;
    enemy.x = 1000;
    enemy.y = 600;
    explode(world, enemy.x, enemy.y, 200, 500, a0.id);
    expect(world.roundOver).toBe(true);
    expect(world.teamScores[0]).toBe(1);
    expect(world.teamScores[1]).toBe(0);
  });

  it("team mode: a simultaneous total wipe is a draw (no team scores)", () => {
    const world = createWorld({
      seed: 15,
      mode: "match",
      humanCount: 3,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 0, 1],
      botEnabled: false,
    });
    const p0 = getPlayer(world, 0);
    const p1 = getPlayer(world, 1);
    const p2 = getPlayer(world, 2);
    expect(p0 && p1 && p2).toBeDefined();
    if (!p0 || !p1 || !p2) return;
    p0.x = 500;
    p0.y = 600;
    p1.x = 520;
    p1.y = 600;
    p2.x = 540;
    p2.y = 600;
    // An owner-less blast (e.g. a world hazard) wipes every team at once.
    explode(world, 520, 600, 300, 500);
    expect(world.roundOver).toBe(true);
    expect(world.winnerId).toBeNull();
    expect(world.teamScores[0]).toBe(0);
    expect(world.teamScores[1]).toBe(0);
  });

  it("team mode: every team falling into the pit on the same tick is a draw", () => {
    const world = createWorld({
      seed: 16,
      mode: "match",
      humanCount: 3,
      botCount: 0,
      teamCount: 2,
      playerTeams: [0, 0, 1],
      botEnabled: false,
    });
    const p0 = getPlayer(world, 0);
    const p1 = getPlayer(world, 1);
    const p2 = getPlayer(world, 2);
    expect(p0 && p1 && p2).toBeDefined();
    if (!p0 || !p1 || !p2) return;
    // Match mode starts in a countdown that freezes play; run it out first.
    tickUntilPlaying(world);
    // Drop the last member of each team into the pit at once.
    p0.x = 300;
    p0.y = ARENA_HEIGHT + 120;
    p1.x = 320;
    p1.y = ARENA_HEIGHT + 120;
    p2.x = 340;
    p2.y = ARENA_HEIGHT + 120;
    step(world, [input(0), input(1), input(2)], 1);
    expect(world.roundOver).toBe(true);
    expect(world.winnerId).toBeNull();
    expect(world.teamScores[0]).toBe(0);
    expect(world.teamScores[1]).toBe(0);
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

describe("loser picks card (1v1)", () => {
  /** A 1v1 match world (2 players, 2 teams) at the round-end transition. */
  function oneVOne(seed: number): World {
    const world = createWorld({
      seed,
      mode: "match",
      humanCount: 2,
      botCount: 0,
      botDifficulty: "normal",
      matchTarget: 3,
      teamCount: 2,
      playerTeams: [0, 1],
      botEnabled: false,
    });
    tickUntilPlaying(world);
    return world;
  }

  function finishRound(world: World, loserId: number): void {
    const loser = getPlayer(world, loserId);
    const winner = world.players.find((player) => player.id !== loserId);
    expect(loser && winner).toBeDefined();
    if (!loser || !winner) return;
    // Separate the pair, then drop the loser's health to zero.
    loser.x = 500;
    loser.y = 580;
    winner.x = 1100;
    winner.y = 580;
    loser.health = 1;
    explode(world, loser.x, loser.y, 80, 100);
    clearHitStop(world);
    step(world, [input(0)], 1); // roundOver → stepMatchRoundOver → roundEnd + pick
    expect(world.roundOver).toBe(true);
    expect(world.winnerId).toBe(winner.id);
    expect(world.roundState).toBe("roundEnd");
  }

  it("offers the loser 3 cards it doesn't already own", () => {
    const world = oneVOne(101);
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    player.cards = ["RAPID"];
    finishRound(world, 1); // player 0 wins, player 1 loses
    expect(world.cardPick).not.toBeNull();
    const pick = world.cardPick;
    expect(pick).toBeDefined();
    if (!pick) return;
    expect(pick.playerId).toBe(1);
    expect(pick.offers).toHaveLength(3);
    expect(pick.offers).not.toContain("RAPID"); // filtered to cards the loser lacks
    // The winner gets nothing and the round is held (not advanced).
    expect(getPlayer(world, 0)?.cards).toHaveLength(1);
    expect(world.roundNumber).toBe(1);
  });

  it("does not offer a card after a draw (no winner)", () => {
    const world = oneVOne(102);
    // Kill both simultaneously → a total wipe is a draw.
    for (const player of world.players) {
      player.health = 1;
      player.x = 640;
      player.y = 580;
    }
    explode(world, 640, 580, 300, 200);
    clearHitStop(world);
    step(world, [input(0)], 1);
    expect(world.winnerId).toBeNull();
    expect(world.cardPick).toBeNull();
  });

  it("does not offer a card in a team match (2v2)", () => {
    const world = createWorld({
      seed: 103,
      mode: "match",
      humanCount: 2,
      botCount: 2,
      botDifficulty: "normal",
      matchTarget: 3,
      teamCount: 2,
      playerTeams: [0, 0, 1, 1],
    });
    tickUntilPlaying(world);
    const loserTeam = world.players[2] as (typeof world.players)[number];
    const winner = world.players[0] as (typeof world.players)[number];
    loserTeam.health = 1;
    winner.x = 1100;
    winner.y = 580;
    explode(world, loserTeam.x, loserTeam.y, 80, 100);
    clearHitStop(world);
    step(world, [input(0)], 1);
    expect(world.players.length).toBe(4);
    expect(world.cardPick).toBeNull(); // team LAN matches have no cards
  });

  it("auto-picks a card when the timer expires", () => {
    const world = oneVOne(104);
    finishRound(world, 1);
    const loser = getPlayer(world, 1);
    expect(world.cardPick).not.toBeNull();
    expect(loser?.cards).toHaveLength(0);
    if (!world.cardPick) return;
    const firstOffer = world.cardPick.offers[0];
    // Advance past CARD_PICK_TIMEOUT (plus slack) → auto-pick first offer.
    step(world, [input(0)], Math.ceil(20 / FIXED_DT) + 5);
    expect(loser?.cards).toContain(firstOffer);
    expect(world.cardPick).toBeNull();
  });

  it("pickCard applies a valid offer and releases the round", () => {
    const world = oneVOne(105);
    finishRound(world, 1);
    const loser = getPlayer(world, 1);
    expect(world.cardPick).not.toBeNull();
    if (!world.cardPick || !loser) return;
    const choice = world.cardPick.offers[0] as string;
    const accepted = pickCard(world, choice as Parameters<typeof pickCard>[1]);
    expect(accepted).toBe(true);
    expect(loser.cards).toContain(choice);
    expect(world.cardPick).toBeNull();
  });

  it("rejects a card not in the offer", () => {
    const world = oneVOne(106);
    finishRound(world, 1);
    expect(world.cardPick).not.toBeNull();
    if (!world.cardPick) return;
    // Choose a card that is definitely NOT among the three offers.
    const offered = new Set(world.cardPick.offers);
    const notOffered = CARD_CATALOG.find((card) => !offered.has(card.id));
    expect(notOffered).toBeDefined();
    if (!notOffered) return;
    const accepted = pickCard(world, notOffered.id);
    expect(accepted).toBe(false);
    expect(world.cardPick).not.toBeNull();
  });

  it("a bot loser gets a card automatically with no pick held", () => {
    const world = createWorld({
      seed: 107,
      mode: "match",
      humanCount: 1,
      botCount: 1,
      botDifficulty: "normal",
      matchTarget: 3,
      teamCount: 2,
      playerTeams: [0, 1],
    });
    tickUntilPlaying(world);
    const player = getPlayer(world, 0);
    const bot = getBot(world);
    expect(player && bot).toBeDefined();
    if (!player || !bot) return;
    // Player wins, bot loses → bot auto-picks, no cardPick freeze.
    player.x = 1100;
    player.y = 580;
    bot.x = 500;
    bot.y = 580;
    bot.health = 1;
    explode(world, bot.x, bot.y, 80, 100);
    clearHitStop(world);
    step(world, [input(0)], 1);
    expect(world.winnerId).toBe(player.id);
    expect(world.cardPick).toBeNull();
    expect(bot.cards.length).toBe(1);
  });
});
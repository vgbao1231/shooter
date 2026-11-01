import { describe, expect, it } from "vitest";
import {
  createWorld,
  fireWeapon,
  getPlayer,
  getBot,
  stepWorld,
  type InputFrame,
} from "../src";

describe("bullet path in browser setup", () => {
  it("travels across the arena", () => {
    const world = createWorld({ seed: 99, botEnabled: false });
    const player = getPlayer(world, 0);
    const bot = getBot(world);
    expect(player && bot).toBeDefined();
    if (!player || !bot) return;

    // Clear horizontal lane on the right floor; the bullet travels right.
    player.x = 1150;
    player.y = 672;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.aimAngle = 0;
    player.aimX = 1500;
    player.aimY = 672;
    bot.x = 1400;
    bot.y = 672;
    bot.vx = 0;
    bot.vy = 0;

    fireWeapon(world, player);
    const input: InputFrame = {
      playerId: 0,
      seq: 0,
      move: 0,
      jumpHeld: false,
      shootHeld: false,
      grenadeHeld: false,
      aimX: 1500,
      aimY: 672,
    };
    const xs: number[] = [];
    for (let tick = 0; tick < 80; tick += 1) {
      stepWorld(world, [input]);
      if (world.bullets[0]) xs.push(Math.round(world.bullets[0].x));
    }
    expect(xs.length).toBeGreaterThan(0);
    expect(xs[xs.length - 1]).toBeGreaterThan(xs[0] ?? 0);
    expect(bot.health).toBeLessThan(100);
  });
});
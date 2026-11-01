import { describe, expect, it } from "vitest";
import {
  createWorld,
  FIXED_DT,
  getPlayer,
  hashWorld,
  stepWorld,
  type InputFrame,
  type World,
} from "../src";

function command(tick: number): InputFrame {
  const direction = Math.sin(tick / 19) > 0 ? 1 : -1;
  return {
    playerId: 0,
    seq: tick,
    move: direction as -1 | 1,
    jumpHeld: tick % 41 < 7,
    shootHeld: tick % 13 === 0,
    grenadeHeld: tick % 97 === 0,
    aimX: 900,
    aimY: 360,
  };
}

function simulate(world: World, ticks: number): string {
  for (let tick = 0; tick < ticks; tick += 1) {
    stepWorld(world, [command(tick)], FIXED_DT);
  }
  return hashWorld(world);
}

describe("determinism", () => {
  it("produces the same state hash for the same seed and input stream", () => {
    const first = createWorld({ seed: 0xdeadbeef, botEnabled: false });
    const second = createWorld({ seed: 0xdeadbeef, botEnabled: false });

    expect(simulate(first, 180)).toBe(simulate(second, 180));
  });

  it("changes the state hash for a different seed with combat RNG", () => {
    const first = createWorld({ seed: 11, botEnabled: false });
    const second = createWorld({ seed: 12, botEnabled: false });
    expect(simulate(first, 90)).not.toBe(simulate(second, 90));
  });

  it("changes the hash when a card is applied", () => {
    const world = createWorld({ seed: 13, botEnabled: false });
    const player = getPlayer(world, 0);
    expect(player).toBeDefined();
    if (!player) return;
    const before = hashWorld(world);
    player.cards.push("RAPID");
    expect(hashWorld(world)).not.toBe(before);
  });
});
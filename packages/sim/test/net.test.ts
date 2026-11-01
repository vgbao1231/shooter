import { describe, expect, it } from "vitest";
import {
  applySnapshot,
  createRenderWorld,
  createWorld,
  decayEffects,
  getArena,
  interpolateSnapshots,
  serializeWorld,
  stepWorld,
} from "../src";
import type { InputFrame, NetworkSnapshot } from "../src";

function idle(playerId: number): InputFrame {
  return {
    playerId,
    seq: 0,
    move: 0,
    jumpHeld: false,
    shootHeld: false,
    grenadeHeld: false,
    aimX: 640,
    aimY: 360,
  };
}

describe("net snapshot", () => {
  it("serializes and hydrates a render world from a match world", () => {
    const world = createWorld({
      seed: 60,
      mode: "match",
      humanCount: 2,
      botCount: 1,
      botDifficulty: "normal",
      matchTarget: 3,
    });
    // Advance a few ticks so positions/effects exist.
    for (let tick = 0; tick < 20; tick += 1) {
      stepWorld(world, [idle(0), idle(1)]);
    }
    const snapshot = serializeWorld(world);
    expect(snapshot.players).toHaveLength(3);
    expect(snapshot.tick).toBe(world.tick);

    const renderWorld = createRenderWorld(world.arenaId, getArena(world.arenaId).platforms);
    applySnapshot(renderWorld, snapshot);
    expect(renderWorld.players).toHaveLength(3);
    expect(renderWorld.tick).toBe(world.tick);
    expect(renderWorld.roundState).toBe(world.roundState);
    expect(renderWorld.players[0]?.name).toBe(world.players[0]?.name);
    expect(renderWorld.players[0]?.x).toBeCloseTo(world.players[0]?.x ?? 0, 3);
    expect(renderWorld.players[1]?.isBot).toBe(false);
    expect(renderWorld.players[2]?.isBot).toBe(true);
  });

  it("interpolates player positions between snapshots", () => {
    const from: NetworkSnapshot = {
      tick: 100,
      shake: 0,
      roundOver: false,
      winnerId: null,
      roundState: "playing",
      roundNumber: 1,
      matchTarget: 3,
      matchOver: false,
      players: [
        {
          id: 0,
          name: "Alpha",
          x: 100,
          y: 400,
          vx: 0,
          vy: 0,
          aimAngle: 0,
          health: 100,
          maxHealth: 100,
          alive: true,
          color: "#fff",
          isBot: false,
          radius: 20,
          recoil: 0,
          squash: 1,
          hitFlash: 0,
          grounded: true,
          wallDir: 0,
          weaponId: "pistol",
        },
      ],
      bullets: [],
      grenades: [],
      particles: [],
      rings: [],
      flashes: [],
      texts: [],
    };
    const to: NetworkSnapshot = {
      ...from,
      tick: 101,
      players: [{ ...(from.players[0] as NonNullable<typeof from.players>[number]), x: 200 }],
    };
    const mid = interpolateSnapshots(from, to, 0.5);
    expect(mid.players[0]?.x).toBeCloseTo(150, 3);
  });

  it("decays and culls expired effects locally", () => {
    const world = createRenderWorld("proving-grounds", getArena("proving-grounds").platforms);
    world.particles.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0.1,
      maxLife: 0.2,
      size: 2,
      color: "#fff",
      gravity: 0,
      light: true,
      shard: false,
    });
    world.particles.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0.01,
      maxLife: 0.02,
      size: 2,
      color: "#fff",
      gravity: 0,
      light: false,
      shard: false,
    });
    decayEffects(world, 0.05);
    expect(world.particles).toHaveLength(1);
    expect(world.particles[0]?.life).toBeCloseTo(0.05, 5);
  });
});

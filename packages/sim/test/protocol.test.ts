import { describe, expect, it } from "vitest";
import { MAX_SLOTS, sanitizeBotTeams, totalBots } from "../src";

describe("lobby botTeams contract", () => {
  it("pads a short array to the team count with zeros", () => {
    expect(sanitizeBotTeams([1], 3, [0, 0, 0], 0)).toEqual([1, 0, 0]);
  });

  it("trims a long array to the team count", () => {
    expect(sanitizeBotTeams([1, 1, 1, 1], 3, [0, 0, 0], 0)).toEqual([1, 1, 1]);
  });

  it("never goes negative (clamps each team to 0..3)", () => {
    expect(sanitizeBotTeams([-5, 9], 2, [0, 0], 0)).toEqual([0, 3]);
  });

  it("caps humans + bots at the room capacity, trimming from the last team", () => {
    // 2 + 3 = 5 bots > 4 → trim 1 from the last populated team (down to 2).
    expect(sanitizeBotTeams([2, 3], 2, [0, 0], 0)).toEqual([2, 2]);
    // With 2 humans already seated, only 2 bots fit.
    expect(totalBots(sanitizeBotTeams([2, 3], 2, [0, 0], 2))).toBe(MAX_SLOTS - 2);
  });

  it("falls back to the current config when raw is not an array", () => {
    expect(sanitizeBotTeams("nope", 2, [1, 2], 0)).toEqual([1, 2]);
  });

  it("keeps a valid configuration untouched", () => {
    const input = [1, 0];
    expect(sanitizeBotTeams(input, 2, [0, 0], 1)).toEqual([1, 0]);
  });
});

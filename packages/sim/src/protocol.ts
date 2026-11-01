import type { BotDifficulty, CardId } from "./types";

/**
 * LAN wire protocol for Phase 3 (Colyseus rooms + JSON message sync).
 *
 * Shared by the server (`@colyseus/core`) and the client (`colyseus.js`).
 * Room state is NOT schema-typed; the sim is the single authority and we sync
 * render snapshots as JSON messages. Message type constants live here so both
 * sides agree without drift.
 */

export const MSG = {
  // client → server
  REQUEST_LOBBY: "lobby:request",
  SET_NAME: "lobby:setName",
  SET_READY: "lobby:setReady",
  SET_CONFIG: "lobby:setConfig",
  SET_TEAM: "lobby:setTeam",
  START: "lobby:start",
  REMATCH: "match:rematch",
  INPUT: "match:input",
  PICK_CARD: "match:pickCard",
  // server → client
  LOBBY_UPDATE: "lobby:update",
  MATCH_START: "match:start",
  SNAPSHOT: "match:snapshot",
  MATCH_EVENT: "match:event",
  CARD_PICK: "match:cardPick",
  ERROR: "room:error",
} as const;

export interface LobbySlot {
  index: number;
  sessionId: string | null;
  name: string;
  isBot: boolean;
  ready: boolean;
  /** 0-based team column; -1 until the player picks one (auto-assigned). */
  team: number;
}

export interface LobbyConfig {
  /** Bots per team column (index = team, value = bot count); length = teams. */
  botTeams: number[];
  botDifficulty: BotDifficulty;
  matchTarget: number;
  arenaId: string;
  /** Team count: 2/3/4 sides (max 4 players, so no FFA — 4 players = 4 teams). */
  teams: number;
}

export interface LobbyState {
  hostId: string;
  phase: "lobby" | "match";
  slots: LobbySlot[];
  config: LobbyConfig;
  /** Room code used in the share link (e.g. `QH3Z5`). */
  code: string;
}

export interface NetPlayerInfo {
  id: number;
  name: string;
  isBot: boolean;
  color: string;
  score: number;
  team: number;
}

export interface MatchStart {
  selfId: number;
  arenaId: string;
  matchTarget: number;
  botDifficulty: BotDifficulty;
  teamCount: number;
  players: NetPlayerInfo[];
}

export interface MatchEvent {
  type: "roundStart" | "roundEnd" | "matchEnd";
  roundNumber: number;
  winnerId: number | null;
  matchTarget: number;
  playerScores: Record<number, number>;
  teamScores: number[];
  matchOver: boolean;
}

/** Server → loser client: an offer to pick 1 of 3 cards after a scored round. */
export interface CardPickMessage {
  /** "offer" begins a pick; "resolved" ends it (pick applied or auto-picked). */
  phase: "offer" | "resolved";
  playerId: number;
  /** Only on "offer": the 3 choices (already filtered to cards not owned). */
  offers?: CardId[];
  /** Only on "offer": seconds before the sim auto-picks the first card. */
  timeout?: number;
}

/** One fixed-step input frame sent by a human client at up to 60 Hz. */
export interface NetInput {
  seq: number;
  move: -1 | 0 | 1;
  jumpHeld: boolean;
  shootHeld: boolean;
  grenadeHeld: boolean;
  aimX: number;
  aimY: number;
}

export interface RoomError {
  code: string;
  message: string;
}

export const MAX_SLOTS = 4;

export function defaultLobbyConfig(): LobbyConfig {
  return {
    botTeams: [0, 0],
    botDifficulty: "normal",
    matchTarget: 3,
    arenaId: "proving-grounds",
    teams: 2,
  };
}

/**
 * Clamp the per-team bot counts to `teams` entries and cap the total so that
 * `humans + bots` never exceeds the room capacity. Trims from the last team
 * first when over capacity (e.g. a guest joins and fills a slot). Deterministic
 * and shared by the server so the lobby contract stays single-authority.
 */
export function sanitizeBotTeams(
  raw: unknown,
  teams: number,
  fallback: number[],
  humans: number,
): number[] {
  const source = Array.isArray(raw) ? raw : fallback;
  const out: number[] = [];
  let total = humans;
  for (let team = 0; team < teams; team += 1) {
    const value = Math.max(0, Math.min(3, Math.floor(Number(source[team]) || 0)));
    out.push(value);
    total += value;
  }
  for (let team = teams - 1; team >= 0 && total > MAX_SLOTS; team -= 1) {
    const trim = Math.min(out[team] ?? 0, total - MAX_SLOTS);
    out[team] = (out[team] ?? 0) - trim;
    total -= trim;
  }
  return out;
}

export function totalBots(botTeams: number[]): number {
  return botTeams.reduce((sum, count) => sum + count, 0);
}

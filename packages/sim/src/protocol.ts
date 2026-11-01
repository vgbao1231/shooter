import type { BotDifficulty } from "./types";

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
  SET_NAME: "lobby:setName",
  SET_READY: "lobby:setReady",
  SET_CONFIG: "lobby:setConfig",
  START: "lobby:start",
  REMATCH: "match:rematch",
  INPUT: "match:input",
  // server → client
  LOBBY_UPDATE: "lobby:update",
  MATCH_START: "match:start",
  SNAPSHOT: "match:snapshot",
  MATCH_EVENT: "match:event",
  ERROR: "room:error",
} as const;

export interface LobbySlot {
  index: number;
  sessionId: string | null;
  name: string;
  isBot: boolean;
  ready: boolean;
}

export interface LobbyConfig {
  botCount: number;
  botDifficulty: BotDifficulty;
  matchTarget: number;
  arenaId: string;
}

export interface LobbyState {
  hostId: string;
  phase: "lobby" | "match";
  slots: LobbySlot[];
  config: LobbyConfig;
}

export interface NetPlayerInfo {
  id: number;
  name: string;
  isBot: boolean;
  color: string;
  score: number;
}

export interface MatchStart {
  selfId: number;
  arenaId: string;
  matchTarget: number;
  botDifficulty: BotDifficulty;
  players: NetPlayerInfo[];
}

export interface MatchEvent {
  type: "roundStart" | "roundEnd" | "matchEnd";
  roundNumber: number;
  winnerId: number | null;
  matchTarget: number;
  playerScores: Record<number, number>;
  matchOver: boolean;
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

export function defaultLobbyConfig(): LobbyConfig {
  return {
    botCount: 1,
    botDifficulty: "normal",
    matchTarget: 3,
    arenaId: "proving-grounds",
  };
}

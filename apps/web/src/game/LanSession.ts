import { Client, Room } from "colyseus.js";
import {
  interpolateSnapshots,
  MSG,
  type CardId,
  type CardPickMessage,
  type LobbyConfig,
  type LobbyState,
  type MatchEvent,
  type MatchStart,
  type NetInput,
  type NetworkSnapshot,
} from "@inkshot/sim";

export interface LanCallbacks {
  onLobby: (state: LobbyState) => void;
  onMatchStart: (start: MatchStart) => void;
  onMatchEvent: (event: MatchEvent) => void;
  onCardPick: (message: CardPickMessage) => void;
  onError: (message: string) => void;
  onClose: (reason: string) => void;
}

interface TimedSnapshot {
  at: number;
  snap: NetworkSnapshot;
}

const INTERPOLATION_MS = 50;
const BUFFER_SIZE = 5;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short, unambiguous room code for the share link (e.g. `QH3Z5`). */
export function generateRoomCode(length = 5): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Parse a trailing `/CODE` path segment, or a `?code=` param. */
export function roomCodeFromLocation(location: Location): string | null {
  const match = location.pathname.match(/\/([A-Za-z0-9]{4,8})\/?$/);
  if (match) return match[1]!.toUpperCase();
  const param = new URLSearchParams(location.search).get("code");
  return param ? param.toUpperCase() : null;
}

/**
 * The Colyseus host serves the client AND the WebSocket on one port under
 * `pnpm host`, so the page origin is the server. Under `pnpm dev` Vite serves
 * the client on some port (5173, 5174, …) while the host runs on 8080, so we
 * redirect to 8080 on the same hostname (that's why a share link opened in
 * another browser must join the right server, not the dev origin).
 */
export function defaultServerAddr(): string {
  const { protocol, hostname } = window.location;
  // Dev is any Vite port; the Colyseus host is always the sibling :8080.
  if (import.meta.env.DEV) return `${protocol}//${hostname}:8080`;
  return window.location.origin;
}

/**
 * LAN client: connects to the Colyseus host, drives the lobby, and streams the
 * authoritative match. Owns the room and the snapshot buffer; rendering and
 * input are handled by LanRuntime (which calls back into here).
 */
export class LanSession {
  private client: Client | null = null;
  private room: Room | null = null;
  private callbacks: LanCallbacks;
  private selfId = 0;
  private matchStart: MatchStart | null = null;
  private buffer: TimedSnapshot[] = [];
  private disposed = false;

  constructor(callbacks: LanCallbacks) {
    this.callbacks = callbacks;
  }

  get isHost(): boolean {
    return this.room?.sessionId === this.lobby?.hostId;
  }

  get roomSessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get lobbyState(): LobbyState | null {
    return this.lobby;
  }

  get players(): MatchStart | null {
    return this.matchStart;
  }

  get myPlayerId(): number {
    return this.selfId;
  }

  private lobby: LobbyState | null = null;
  private lobbyTimer: ReturnType<typeof setInterval> | null = null;

  async connect(url: string, name: string, code?: string): Promise<void> {
    if (this.disposed) throw new Error("session disposed");
    const client = new Client(url);
    this.client = client;
    const room = await (code
      ? client.join("lobby", { name, code })
      : client.create("lobby", { name, code: generateRoomCode() }));
    this.room = room;

    room.onMessage(MSG.LOBBY_UPDATE, (message: LobbyState) => {
      this.lobby = message;
      if (this.lobbyTimer) {
        clearInterval(this.lobbyTimer);
        this.lobbyTimer = null;
      }
      this.callbacks.onLobby(message);
    });
    room.onMessage(MSG.MATCH_START, (message: MatchStart) => {
      this.selfId = message.selfId;
      this.matchStart = message;
      this.buffer = [];
      this.callbacks.onMatchStart(message);
    });
    room.onMessage(MSG.MATCH_EVENT, (message: MatchEvent) => {
      this.callbacks.onMatchEvent(message);
    });
    room.onMessage(MSG.CARD_PICK, (message: CardPickMessage) => {
      this.callbacks.onCardPick(message);
    });
    room.onMessage(MSG.SNAPSHOT, (message: NetworkSnapshot) => {
      this.pushSnapshot(message);
    });
    room.onMessage(MSG.ERROR, (message: { message?: string }) => {
      this.callbacks.onError(message?.message ?? "Room error");
    });
    room.onLeave((code: number) => {
      this.callbacks.onClose(`Left room (${code})`);
    });

    // The join-time LOBBY_UPDATE may have been dropped by colyseus.js (it
    // discards messages received before `onMessage` is registered), so ask the
    // server to re-send the lobby now that our handlers are attached — and keep
    // asking every 500 ms until one actually arrives. This makes room creation
    // resilient to the race where the first REQUEST_LOBBY lands while the
    // server is still finalizing `onJoin` (leaving an unpopulated lobby).
    room.send(MSG.REQUEST_LOBBY, {});
    this.lobbyTimer = setInterval(() => {
      if (!this.lobby) room.send(MSG.REQUEST_LOBBY, {});
    }, 500);
  }

  private pushSnapshot(snap: NetworkSnapshot): void {
    this.buffer.push({ at: performance.now(), snap });
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
  }

  /** Interpolated snapshot at `now - INTERPOLATION_MS` for smooth remote movement. */
  interpolated(): NetworkSnapshot | null {
    const buffer = this.buffer;
    if (buffer.length === 0) return null;
    const now = performance.now();
    const target = now - INTERPOLATION_MS;

    // Use the oldest available snapshot when the target is older than the buffer.
    const first = buffer[0] as TimedSnapshot;
    if (target <= first.at) return first.snap;

    const last = buffer[buffer.length - 1] as TimedSnapshot;
    if (target >= last.at) return last.snap;

    for (let index = 0; index < buffer.length - 1; index += 1) {
      const a = buffer[index] as TimedSnapshot;
      const b = buffer[index + 1] as TimedSnapshot;
      if (target >= a.at && target <= b.at) {
        const alpha = (target - a.at) / Math.max(1, b.at - a.at);
        return interpolateSnapshots(a.snap, b.snap, alpha);
      }
    }
    return last.snap;
  }

  /** Latest snapshot for the HUD (non-interpolated). */
  latest(): NetworkSnapshot | null {
    return this.buffer.length ? this.buffer[this.buffer.length - 1]!.snap : null;
  }

  sendInput(input: NetInput): void {
    if (!this.room) return;
    this.room.send(MSG.INPUT, input);
  }

  setReady(ready: boolean): void {
    this.room?.send(MSG.SET_READY, { ready });
  }

  setTeam(team: number): void {
    this.room?.send(MSG.SET_TEAM, { team });
  }

  setConfig(config: Partial<LobbyConfig>): void {
    this.room?.send(MSG.SET_CONFIG, config);
  }

  startMatch(): void {
    this.room?.send(MSG.START, {});
  }

  /** The loser's choice for the pending card pick (validated server-side). */
  pickCard(cardId: CardId): void {
    this.room?.send(MSG.PICK_CARD, { cardId });
  }

  rematch(): void {
    this.room?.send(MSG.REMATCH, {});
  }

  setMyName(name: string): void {
    this.room?.send(MSG.SET_NAME, { name });
  }

  disconnect(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.lobbyTimer) {
      clearInterval(this.lobbyTimer);
      this.lobbyTimer = null;
    }
    void this.room?.leave();
    this.room = null;
    this.client = null;
  }
}

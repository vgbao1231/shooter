import { Client, Room } from "colyseus.js";
import {
  interpolateSnapshots,
  MSG,
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
  onError: (message: string) => void;
  onClose: (reason: string) => void;
}

interface TimedSnapshot {
  at: number;
  snap: NetworkSnapshot;
}

const INTERPOLATION_MS = 50;
const BUFFER_SIZE = 5;

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

  async connect(url: string, name: string): Promise<void> {
    if (this.disposed) throw new Error("session disposed");
    const client = new Client(url);
    this.client = client;
    const room = await client.joinOrCreate("lobby", { name });
    this.room = room;

    room.onMessage(MSG.LOBBY_UPDATE, (message: LobbyState) => {
      this.lobby = message;
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
    room.onMessage(MSG.SNAPSHOT, (message: NetworkSnapshot) => {
      this.pushSnapshot(message);
    });
    room.onMessage(MSG.ERROR, (message: { message?: string }) => {
      this.callbacks.onError(message?.message ?? "Room error");
    });
    room.onLeave((code: number) => {
      this.callbacks.onClose(`Left room (${code})`);
    });
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

  setConfig(config: Partial<LobbyConfig>): void {
    this.room?.send(MSG.SET_CONFIG, config);
  }

  startMatch(): void {
    this.room?.send(MSG.START, {});
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
    void this.room?.leave();
    this.room = null;
    this.client = null;
  }
}

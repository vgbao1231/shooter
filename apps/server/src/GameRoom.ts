import { Room, type Client } from "@colyseus/core";
import {
  createBotInput,
  createWorld,
  defaultLobbyConfig,
  FIXED_DT,
  getBots,
  getPlayer,
  MSG,
  resetMatch,
  serializeWorld,
  stepWorld,
  type BotDifficulty,
  type InputFrame,
  type LobbyConfig,
  type LobbySlot,
  type LobbyState,
  type MatchEvent,
  type MatchStart,
  type NetInput,
  type NetPlayerInfo,
  type World,
} from "@inkshot/sim";

const MAX_SLOTS = 4;
const SNAPSHOT_EVERY_TICKS = 2; // 30 Hz at 60 Hz sim

interface SlotState extends LobbySlot {
  // SlotState is LobbySlot + nothing extra; kept for clarity.
}

function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16);
  return cleaned || fallback;
}

/**
 * One process, one room type: the lobby transitions into the match phase when
 * the host starts. The sim (deterministic, shared) is the single authority;
 * clients send input and receive 30 Hz render snapshots as JSON messages.
 */
export class GameRoom extends Room {
  maxClients = MAX_SLOTS;
  autoDispose = true;

  private phase: "lobby" | "match" = "lobby";
  private hostId = "";
  private hostDisconnected = false;
  private slots: SlotState[] = [];
  private config: LobbyConfig = defaultLobbyConfig();
  private world: World | null = null;
  private pendingInputs = new Map<string, NetInput>();
  private sessionToPlayer = new Map<string, number>();
  private tickCounter = 0;
  private simAccumulator = 0;
  private lastRoundState = "";
  private lastWinnerId: number | null = null;
  private lastMatchOver = false;
  private lastRoundNumber = 1;

  onCreate(): void {
    this.setPatchRate(null); // message sync; no state patches
    this.slots = Array.from({ length: MAX_SLOTS }, (_, index) => ({
      index,
      sessionId: null,
      name: `Slot ${index + 1}`,
      isBot: false,
      ready: false,
    }));

    this.onMessage(MSG.SET_NAME, (client, message) => {
      const slot = this.slots.find((entry) => entry.sessionId === client.sessionId);
      if (!slot) return;
      slot.name = sanitizeName((message as { name?: string })?.name, slot.name);
      this.broadcastLobby();
    });

    this.onMessage(MSG.SET_READY, (client, message) => {
      const slot = this.slots.find((entry) => entry.sessionId === client.sessionId);
      if (slot && this.phase === "lobby") {
        slot.ready = Boolean((message as { ready?: boolean })?.ready);
        this.broadcastLobby();
      }
    });

    this.onMessage(MSG.SET_CONFIG, (client, message) => {
      if (client.sessionId !== this.hostId || this.phase !== "lobby") return;
      const next = message as Partial<LobbyConfig>;
      this.config = {
        botCount: clampInt(next.botCount, 0, MAX_SLOTS - 1, this.config.botCount),
        botDifficulty: (["easy", "normal", "hard"] as const).includes(
          next.botDifficulty as BotDifficulty,
        )
          ? (next.botDifficulty as BotDifficulty)
          : this.config.botDifficulty,
        matchTarget: clampInt(next.matchTarget, 2, 9, this.config.matchTarget),
        arenaId:
          typeof next.arenaId === "string" ? next.arenaId : this.config.arenaId,
      };
      this.broadcastLobby();
    });

    this.onMessage(MSG.START, (client) => {
      if (client.sessionId !== this.hostId || this.phase !== "lobby") return;
      this.startMatch();
    });

    this.onMessage(MSG.INPUT, (client, message) => {
      if (this.phase !== "match" || !this.world) return;
      const input = message as Partial<NetInput>;
      this.pendingInputs.set(client.sessionId, {
        seq: Number(input.seq) || 0,
        move: clampInt(input.move, -1, 1, 0) as -1 | 0 | 1,
        jumpHeld: Boolean(input.jumpHeld),
        shootHeld: Boolean(input.shootHeld),
        grenadeHeld: Boolean(input.grenadeHeld),
        aimX: clampInt(input.aimX, 0, 1280, 640),
        aimY: clampInt(input.aimY, 0, 720, 360),
      });
    });

    this.onMessage(MSG.REMATCH, (client) => {
      if (client.sessionId !== this.hostId || !this.world) return;
      if (!this.world.matchOver) return;
      resetMatch(this.world);
      this.lastRoundState = this.world.roundState;
      this.lastRoundNumber = this.world.roundNumber;
      this.lastWinnerId = null;
      this.lastMatchOver = false;
      this.tickCounter = 0;
      this.broadcastMatchEvent("roundStart");
    });
  }

  onJoin(client: Client, options: { name?: string } = {}): void {
    const slot = this.slots.find((entry) => !entry.sessionId);
    if (!slot) {
      client.send(MSG.ERROR, { code: "full", message: "Room is full." });
      client.leave(4001);
      return;
    }
    slot.sessionId = client.sessionId;
    slot.name = sanitizeName(options.name, `P${slot.index + 1}`);
    slot.ready = false;
    if (!this.hostId) this.hostId = client.sessionId;
    this.sessionToPlayer.set(client.sessionId, slot.index);
    this.broadcastLobby();
  }

  onLeave(client: Client): void {
    // Bot takeover mid-match so the round continues without stalling.
    if (this.phase === "match" && this.world) {
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (playerId !== undefined) this.takeoverBot(playerId);
    } else {
      const slot = this.slots.find((entry) => entry.sessionId === client.sessionId);
      if (slot) {
        slot.sessionId = null;
        slot.ready = false;
        slot.name = `Slot ${slot.index + 1}`;
      }
    }
    this.sessionToPlayer.delete(client.sessionId);
    if (this.hostId === client.sessionId) {
      if (this.phase === "match") {
        this.hostId = "";
        this.hostDisconnected = true; // host controls off until match end
      } else {
        this.hostId = this.slots.find((entry) => entry.sessionId)?.sessionId ?? "";
      }
    }
    this.broadcastLobby();
  }

  private startMatch(): void {
    const humans = this.slots.filter((entry) => entry.sessionId);
    const humanCount = humans.length;
    const total = Math.min(MAX_SLOTS, humanCount + this.config.botCount);
    const botCount = Math.max(0, total - humanCount);

    this.world = createWorld({
      seed: 0x5eedc0de,
      mode: "match",
      arenaId: this.config.arenaId,
      botCount,
      humanCount,
      botDifficulty: this.config.botDifficulty,
      matchTarget: this.config.matchTarget,
      playerName: humans[0]?.name ?? "YOU",
      botName: "BOT",
    });

    // Apply per-slot human names for multi-human.
    humans.forEach((slot, index) => {
      const player = getPlayer(this.world as World, index);
      if (player) player.name = slot.name;
    });

    this.phase = "match";
    this.tickCounter = 0;
    this.lastRoundState = this.world.roundState;
    this.lastRoundNumber = this.world.roundNumber;
    this.lastWinnerId = null;
    this.lastMatchOver = false;

    this.simAccumulator = 0;
    this.setSimulationInterval(this.tickSim, 1000 / 60);
    this.broadcastLobby();

    for (const client of this.clients) {
      const selfId = this.sessionToPlayer.get(client.sessionId) ?? 0;
      client.send(MSG.MATCH_START, this.buildMatchStart(selfId));
    }
    this.broadcastMatchEvent("roundStart");
  }

  private buildMatchStart(selfId: number): MatchStart {
    const world = this.world as World;
    return {
      selfId,
      arenaId: world.arenaId,
      matchTarget: world.matchTarget,
      botDifficulty: world.botDifficulty,
      players: world.players.map(
        (player): NetPlayerInfo => ({
          id: player.id,
          name: player.name,
          isBot: player.isBot,
          color: player.color,
          score: player.score,
        }),
      ),
    };
  }

  private takeoverBot(playerId: number): void {
    const world = this.world as World;
    const player = getPlayer(world, playerId);
    if (!player || player.isBot) return;
    player.isBot = true;
    player.botControlled = true;
    player.name = `${player.name} (BOT)`;
    // createBotInput lazily adds the brain to world.bots.
    this.broadcastLobby();
  }

  /** Fixed-step accumulator: always advances the sim by whole FIXED_DT steps.
   *  Colyseus passes deltaTime in MILLISECONDS (its Clock), so convert to seconds. */
  private tickSim = (deltaTimeMs: number): void => {
    const world = this.world;
    if (!world) return;
    this.simAccumulator += Math.min(deltaTimeMs / 1000, 0.1);
    let steps = 0;
    while (this.simAccumulator >= FIXED_DT && steps < 8) {
      this.stepOnce();
      this.simAccumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps === 8) this.simAccumulator = 0;
  };

  private stepOnce(): void {
    const world = this.world;
    if (!world) return;

    const inputs: InputFrame[] = [];
    for (const client of this.clients) {
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (playerId === undefined) continue;
      const input = this.pendingInputs.get(client.sessionId);
      inputs.push({
        playerId,
        seq: world.tick,
        move: input?.move ?? 0,
        jumpHeld: input?.jumpHeld ?? false,
        shootHeld: input?.shootHeld ?? false,
        grenadeHeld: input?.grenadeHeld ?? false,
        aimX: input?.aimX ?? 640,
        aimY: input?.aimY ?? 360,
      });
    }
    if (world.botEnabled) {
      for (const bot of getBots(world)) {
        inputs.push(createBotInput(world, bot, world.botDifficulty));
      }
    }
    stepWorld(world, inputs);

    this.tickCounter += 1;
    if (this.tickCounter % SNAPSHOT_EVERY_TICKS === 0) {
      this.broadcast(MSG.SNAPSHOT, serializeWorld(world));
    }
    this.detectRoundEvents();
  }

  private detectRoundEvents(): void {
    const world = this.world as World;
    if (world.roundState !== this.lastRoundState) {
      if (world.roundState === "roundEnd") {
        this.broadcastMatchEvent("roundEnd");
      } else if (world.roundState === "matchEnd" && !this.lastMatchOver) {
        this.broadcastMatchEvent("matchEnd");
      }
    }
    if (world.roundNumber !== this.lastRoundNumber) {
      this.lastRoundNumber = world.roundNumber;
      this.broadcastMatchEvent("roundStart");
    }
    this.lastRoundState = world.roundState;
    this.lastMatchOver = world.matchOver;
    this.lastWinnerId = world.winnerId;
  }

  private broadcastMatchEvent(type: MatchEvent["type"]): void {
    const world = this.world as World;
    const scores: Record<number, number> = {};
    for (const player of world.players) scores[player.id] = player.score;
    const event: MatchEvent = {
      type,
      roundNumber: world.roundNumber,
      winnerId: world.winnerId,
      matchTarget: world.matchTarget,
      playerScores: scores,
      matchOver: world.matchOver,
    };
    this.broadcast(MSG.MATCH_EVENT, event);
  }

  private broadcastLobby(): void {
    const state: LobbyState = {
      hostId: this.hostId,
      phase: this.phase,
      slots: this.slots.map((slot) => ({ ...slot })),
      config: { ...this.config },
    };
    this.broadcast(MSG.LOBBY_UPDATE, state);
  }
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

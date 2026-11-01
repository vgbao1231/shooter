import { Room, type Client } from "@colyseus/core";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ARENAS,
  createBotInput,
  createWorld,
  defaultLobbyConfig,
  FIXED_DT,
  getBots,
  getPlayer,
  MAX_SLOTS,
  MSG,
  pickCard,
  resetMatch,
  sanitizeBotTeams,
  serializeWorld,
  stepWorld,
  totalBots,
  type BotDifficulty,
  type CardId,
  type CardPickMessage,
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

const SNAPSHOT_EVERY_TICKS = 2; // 30 Hz at 60 Hz sim
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Room codes currently live across processes; used to reject duplicates. */
const activeCodes = new Set<string>();

function generateCode(length = 5): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function sanitizeCode(raw: unknown): string {
  if (typeof raw !== "string") return generateCode();
  const cleaned = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
  return cleaned.length >= 4 ? cleaned : generateCode();
}

function teamCountOf(value: unknown, fallback: number): number {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  // Max 4 occupied slots; "free-for-all" is just 4 teams, so the lobby only
  // offers 2–4 (a 1-team mode would be meaningless here).
  return Math.max(2, Math.min(4, number));
}

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
  /** Player id the last CARD_PICK offer went to (to detect resolve/clear). */
  private lastCardPickPlayerId: number | null = null;
  private code = "";

  onCreate(options: { code?: unknown } = {}): void {
    this.setPatchRate(null); // message sync; no state patches
    // Room code: the host (or URL) supplies one; a valid code is unique.
    this.code = sanitizeCode(options.code);
    if (activeCodes.has(this.code)) {
      throw new Error("ROOM_CODE_TAKEN");
    }
    activeCodes.add(this.code);
    this.slots = Array.from({ length: MAX_SLOTS }, (_, index) => ({
      index,
      sessionId: null,
      name: `Slot ${index + 1}`,
      isBot: false,
      ready: false,
      team: -1,
    }));

    this.onMessage(MSG.SET_NAME, (client, message) => {
      const slot = this.slots.find((entry) => entry.sessionId === client.sessionId);
      if (!slot) return;
      slot.name = sanitizeName((message as { name?: string })?.name, slot.name);
      this.broadcastLobby();
    });

    this.onMessage(MSG.REQUEST_LOBBY, (client) => {
      this.sendLobbyTo(client);
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
      const teams = teamCountOf(next.teams, this.config.teams);
      const humans = this.slots.filter((entry) => entry.sessionId).length;
      this.config = {
        botTeams: sanitizeBotTeams(next.botTeams, teams, this.config.botTeams, humans),
        botDifficulty: (["easy", "normal", "hard"] as const).includes(
          next.botDifficulty as BotDifficulty,
        )
          ? (next.botDifficulty as BotDifficulty)
          : this.config.botDifficulty,
        matchTarget: clampInt(next.matchTarget, 2, 9, this.config.matchTarget),
        arenaId:
          typeof next.arenaId === "string" && next.arenaId in ARENAS
            ? next.arenaId
            : this.config.arenaId,
        teams,
      };
      // Team columns changed: clamp chosen teams and rebalance the unassigned.
      for (const slot of this.slots) {
        if (slot.team >= teams) slot.team = -1;
      }
      this.broadcastLobby();
    });

    this.onMessage(MSG.SET_TEAM, (client, message) => {
      if (this.phase !== "lobby") return;
      const slot = this.slots.find((entry) => entry.sessionId === client.sessionId);
      if (!slot) return;
      const team = Math.floor(Number((message as { team?: unknown })?.team));
      if (!Number.isFinite(team)) return;
      slot.team = Math.max(0, Math.min(this.config.teams - 1, team));
      this.broadcastLobby();
    });

    this.onMessage(MSG.START, (client) => {
      if (client.sessionId !== this.hostId || this.phase !== "lobby") return;
      const humans = this.slots.filter((entry) => entry.sessionId);
      const total = humans.length + totalBots(this.config.botTeams);
      if (total < 2) {
        client.send(MSG.ERROR, {
          code: "need_players",
          message: "Add at least one bot or a second player to start.",
        });
        return;
      }
      // A match needs at least two populated sides (a single populated team
      // would end instantly with no gameplay).
      const teams = this.config.teams;
      const populated = new Set<number>();
      for (const slot of humans) {
        populated.add(Math.max(0, Math.min(teams - 1, slot.team)));
      }
      this.config.botTeams.forEach((count, team) => {
        if (count > 0) populated.add(team);
      });
      if (populated.size < 2) {
        client.send(MSG.ERROR, {
          code: "need_sides",
          message: "Both sides need a player or a bot to start.",
        });
        return;
      }
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
        aimX: clampInt(input.aimX, 0, ARENA_WIDTH, ARENA_WIDTH / 2),
        aimY: clampInt(input.aimY, 0, ARENA_HEIGHT, ARENA_HEIGHT / 2),
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
      this.lastCardPickPlayerId = null;
      this.tickCounter = 0;
      this.broadcastMatchEvent("roundStart");
    });

    this.onMessage(MSG.PICK_CARD, (client, message) => {
      if (this.phase !== "match" || !this.world) return;
      const pick = this.world.cardPick;
      if (!pick) return;
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (playerId !== pick.playerId) return;
      const cardId = (message as { cardId?: unknown })?.cardId;
      if (typeof cardId !== "string") return;
      if (pickCard(this.world, cardId as CardId)) {
        this.notifyCardPickResolved();
      }
    });
  }

  onJoin(client: Client, options: { name?: string } = {}): void {
    // Joins are lobby-only: a guest landing mid-match would fill a slot but
    // never receive MATCH_START or a sim player. Reject until the next lobby.
    if (this.phase === "match") {
      client.send(MSG.ERROR, { code: "busy", message: "Match in progress — join after it ends." });
      client.leave(4001);
      return;
    }
    const slot = this.slots.find((entry) => !entry.sessionId);
    if (!slot) {
      client.send(MSG.ERROR, { code: "full", message: "Room is full." });
      client.leave(4001);
      return;
    }
    slot.sessionId = client.sessionId;
    slot.name = sanitizeName(options.name, `P${slot.index + 1}`);
    slot.ready = false;
    slot.team = this.pickAutoTeam();
    if (!this.hostId) this.hostId = client.sessionId;
    this.sessionToPlayer.set(client.sessionId, slot.index);
    // A new human may push humans + bots past the room capacity; trim bots.
    const humans = this.slots.filter((entry) => entry.sessionId).length;
    this.config.botTeams = sanitizeBotTeams(
      this.config.botTeams,
      this.config.teams,
      this.config.botTeams,
      humans,
    );
    this.broadcastLobby();
  }

  /** Least-loaded team column; ties go to the lowest index. */
  private pickAutoTeam(): number {
    const teams = this.config.teams;
    const counts = Array.from({ length: teams }, () => 0);
    for (const slot of this.slots) {
      if (slot.sessionId && slot.team >= 0 && slot.team < teams) {
        counts[slot.team] += 1;
      }
    }
    let best = 0;
    for (let team = 1; team < teams; team += 1) {
      if (counts[team] < counts[best]) best = team;
    }
    return best;
  }

  onLeave(client: Client): void {
    // Bot takeover mid-match so the round continues without stalling.
    if (this.phase === "match" && this.world) {
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (playerId !== undefined) this.takeoverBot(playerId);
    }
    // Always release the slot (lobby or match) so it isn't a phantom
    // occupancy after a mid-match disconnect; the bot takes the sim seat.
    const slot = this.slots.find((entry) => entry.sessionId === client.sessionId);
    if (slot) {
      slot.sessionId = null;
      slot.ready = false;
      slot.team = -1;
      slot.name = `Slot ${slot.index + 1}`;
    }
    this.sessionToPlayer.delete(client.sessionId);
    if (this.hostId === client.sessionId) {
      // Promote the next remaining client to host (lobby AND match) so the
      // match can still be rematched after the original host disconnects.
      this.hostId = this.slots.find((entry) => entry.sessionId)?.sessionId ?? "";
    }
    this.broadcastLobby();
  }

  private startMatch(): void {
    const humans = this.slots.filter((entry) => entry.sessionId);
    const humanCount = humans.length;
    const teamCount = this.config.teams;
    // Clamp bot counts to the room capacity in case the roster changed.
    this.config.botTeams = sanitizeBotTeams(
      this.config.botTeams,
      teamCount,
      this.config.botTeams,
      humanCount,
    );
    const botTeams = this.config.botTeams;
    const botCount = totalBots(botTeams);

    // Humans keep the team they picked; bots fill the exact teams the host
    // added them to (per-team "Add bot" buttons in the lobby).
    const playerTeams: number[] = [];
    const teamCounts = Array.from({ length: teamCount }, () => 0);
    humans.forEach((slot, index) => {
      const team = Math.max(0, Math.min(teamCount - 1, slot.team));
      playerTeams[index] = team;
      teamCounts[team] += 1;
    });
    let nextIndex = humanCount;
    for (let team = 0; team < teamCount; team += 1) {
      const count = botTeams[team] ?? 0;
      for (let botIndex = 0; botIndex < count && nextIndex < humanCount + botCount; botIndex += 1) {
        playerTeams[nextIndex] = team;
        teamCounts[team] += 1;
        nextIndex += 1;
      }
    }

    this.world = createWorld({
      seed: 0x5eedc0de,
      mode: "match",
      arenaId: this.config.arenaId,
      botCount,
      humanCount,
      botDifficulty: this.config.botDifficulty,
      matchTarget: this.config.matchTarget,
      teamCount,
      playerTeams,
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
    this.lastCardPickPlayerId = null;

    // Map each human session to its contiguous sim player id (humans are the
    // first `humanCount` players, in slot order). Slot indices can be sparse
    // after leaves/rejoins, so sessionToPlayer must use the filtered position.
    this.sessionToPlayer.clear();
    humans.forEach((slot, index) => {
      this.sessionToPlayer.set(slot.sessionId as string, index);
    });

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
      teamCount: world.teamCount,
      players: world.players.map(
        (player): NetPlayerInfo => ({
          id: player.id,
          name: player.name,
          isBot: player.isBot,
          color: player.color,
          score: player.score,
          team: player.team,
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
        aimX: input?.aimX ?? ARENA_WIDTH / 2,
        aimY: input?.aimY ?? ARENA_HEIGHT / 2,
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
    this.detectCardPick(world);
    this.lastRoundState = world.roundState;
    this.lastMatchOver = world.matchOver;
    this.lastWinnerId = world.winnerId;
  }

  /** Send a loser-card offer when a pick opens, and clear the client overlay
   *  when it resolves (chosen or auto-picked). Offers only go to the loser's
   *  client so the opponent never sees the choices. */
  private detectCardPick(world: World): void {
    const pick = world.cardPick;
    const currentId = pick?.playerId ?? null;
    if (currentId === this.lastCardPickPlayerId) return;
    if (currentId !== null && pick) {
      const message: CardPickMessage = {
        phase: "offer",
        playerId: currentId,
        offers: [...pick.offers],
        timeout: pick.timer,
      };
      const session = this.sessionForPlayer(currentId);
      if (session) session.send(MSG.CARD_PICK, message);
    } else {
      this.notifyCardPickResolved();
    }
    this.lastCardPickPlayerId = currentId;
  }

  private notifyCardPickResolved(): void {
    const id = this.lastCardPickPlayerId;
    if (id === null) return;
    this.lastCardPickPlayerId = null;
    const session = this.sessionForPlayer(id);
    if (session) session.send(MSG.CARD_PICK, { phase: "resolved", playerId: id });
  }

  private sessionForPlayer(playerId: number): Client | null {
    for (const client of this.clients) {
      if (this.sessionToPlayer.get(client.sessionId) === playerId) return client;
    }
    return null;
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
      teamScores: [...world.teamScores],
      matchOver: world.matchOver,
    };
    this.broadcast(MSG.MATCH_EVENT, event);
  }

  private broadcastLobby(): void {
    this.broadcast(MSG.LOBBY_UPDATE, this.lobbyPayload());
  }

  /** Re-send the lobby to one client that just joined (the initial join-time
   *  broadcast can arrive before colyseus.js registers `onMessage`, which then
   *  drops it — so clients re-request after connecting). */
  private sendLobbyTo(client: Client): void {
    client.send(MSG.LOBBY_UPDATE, this.lobbyPayload());
  }

  private lobbyPayload(): LobbyState {
    return {
      hostId: this.hostId,
      phase: this.phase,
      slots: this.slots.map((slot) => ({ ...slot })),
      config: { ...this.config },
      code: this.code,
    };
  }

  onDispose(): void {
    activeCodes.delete(this.code);
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

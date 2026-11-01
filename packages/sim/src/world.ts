import { getArena } from "./arena";
import {
  CLIMB_STAMINA_MAX,
  GRENADE_COOLDOWN,
  PLAYER_COLORS,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  ROUND_COUNTDOWN,
} from "./constants";
import { normalizeSeed } from "./rng";
import type {
  BotBrain,
  BotDifficulty,
  CardId,
  PlayerHud,
  PlayerState,
  RoundState,
  World,
} from "./types";

export interface CreateWorldOptions {
  seed?: number;
  arenaId?: string;
  mode?: "training" | "gauntlet" | "match";
  botCount?: number;
  botEnabled?: boolean;
  botDifficulty?: BotDifficulty;
  matchTarget?: number;
  /** Number of human-controlled players (default 1). LAN uses >1. */
  humanCount?: number;
  playerCards?: CardId[];
  playerName?: string;
  botName?: string;
}

function maxHealthFor(player: PlayerState): number {
  return PLAYER_MAX_HEALTH + (player.cards.includes("VITAL") ? 30 : 0);
}

function createPlayer(
  id: number,
  slot: number,
  name: string,
  color: string,
  spawn: { x: number; y: number },
  isBot: boolean,
  skin = "default",
): PlayerState {
  return {
    id,
    slot,
    name,
    color,
    isBot,
    botControlled: isBot,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    grounded: false,
    wallDir: 0,
    wallClimbing: false,
    climbStamina: CLIMB_STAMINA_MAX,
    maxHealth: PLAYER_MAX_HEALTH,
    health: PLAYER_MAX_HEALTH,
    aimAngle: 0,
    aimX: spawn.x + 200,
    aimY: spawn.y,
    weaponId: "pistol",
    fireCooldown: 0,
    grenadeCooldown: 0,
    cards: [],
    hitFlash: 0,
    squash: 1,
    recoil: 0,
    alive: true,
    deathTimer: 0,
    skin,
    score: 0,
    prevJumpHeld: false,
    prevGrenadeHeld: false,
  };
}

function createBotBrain(): BotBrain {
  return {
    decisionTimer: 0,
    strafeDir: 1,
    jumpTimer: 0,
    grenadeTimer: 2,
    weaponTimer: 0,
  };
}

export function createWorld(options: CreateWorldOptions = {}): World {
  const arena = getArena(options.arenaId);
  // Distribute all occupied slots across the available spawn points
  // (alternating sides where possible) so humans and bots don't overlap.
  const allSpawns = [
    arena.spawns.player,
    arena.spawns.bot,
    ...arena.spawns.bots,
  ];
  const humanCount = Math.max(1, options.humanCount ?? 1);

  const humans: PlayerState[] = [];
  for (let index = 0; index < humanCount; index += 1) {
    const spawn = allSpawns[index] ?? arena.spawns.player;
    humans.push(
      createPlayer(
        index,
        index,
        index === 0 ? (options.playerName ?? "YOU") : `P${index + 1}`,
        PLAYER_COLORS[index % PLAYER_COLORS.length] ?? "#4da3ff",
        spawn,
        false,
      ),
    );
  }
  const player = humans[0] as PlayerState;
  if (options.playerCards) player.cards = [...options.playerCards];
  player.maxHealth = maxHealthFor(player);
  player.health = player.maxHealth;

  const botCount = Math.max(0, options.botCount ?? 1);
  const bots: PlayerState[] = [];
  for (let index = 0; index < botCount; index += 1) {
    const spawn = allSpawns[humanCount + index] ?? arena.spawns.bot;
    bots.push(
      createPlayer(
        humanCount + index,
        humanCount + index,
        index === 0 ? (options.botName ?? "BOT") : `BOT ${index + 1}`,
        PLAYER_COLORS[(humanCount + index) % PLAYER_COLORS.length] ?? "#4da3ff",
        spawn,
        true,
      ),
    );
  }

  const seed = normalizeSeed(options.seed ?? 0x1234abcd);
  const mode = options.mode ?? "training";
  const matchTarget = Math.max(2, options.matchTarget ?? 3);
  return {
    tick: 0,
    time: 0,
    seed,
    rngState: seed,
    fxState: normalizeSeed(seed ^ 0x7f4a7c15),
    mode,
    arenaId: arena.id,
    players: [...humans, ...bots],
    platformList: arena.platforms,
    bullets: [],
    grenades: [],
    particles: [],
    rings: [],
    flashes: [],
    texts: [],
    bots: new Map(bots.map((bot) => [bot.id, createBotBrain()])),
    nextEntityId: 1,
    hitStop: 0,
    shake: 0,
    resetTimer: 0,
    roundOver: false,
    winnerId: null,
    botEnabled: options.botEnabled ?? true,
    botDifficulty: options.botDifficulty ?? "normal",
    roundState: mode === "match" ? "countdown" : "playing",
    roundTimer: ROUND_COUNTDOWN,
    roundNumber: 1,
    matchTarget,
    matchOver: false,
  };
}

export function getPlayer(world: World, id: number): PlayerState | undefined {
  return world.players.find((player) => player.id === id);
}

export function getHuman(world: World): PlayerState | undefined {
  return world.players.find((player) => !player.isBot);
}

export function getBot(world: World): PlayerState | undefined {
  return world.players.find((player) => player.isBot);
}

export function getBots(world: World): PlayerState[] {
  return world.players.filter((player) => player.isBot);
}

export function grenadeCooldownFor(player: PlayerState): number {
  return player.cards.includes("FRAG") ? 0.5 : GRENADE_COOLDOWN;
}

function resetPlayer(player: PlayerState, spawn: { x: number; y: number }, isBot: boolean): void {
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.wallDir = 0;
  player.wallClimbing = false;
  player.climbStamina = CLIMB_STAMINA_MAX;
  player.maxHealth = maxHealthFor(player);
  player.health = player.maxHealth;
  player.aimAngle = 0;
  player.aimX = spawn.x + 200;
  player.aimY = spawn.y;
  player.weaponId = "pistol";
  player.fireCooldown = 0;
  player.grenadeCooldown = 0;
  player.hitFlash = 0;
  player.squash = 1;
  player.recoil = 0;
  player.alive = true;
  player.deathTimer = 0;
  player.prevJumpHeld = false;
  player.prevGrenadeHeld = false;
  player.isBot = isBot;
  player.botControlled = isBot;
}

export function resetSandbox(world: World, clearCards = false): void {
  const arena = getArena(world.arenaId);
  const player = world.players.find((entry) => !entry.isBot);
  const bots = world.players.filter((entry) => entry.isBot);
  if (player) {
    resetPlayer(player, arena.spawns.player, false);
    if (clearCards) player.cards = [];
    player.maxHealth = maxHealthFor(player);
    player.health = player.maxHealth;
  }
  bots.forEach((bot, index) => {
    resetPlayer(bot, arena.spawns.bots[index] ?? arena.spawns.bot, true);
    world.bots.set(bot.id, createBotBrain());
    if (clearCards) bot.cards = [];
  });
  world.bullets = [];
  world.grenades = [];
  world.particles = [];
  world.rings = [];
  world.flashes = [];
  world.texts = [];
  world.hitStop = 0;
  world.shake = 0;
  world.resetTimer = 0;
  world.roundOver = false;
  world.winnerId = null;
}

export function startGauntletWave(world: World, wave: number): void {
  const arena = getArena(world.arenaId);
  const player = world.players.find((entry) => !entry.isBot);
  const bots = world.players.filter((entry) => entry.isBot);
  if (player) {
    player.x = arena.spawns.player.x;
    player.y = arena.spawns.player.y;
    player.vx = 0;
    player.vy = 0;
    player.alive = true;
    player.health = player.maxHealth;
    player.fireCooldown = 0;
    player.grenadeCooldown = 0;
    player.hitFlash = 0;
  }
  bots.forEach((bot, index) => {
    const spawn = arena.spawns.bots[index] ?? arena.spawns.bot;
    bot.x = spawn.x;
    bot.y = spawn.y;
    bot.vx = 0;
    bot.vy = 0;
    bot.alive = true;
    bot.health = bot.maxHealth;
    bot.fireCooldown = 0;
    bot.grenadeCooldown = 0;
    bot.hitFlash = 0;
    bot.cards = [];
    world.bots.set(bot.id, createBotBrain());
  });
  world.bullets = [];
  world.grenades = [];
  world.particles = [];
  world.rings = [];
  world.flashes = [];
  world.texts = [];
  world.hitStop = 0;
  world.shake = 0;
  world.resetTimer = 0;
  world.roundOver = false;
  world.winnerId = null;
  void wave;
}

/** Start the next round of a match: respawn everyone, keep scores. */
export function startMatchRound(world: World): void {
  const arena = getArena(world.arenaId);
  const player = world.players.find((entry) => !entry.isBot);
  const bots = world.players.filter((entry) => entry.isBot);
  if (player) resetPlayer(player, arena.spawns.player, false);
  bots.forEach((bot, index) => {
    resetPlayer(bot, arena.spawns.bots[index] ?? arena.spawns.bot, true);
    world.bots.set(bot.id, createBotBrain());
  });
  world.bullets = [];
  world.grenades = [];
  world.particles = [];
  world.rings = [];
  world.flashes = [];
  world.texts = [];
  world.hitStop = 0;
  world.shake = 0;
  world.resetTimer = 0;
  world.roundOver = false;
  world.winnerId = null;
  world.roundState = "countdown";
  world.roundTimer = ROUND_COUNTDOWN;
}

/** Reset an entire match: scores, round number, and round state. */
export function resetMatch(world: World): void {
  for (const player of world.players) player.score = 0;
  world.roundNumber = 1;
  world.matchOver = false;
  world.roundState = "countdown";
  world.roundTimer = ROUND_COUNTDOWN;
  startMatchRound(world);
}

export function toPlayerHud(player: PlayerState): PlayerHud {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    isBot: player.isBot,
    health: player.health,
    maxHealth: player.maxHealth,
    alive: player.alive,
    weaponId: player.weaponId,
    grenadeCooldown: grenadeCooldownFor(player),
    grenadeReadyIn: Math.max(0, player.grenadeCooldown),
    cards: [...player.cards],
    grounded: player.grounded,
    wallDir: player.wallDir,
    wallClimbing: player.wallClimbing,
    climbStamina: player.climbStamina,
    x: player.x,
    y: player.y,
    skin: player.skin,
    score: player.score,
  };
}
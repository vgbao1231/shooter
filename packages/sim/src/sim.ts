import { ARENA_HEIGHT } from "./arena";
import { FIXED_DT, ROUND_END_DELAY } from "./constants";
import { CARD_CATALOG } from "./content";
import {
  fireWeapon,
  incrementGrenadeTimers,
  killFallen,
  throwGrenade,
  updateBullets,
  updateGrenades,
} from "./combat";
import { updateEffects } from "./effects";
import { movePlayer, stepPlayerPhysics } from "./physics";
import { nextRandom } from "./rng";
import { resetSandbox, startMatchRound } from "./world";
import type { CardId, CardSpec, InputFrame, PlayerState, World } from "./types";

function applyInput(
  world: World,
  player: PlayerState,
  input: InputFrame,
  dt: number,
): void {
  if (!player.alive) {
    player.prevJumpHeld = input.jumpHeld;
    player.prevGrenadeHeld = input.grenadeHeld;
    return;
  }

  player.aimX = input.aimX;
  player.aimY = input.aimY;
  player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

  const jumpPressed = input.jumpHeld && !player.prevJumpHeld;
  const grenadePressed = input.grenadeHeld && !player.prevGrenadeHeld;

  movePlayer(world, player, input.move, input.jumpHeld, jumpPressed, dt);

  if (input.shootHeld) fireWeapon(world, player);
  if (grenadePressed) throwGrenade(world, player);

  player.prevJumpHeld = input.jumpHeld;
  player.prevGrenadeHeld = input.grenadeHeld;
}

export function stepWorld(
  world: World,
  inputs: InputFrame[],
  dt: number = FIXED_DT,
): void {
  if (world.hitStop > 0) {
    world.hitStop = Math.max(0, world.hitStop - dt);
    updateEffects(world, dt);
    world.time += dt;
    world.tick += 1;
    return;
  }

  // Match round flow: countdown freezes play until it elapses.
  if (world.mode === "match" && world.roundState === "countdown") {
    world.roundTimer = Math.max(0, world.roundTimer - dt);
    updateEffects(world, dt);
    if (world.roundTimer <= 0) world.roundState = "playing";
    world.time += dt;
    world.tick += 1;
    return;
  }

  if (world.roundOver) {
    if (world.mode === "training") {
      world.resetTimer = Math.max(0, world.resetTimer - dt);
      if (world.resetTimer <= 0) resetSandbox(world);
    } else if (world.mode === "match") {
      stepMatchRoundOver(world, dt);
    }
    updateEffects(world, dt);
    world.time += dt;
    world.tick += 1;
    return;
  }

  for (const player of world.players) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.recoil *= 1 - Math.min(1, 16 * dt);
  }
  incrementGrenadeTimers(world, dt);

  const byPlayer = new Map<number, InputFrame>();
  for (const input of inputs) byPlayer.set(input.playerId, input);

  for (const player of world.players) {
    const input = byPlayer.get(player.id);
    if (input) applyInput(world, player, input, dt);
  }

  for (const player of world.players) {
    if (player.alive) stepPlayerPhysics(world, player, dt);
  }

  // Anyone who falls out of the arena (into a pit) dies.
  for (const player of world.players) {
    if (player.alive && player.y > ARENA_HEIGHT + 60) {
      killFallen(world, player);
    }
  }

  updateBullets(world, dt);
  updateGrenades(world, dt);
  updateEffects(world, dt);

  for (const player of world.players) {
    if (!player.alive) player.deathTimer += dt;
  }

  world.time += dt;
  world.tick += 1;
}

/** Advance a finished match round: banner → next round or match end. */
function stepMatchRoundOver(world: World, dt: number): void {
  if (world.roundState === "playing") {
    world.roundState = "roundEnd";
    world.roundTimer = ROUND_END_DELAY;
    return;
  }
  if (world.roundState !== "roundEnd") return;
  world.roundTimer = Math.max(0, world.roundTimer - dt);
  if (world.roundTimer > 0) return;
  const winner =
    world.winnerId !== null
      ? world.players.find((player) => player.id === world.winnerId)
      : null;
  if (winner && winner.score >= world.matchTarget) {
    world.roundState = "matchEnd";
    world.matchOver = true;
    return;
  }
  world.roundNumber += 1;
  startMatchRound(world);
}

export function getCardOffers(
  world: World,
  player: PlayerState,
  count = 3,
): CardSpec[] {
  const available = CARD_CATALOG.filter(
    (card) => !player.cards.includes(card.id),
  );
  const shuffled = [...available];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = nextRandom(world.fxState);
    world.fxState = next.state;
    const target = Math.floor(next.value * (index + 1));
    const temporary = shuffled[index];
    shuffled[index] = shuffled[target] as CardSpec;
    shuffled[target] = temporary as CardSpec;
  }
  return shuffled.slice(0, count);
}

export function applyCard(world: World, player: PlayerState, cardId: CardId): boolean {
  if (!world.players.includes(player) || player.cards.includes(cardId)) return false;
  const card = CARD_CATALOG.find((entry) => entry.id === cardId);
  if (!card) return false;
  player.cards.push(cardId);
  if (cardId === "VITAL") {
    player.maxHealth += 30;
    player.health = Math.min(player.maxHealth, player.health + 30);
  }
  return true;
}

export function setPlayerSkin(world: World, player: PlayerState, skin: string): void {
  player.skin = skin;
}

export function hashWorld(world: World): string {
  let hash = 0x811c9dc5;
  const feed = (value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  const round = (value: number): string => value.toFixed(3);

  feed(
    `tick:${world.tick};time:${round(world.time)};rng:${world.rngState};fx:${world.fxState}`,
  );
  for (const player of world.players) {
    feed(
      [
        player.id,
        round(player.x),
        round(player.y),
        round(player.vx),
        round(player.vy),
        player.grounded ? 1 : 0,
        player.wallDir,
        round(player.health),
        player.weaponId,
        round(player.fireCooldown),
        round(player.grenadeCooldown),
        player.alive ? 1 : 0,
        [...player.cards].sort().join(","),
      ].join(":"),
    );
  }
  for (const bullet of world.bullets) {
    feed(`b:${round(bullet.x)}:${round(bullet.y)}:${round(bullet.vx)}:${round(bullet.vy)}`);
  }
  for (const grenade of world.grenades) {
    feed(`g:${round(grenade.x)}:${round(grenade.y)}:${round(grenade.fuse)}`);
  }
  return hash.toString(16).padStart(8, "0");
}

export { FIXED_DT };
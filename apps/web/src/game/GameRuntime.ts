import {
  getArena,
  applyCard as applyCardToPlayer,
  createBotInput,
  createWorld,
  FIXED_DT,
  getBot,
  getBots,
  getCardOffers as drawCardOffers,
  getPlayer,
  resetMatch,
  resetSandbox,
  setPlayerSkin,
  startGauntletWave,
  stepWorld,
  toPlayerHud,
  type BotDifficulty,
  type CardId,
  type CardSpec,
  type HudState,
  type InputFrame,
  type World,
} from "@inkshot/sim";
import { ArenaRenderer } from "./ArenaRenderer";

export interface GameCallbacks {
  onHud: (hud: HudState) => void;
  onToggleCards: () => void;
  onDebugChange: (enabled: boolean) => void;
}

export interface GameHandle {
  pause: (paused: boolean) => void;
  reset: (clearCards?: boolean) => void;
  resetMatch: () => void;
  getCardOffers: () => CardSpec[];
  applyCard: (cardId: CardId) => boolean;
  setDebug: (enabled: boolean) => void;
  startWave: (wave: number) => void;
  setPlayerSkin: (skin: string) => void;
}

export interface GameRuntimeOptions {
  mode: "training" | "gauntlet" | "match";
  arenaId: string;
  botCount?: number;
  botDifficulty?: BotDifficulty;
  matchTarget?: number;
}

export class GameRuntime implements GameHandle {
  private readonly world: World;
  private readonly renderer: ArenaRenderer;
  private readonly cleanups: Array<() => void> = [];
  private readonly keys = new Set<string>();
  private readonly callbacks: GameCallbacks;
  private readonly noPointerLock: boolean;

  private frameHandle = 0;
  private lastTime = 0;
  private accumulator = 0;
  private hudAccumulator = 0;
  private fps = 60;
  private mouseX = 640;
  private mouseY = 300;
  private leftDown = false;
  private rightDown = false;
  private paused = false;
  private debug = false;
  private pointerLocked = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options: GameRuntimeOptions,
  ) {
    this.callbacks = callbacks;
    this.noPointerLock = new URLSearchParams(window.location.search).has("noPointerLock");
    this.world = createWorld({
      seed: (Date.now() ^ 0x51f15e) >>> 0,
      mode: options.mode,
      arenaId: options.arenaId,
      botCount: Math.max(1, options.botCount ?? 1),
      botDifficulty: options.botDifficulty,
      matchTarget: options.matchTarget,
    });
    if (import.meta.env.DEV) {
      (window as unknown as { __INKSHOT__?: World }).__INKSHOT__ = this.world;
    }
    const arena = getArena(options.arenaId);
    this.renderer = new ArenaRenderer(canvas, arena.platforms);
    this.attachListeners(canvas);
    this.lastTime = performance.now();
    this.pushHud();
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  pause(paused: boolean): void {
    this.paused = paused;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.leftDown = false;
    this.rightDown = false;
    this.keys.clear();
    if (paused && document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.pushHud();
  }

  reset(clearCards = false): void {
    resetSandbox(this.world, clearCards);
    this.accumulator = 0;
    this.pushHud();
  }

  resetMatch(): void {
    resetMatch(this.world);
    this.accumulator = 0;
    this.pushHud();
  }

  getCardOffers(): CardSpec[] {
    const player = getPlayer(this.world, 0);
    if (!player) return [];
    return drawCardOffers(this.world, player, 3);
  }

  applyCard(cardId: CardId): boolean {
    const player = getPlayer(this.world, 0);
    if (!player) return false;
    const applied = applyCardToPlayer(this.world, player, cardId);
    this.pushHud();
    return applied;
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled;
    this.callbacks.onDebugChange(enabled);
  }

  startWave(wave: number): void {
    startGauntletWave(this.world, wave);
    this.accumulator = 0;
    this.pushHud();
  }

  setPlayerSkin(skin: string): void {
    const player = getPlayer(this.world, 0);
    if (!player) return;
    setPlayerSkin(this.world, player, skin);
    this.pushHud();
  }

  destroy(): void {
    cancelAnimationFrame(this.frameHandle);
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
  }

  private attachListeners(canvas: HTMLCanvasElement): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "KeyC" && !event.repeat) {
        event.preventDefault();
        this.callbacks.onToggleCards();
        return;
      }
      if (event.code === "F1") {
        event.preventDefault();
        this.setDebug(!this.debug);
        return;
      }
      if (event.code === "KeyR" && !event.repeat) {
        event.preventDefault();
        this.reset(false);
        return;
      }
      if (this.paused) return;

      this.keys.add(event.code);
      if (
        event.code === "Space" ||
        event.code.startsWith("Arrow") ||
        event.code === "Tab"
      ) {
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      this.keys.delete(event.code);
    };

    const pointerToWorld = (event: PointerEvent): { x: number; y: number } => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.max(bounds.width / 1280, bounds.height / 720);
      const displayedWidth = 1280 * scale;
      const displayedHeight = 720 * scale;
      const offsetX = (bounds.width - displayedWidth) / 2;
      const offsetY = (bounds.height - displayedHeight) / 2;
      return {
        x: (event.clientX - bounds.left - offsetX) / scale,
        y: (event.clientY - bounds.top - offsetY) / scale,
      };
    };

    const aim = (event: PointerEvent): void => {
      if (this.pointerLocked) {
        const bounds = canvas.getBoundingClientRect();
        const scale = Math.max(bounds.width / 1280, bounds.height / 720);
        this.mouseX += event.movementX / scale;
        this.mouseY += event.movementY / scale;
      } else {
        const point = pointerToWorld(event);
        this.mouseX = point.x;
        this.mouseY = point.y;
      }
      this.mouseX = Math.max(0, Math.min(1280, this.mouseX));
      this.mouseY = Math.max(0, Math.min(720, this.mouseY));
    };

    const onPointerMove = (event: PointerEvent): void => {
      aim(event);
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (this.paused) return;
      // Set firing state FIRST so a throwing capture/lock call can never
      // swallow the shot. Pointer capture throws while the pointer is
      // already captured by the pointer-lock system.
      if (event.button === 2) {
        event.preventDefault();
        this.rightDown = true;
      } else if (event.button === 0) {
        this.leftDown = true;
      }
      canvas.focus();
      try {
        aim(event);
      } catch {
        // ignore; aim uses movementX/Y while locked and never throws.
      }
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Already captured (pointer lock); firing state is already set.
      }
      if (!this.noPointerLock && document.pointerLockElement !== canvas) {
        try {
          void canvas.requestPointerLock();
        } catch {
          // Pointer lock can be rejected; absolute aiming remains.
        }
      }
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (event.button === 2) this.rightDown = false;
      if (event.button === 0) this.leftDown = false;
    };

    const clearInput = (): void => {
      this.keys.clear();
      this.leftDown = false;
      this.rightDown = false;
    };

    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
    };

    const onPointerLockChange = (): void => {
      this.pointerLocked = document.pointerLockElement === canvas;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearInput);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    this.cleanups.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    });
  }

  private readInput(): InputFrame {
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const jump =
      this.keys.has("KeyW") ||
      this.keys.has("ArrowUp") ||
      this.keys.has("Space");
    const grenade = this.keys.has("KeyG") || this.rightDown;

    return {
      playerId: 0,
      seq: this.world.tick,
      move: right === left ? 0 : right ? 1 : -1,
      jumpHeld: jump,
      shootHeld: this.leftDown,
      grenadeHeld: grenade,
      aimX: this.mouseX,
      aimY: this.mouseY,
    };
  }

  private step(): void {
    const inputs: InputFrame[] = [this.readInput()];
    if (this.world.botEnabled) {
      for (const bot of getBots(this.world)) {
        inputs.push(createBotInput(this.world, bot, this.world.botDifficulty));
      }
    }
    stepWorld(this.world, inputs);
  }

  private pushHud(): void {
    const player = getPlayer(this.world, 0);
    const bots = getBots(this.world);
    if (!player) return;
    const bot = getBot(this.world);
    if (!bot) return;
    this.callbacks.onHud({
      tick: this.world.tick,
      fps: Math.round(this.fps),
      player: toPlayerHud(player),
      bot: toPlayerHud(bot),
      bots: bots.map(toPlayerHud),
      botsAlive: bots.filter((entry) => entry.alive).length,
      roundOver: this.world.roundOver,
      winnerId: this.world.winnerId,
      resetIn: this.world.resetTimer,
      bulletCount: this.world.bullets.length,
      particleCount: this.world.particles.length,
      mode: this.world.mode,
      arenaId: this.world.arenaId,
      roundState: this.world.roundState,
      roundNumber: this.world.roundNumber,
      matchTarget: this.world.matchTarget,
      matchOver: this.world.matchOver,
    });
  }

  private readonly loop = (now: number): void => {
    const rawDelta = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const frameDelta = Math.min(0.05, rawDelta);
    if (rawDelta > 0.001) {
      const instantFps = 1 / rawDelta;
      this.fps += (instantFps - this.fps) * 0.08;
    }

    if (!this.paused) {
      this.accumulator += frameDelta;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 8) {
        this.step();
        this.accumulator -= FIXED_DT;
        steps += 1;
      }
      if (steps === 8) this.accumulator = 0;
    }

    this.renderer.render(this.world, this.paused ? 0 : frameDelta, {
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      debug: this.debug,
      paused: this.paused,
    });

    this.hudAccumulator += frameDelta;
    if (this.hudAccumulator >= 0.1) {
      this.hudAccumulator = 0;
      this.pushHud();
    }

    this.frameHandle = requestAnimationFrame(this.loop);
  };
}
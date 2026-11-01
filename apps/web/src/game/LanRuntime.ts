import {
  applySnapshot,
  createRenderWorld,
  decayEffects,
  getArena,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type HudState,
  type MatchEvent,
  type MatchStart,
  type NetInput,
  type NetworkSnapshot,
  type PlayerHud,
} from "@inkshot/sim";
import { ArenaRenderer } from "./ArenaRenderer";
import type { LanSession } from "./LanSession";

export interface LanRuntimeCallbacks {
  onHud: (hud: HudState) => void;
  onMatchEvent: (event: MatchEvent) => void;
}

/**
 * Renders an authoritative LAN match from the session's snapshot stream. The
 * client never simulates gameplay; it interpolates and draws. Input is sent to
 * the host at the render rate.
 */
export class LanRuntime {
  private readonly renderer: ArenaRenderer;
  private readonly session: LanSession;
  private readonly matchStart: MatchStart;
  private readonly callbacks: LanRuntimeCallbacks;
  private readonly rendererWorld: ReturnType<typeof createRenderWorld>;
  private readonly cleanups: Array<() => void> = [];
  private readonly keys = new Set<string>();

  private frameHandle = 0;
  private lastTime = 0;
  private fps = 60;
  private mouseX = ARENA_WIDTH / 2;
  private mouseY = 360;
  private leftDown = false;
  private rightDown = false;
  private scores: Record<number, number> = {};
  private pendingEvent: MatchEvent | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    session: LanSession,
    matchStart: MatchStart,
    callbacks: LanRuntimeCallbacks,
  ) {
    this.session = session;
    this.matchStart = matchStart;
    this.callbacks = callbacks;
    for (const player of matchStart.players) this.scores[player.id] = player.score;

    const arena = getArena(matchStart.arenaId);
    this.rendererWorld = createRenderWorld(matchStart.arenaId, arena.platforms);
    if (import.meta.env.DEV) {
      (window as unknown as { __INKSHOT_LAN__?: unknown }).__INKSHOT_LAN__ =
        this.rendererWorld;
    }
    this.renderer = new ArenaRenderer(canvas, arena);
    this.attachListeners(canvas);
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.frameHandle);
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
  }

  private attachListeners(canvas: HTMLCanvasElement): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "F1") {
        event.preventDefault();
        return;
      }
      if (
        event.code === "Space" ||
        event.code.startsWith("Arrow") ||
        event.code === "Tab"
      ) {
        event.preventDefault();
      }
      this.keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      this.keys.delete(event.code);
    };

    const pointerToWorld = (event: PointerEvent): { x: number; y: number } => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(bounds.width / ARENA_WIDTH, bounds.height / ARENA_HEIGHT);
      const displayedWidth = ARENA_WIDTH * scale;
      const displayedHeight = ARENA_HEIGHT * scale;
      const offsetX = (bounds.width - displayedWidth) / 2;
      const offsetY = (bounds.height - displayedHeight) / 2;
      return {
        x: (event.clientX - bounds.left - offsetX) / scale,
        y: (event.clientY - bounds.top - offsetY) / scale,
      };
    };

    const aim = (event: PointerEvent): void => {
      const point = pointerToWorld(event);
      this.mouseX = point.x;
      this.mouseY = point.y;
      this.mouseX = Math.max(0, Math.min(ARENA_WIDTH, this.mouseX));
      this.mouseY = Math.max(0, Math.min(ARENA_HEIGHT, this.mouseY));
    };

    const onPointerMove = (event: PointerEvent): void => aim(event);
    const onPointerDown = (event: PointerEvent): void => {
      event.preventDefault();
      if (event.button === 2) this.rightDown = true;
      else if (event.button === 0) this.leftDown = true;
      canvas.focus();
      aim(event);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can be rejected; absolute aiming still works.
      }
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (event.button === 2) this.rightDown = false;
      else if (event.button === 0) this.leftDown = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.cleanups.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
    });
  }

  private readInput(): NetInput {
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const jump =
      this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.keys.has("Space");
    const grenade = this.keys.has("KeyG") || this.rightDown;
    return {
      seq: Math.floor(performance.now()),
      move: right === left ? 0 : right ? 1 : -1,
      jumpHeld: jump,
      shootHeld: this.leftDown,
      grenadeHeld: grenade,
      aimX: this.mouseX,
      aimY: this.mouseY,
    };
  }

  private readonly loop = (now: number): void => {
    const rawDelta = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const frameDelta = Math.min(0.05, rawDelta);
    if (rawDelta > 0.001) {
      const instantFps = 1 / rawDelta;
      this.fps += (instantFps - this.fps) * 0.08;
    }

    this.session.sendInput(this.readInput());

    const snapshot = this.session.interpolated();
    if (snapshot) {
      applySnapshot(this.rendererWorld, snapshot);
      decayEffects(this.rendererWorld, frameDelta);
      this.renderer.render(this.rendererWorld, frameDelta, {
        mouseX: this.mouseX,
        mouseY: this.mouseY,
        debug: false,
        paused: false,
      });
    }

    if (this.pendingEvent) {
      this.applyMatchEvent(this.pendingEvent);
      this.pendingEvent = null;
    }
    this.pushHud();

    this.frameHandle = requestAnimationFrame(this.loop);
  };

  handleMatchEvent(event: MatchEvent): void {
    this.pendingEvent = event;
  }

  private applyMatchEvent(event: MatchEvent): void {
    for (const [id, score] of Object.entries(event.playerScores)) {
      this.scores[Number(id)] = score;
    }
    this.callbacks.onMatchEvent(event);
  }

  private playerHud(snapshot: NetworkSnapshot, id: number): PlayerHud | null {
    const entry = snapshot.players.find((player) => player.id === id);
    if (!entry) return null;
    const info = this.matchStart.players.find((player) => player.id === id);
    return {
      id,
      name: info?.name ?? (entry.isBot ? "BOT" : "P" + (id + 1)),
      color: entry.color,
      isBot: entry.isBot,
      health: entry.health,
      maxHealth: entry.maxHealth,
      alive: entry.alive,
      weaponId: entry.weaponId,
      grenadeCooldown: 0,
      grenadeReadyIn: 0,
      cards: [],
      grounded: entry.grounded,
      wallDir: entry.wallDir,
      wallClimbing: false,
      climbStamina: 100,
      x: entry.x,
      y: entry.y,
      skin: "default",
      score: this.scores[id] ?? 0,
      team: entry.team,
    };
  }

  private pushHud(): void {
    const snapshot = this.session.latest();
    if (!snapshot) return;
    const me = this.playerHud(snapshot, this.session.myPlayerId);
    if (!me) return;
    const opponents = snapshot.players.filter(
      (player) => player.id !== this.session.myPlayerId,
    );
    const topOpponent =
      [...opponents].sort(
        (a, b) => (this.scores[b.id] ?? 0) - (this.scores[a.id] ?? 0),
      )[0] ?? opponents[0];
    const bot = topOpponent ? this.playerHud(snapshot, topOpponent.id) : null;
    const bots = opponents
      .map((entry) => this.playerHud(snapshot, entry.id))
      .filter((entry): entry is PlayerHud => entry !== null);

    this.callbacks.onHud({
      tick: snapshot.tick,
      fps: Math.round(this.fps),
      player: me,
      bot: bot ?? me,
      bots,
      botsAlive: bots.filter((entry) => entry.alive).length,
      roundOver: snapshot.roundOver,
      winnerId: snapshot.winnerId,
      resetIn: 0,
      bulletCount: snapshot.bullets.length,
      particleCount: snapshot.particles.length,
      mode: "match",
      arenaId: this.matchStart.arenaId,
      roundState: snapshot.roundState,
      roundNumber: snapshot.roundNumber,
      matchTarget: snapshot.matchTarget,
      matchOver: snapshot.matchOver,
      teamCount: snapshot.teamCount,
      teamScores: this.teamScores(snapshot),
    });
  }

  private teamScores(snapshot: NetworkSnapshot): Record<number, number> {
    const scores: Record<number, number> = {};
    snapshot.teamScores.forEach((score, team) => {
      scores[team] = score;
    });
    return scores;
  }
}

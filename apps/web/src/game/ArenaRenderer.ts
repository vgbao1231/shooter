import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  TEAM_COLORS,
  WEAPONS,
  type ArenaDefinition,
  type ArenaPalette,
  type Platform,
  type PlayerState,
  type SwingPlatform,
  type World,
} from "@inkshot/sim";

export interface RenderView {
  mouseX: number;
  mouseY: number;
  debug: boolean;
  paused: boolean;
}

interface Limb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromX: number;
  fromY: number;
}

interface Point {
  x: number;
  y: number;
}

interface Rig {
  limbs: Limb[];
  targets: [Point, Point, Point, Point];
  phase: number;
}

const INK = "#061018";
const OUTLINE = "#0b0b12";

export class ArenaRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly platforms: Platform[];
  private readonly palette: ArenaPalette;
  private readonly swings: SwingPlatform[];
  private readonly rigs = new Map<number, Rig>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly arena: ArenaDefinition,
  ) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is not available");
    this.context = context;
    this.platforms = arena.platforms;
    this.palette = arena.palette;
    this.swings = arena.swings ?? [];
    canvas.width = ARENA_WIDTH;
    canvas.height = ARENA_HEIGHT;
    this.mapCanvas = this.buildMap();
  }

  render(world: World, dt: number, view: RenderView): void {
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";

    const shake = view.paused ? 0 : world.shake * world.shake * 22;
    if (shake > 0) {
      context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    context.fillStyle = INK;
    context.fillRect(-60, -60, ARENA_WIDTH + 120, ARENA_HEIGHT + 120);
    context.drawImage(this.mapCanvas, 0, 0);

    this.drawSwings(world);

    for (const player of world.players) {
      this.updateRig(player, dt);
    }

    for (const player of world.players) this.drawPlayer(world, player);

    for (const grenade of world.grenades) {
      context.save();
      context.translate(grenade.x, grenade.y);
      context.rotate(grenade.rotation);
      context.fillStyle = "#4b5a3a";
      context.strokeStyle = OUTLINE;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, grenade.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = "#2b3322";
      context.fillRect(-3, -grenade.radius - 4, 6, 5);
      const blinking =
        grenade.fuse < 0.8
          ? Math.sin(grenade.fuse * 40) > 0
          : Math.sin(grenade.fuse * 10) > 0.6;
      context.fillStyle = blinking ? "#ff4a3a" : "#5a1a16";
      context.beginPath();
      context.arc(0, -1, 2.6, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    this.drawBullets(world);
    this.drawEffects(world);

    if (!view.paused) {
      this.drawCrosshair(world, view.mouseX, view.mouseY);
    }
    if (view.debug) this.drawDebug(world, view);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  private drawSwings(world: World): void {
    if (this.swings.length === 0) return;
    const context = this.context;
    for (let index = 0; index < this.swings.length; index += 1) {
      const def = this.swings[index];
      if (!def) continue;
      const state = world.swingState[index];
      const angle = state?.angle ?? 0;
      const bob = state?.bob ?? 0;
      const cx = def.anchorX + def.length * Math.sin(angle);
      const cy = def.anchorY + def.length * Math.cos(angle) + bob;

      // Rope from the anchor down to the block. A taut rope is a straight
      // line; when the block is bumped the rope slackens (the block rises
      // toward the anchor) and we draw a gentle downward sag so it reads as a
      // real rope rather than a rigid rod.
      const dist = Math.hypot(cx - def.anchorX, cy - def.anchorY);
      const slack = Math.max(0, 1 - dist / def.length);
      context.strokeStyle = "rgba(232,230,223,.32)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(def.anchorX, def.anchorY);
      if (slack > 0.02) {
        const midX = (def.anchorX + cx) / 2;
        const midY = (def.anchorY + cy) / 2;
        const sag = slack * Math.min(50, def.length * 0.3);
        context.quadraticCurveTo(midX, midY + sag, cx, cy);
      } else {
        context.lineTo(cx, cy);
      }
      context.stroke();

      const x = cx - def.w / 2;
      const y = cy - def.h / 2;
      context.fillStyle = this.palette.blockB;
      context.fillRect(x, y, def.w, def.h);
      context.fillStyle = this.palette.blockEdge;
      context.fillRect(x, y, def.w, 3);
    }
  }

  private buildMap(): HTMLCanvasElement {
    const map = document.createElement("canvas");
    map.width = ARENA_WIDTH;
    map.height = ARENA_HEIGHT;
    const context = map.getContext("2d");
    if (!context) return map;

    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    const background = context.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    background.addColorStop(0, this.palette.backgroundTop);
    background.addColorStop(1, this.palette.backgroundBottom);
    context.fillStyle = background;
    context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    context.fillStyle = this.palette.shadow;
    for (const platform of this.platforms) {
      if (platform.kind !== "block") continue;
      const shadowX = 170;
      const shadowY = 210;
      const x = platform.x;
      const y = platform.y;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + platform.w, y);
      context.lineTo(x + platform.w, y + platform.h);
      context.lineTo(x + platform.w - shadowX, y + platform.h + shadowY);
      context.lineTo(x - shadowX, y + platform.h + shadowY);
      context.lineTo(x - shadowX, y + shadowY);
      context.closePath();
      context.fill();
    }

    for (const platform of this.platforms) {
      if (platform.kind === "frame") {
        context.fillStyle = INK;
        context.fillRect(platform.x, platform.y, platform.w, platform.h);
        continue;
      }
      if (platform.kind === "pillar") {
        context.fillStyle = this.palette.pillar;
        context.fillRect(platform.x, platform.y, platform.w, platform.h);
        context.fillStyle = this.palette.pillarShade;
        context.fillRect(
          platform.x + platform.w * 0.62,
          platform.y,
          platform.w * 0.38,
          platform.h,
        );
        continue;
      }

      const gradient = context.createLinearGradient(
        platform.x,
        platform.y,
        platform.x + platform.w,
        platform.y + platform.h,
      );
      gradient.addColorStop(0, this.palette.blockA);
      gradient.addColorStop(1, this.palette.blockB);
      context.fillStyle = gradient;
      context.fillRect(platform.x, platform.y, platform.w, platform.h);

      context.save();
      context.beginPath();
      context.rect(platform.x, platform.y, platform.w, platform.h);
      context.clip();
      context.lineCap = "round";
      const strokes = Math.max(1, Math.floor((platform.w * platform.h) / 700));
      for (let index = 0; index < strokes; index += 1) {
        context.strokeStyle =
          random() < 0.5
            ? this.palette.blockStrokeA
            : this.palette.blockStrokeB;
        context.lineWidth = 3 + random() * 9;
        const x = platform.x + random() * platform.w;
        const y = platform.y + random() * platform.h;
        const length = 20 + random() * 50;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + length, y - length * 0.3);
        context.stroke();
      }
      context.restore();
      context.fillStyle = this.palette.blockEdge;
      context.fillRect(platform.x, platform.y, platform.w, 3);
    }

    return map;
  }

  private ensureRig(player: PlayerState): Rig {
    let rig = this.rigs.get(player.id);
    if (rig) return rig;
    const limb = (): Limb => ({
      x: player.x,
      y: player.y,
      vx: 0,
      vy: 0,
      fromX: player.x,
      fromY: player.y,
    });
    rig = {
      limbs: [limb(), limb(), limb(), limb()],
      targets: [
        { x: player.x, y: player.y },
        { x: player.x, y: player.y },
        { x: player.x, y: player.y },
        { x: player.x, y: player.y },
      ],
      phase: 0,
    };
    this.rigs.set(player.id, rig);
    return rig;
  }

  private updateRig(player: PlayerState, dt: number): void {
    const rig = this.ensureRig(player);
    const directionX = Math.cos(player.aimAngle);
    const directionY = Math.sin(player.aimAngle);
    const facing = directionX < 0 ? -1 : 1;
    const run = Math.min(1, Math.abs(player.vx) / 280);
    const bottom = player.y + player.radius;
    rig.phase += Math.abs(player.vx) * dt * 0.06;
    const sine = Math.sin(rig.phase);
    const cosine = Math.cos(rig.phase);

    const gunX = player.x + directionX * (player.radius + 6 - player.recoil * 0.6);
    const gunY = player.y + directionY * (player.radius + 6 - player.recoil * 0.6);
    const airY = bottom + 12 + Math.max(-8, Math.min(10, player.vy * 0.012));

    rig.targets = [
      { x: gunX + directionX * 8, y: gunY + directionY * 8 },
      { x: gunX + directionX * 22, y: gunY + directionY * 22 },
      player.grounded
        ? {
            x: player.x - 10 + sine * 18 * run,
            y: bottom + 4 - Math.max(0, cosine) * 10 * run,
          }
        : { x: player.x - 9, y: airY },
      player.grounded
        ? {
            x: player.x + 10 - sine * 18 * run,
            y: bottom + 4 - Math.max(0, -cosine) * 10 * run,
          }
        : { x: player.x + 9, y: airY },
    ];

    rig.limbs.forEach((limb, index) => {
      const target = rig.targets[index];
      if (!target) return;
      const fromX = player.x + (index < 2 ? 0 : index === 2 ? -8 : 8);
      const fromY = player.y + (index < 2 ? 0 : 8);
      const middleX = (fromX + target.x) / 2;
      const middleY = (fromY + target.y) / 2;
      const length = Math.hypot(target.x - fromX, target.y - fromY);
      const influenceX = index < 2 ? middleX : middleX + facing * length * 0.35;
      const influenceY = index < 2 ? middleY + length * 0.3 : middleY;

      limb.vx += (influenceX - limb.x) * 260 * dt;
      limb.vy += (influenceY - limb.y) * 260 * dt;
      limb.vx *= 1 - 10 * dt;
      limb.vy *= 1 - 10 * dt;
      limb.x += limb.vx * dt;
      limb.y += limb.vy * dt;
      limb.fromX = fromX;
      limb.fromY = fromY;
    });
  }

  private drawPlayer(world: World, player: PlayerState): void {
    const context = this.context;
    const rig = this.ensureRig(player);
    const color = player.hitFlash > 0 ? "#ffffff" : player.color;
    const facing = Math.cos(player.aimAngle) < 0 ? -1 : 1;
    const bodyY = player.alive ? player.y : player.y + player.radius * 0.45;
    const squash = player.alive ? player.squash : 0.45;
    const radiusY = player.radius * squash;
    const radiusX = player.radius * (2 - squash);

    context.save();
    if (!player.alive) context.globalAlpha = 0.8;

    // Team marker: a colored ring on the ground so teammates read instantly.
    if (world.teamCount > 1) {
      context.strokeStyle = TEAM_COLORS[player.team] ?? "#fff";
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(
        player.x,
        bodyY + radiusY + 2,
        radiusX + 5,
        radiusY * 0.55 + 3,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }

    context.strokeStyle = color;
    context.lineWidth = 6;
    context.lineCap = "round";
    rig.limbs.forEach((limb, index) => {
      const target = rig.targets[index];
      if (!target) return;
      context.beginPath();
      context.moveTo(limb.fromX, limb.fromY);
      context.quadraticCurveTo(limb.x, limb.y, target.x, target.y);
      context.stroke();
    });

    context.fillStyle = color;
    context.strokeStyle = OUTLINE;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(player.x, bodyY, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (player.isBot) {
      const antennaY = bodyY - radiusY - 13;
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x, bodyY - radiusY);
      context.lineTo(player.x + 3, antennaY);
      context.stroke();
      context.fillStyle = color;
      context.beginPath();
      context.arc(player.x + 3, antennaY, 4.5, 0, Math.PI * 2);
      context.fill();
    }

    if (player.alive) {
      for (const side of [-1, 1]) {
        const eyeX = player.x + facing * 4 + side * 8;
        const eyeY = bodyY - radiusY * 0.2;
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(eyeX, eyeY, 6.5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#14141c";
        context.beginPath();
        context.arc(
          eyeX + Math.cos(player.aimAngle) * 2.8,
          eyeY + Math.sin(player.aimAngle) * 2.8,
          3.2,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.strokeStyle = OUTLINE;
      context.lineWidth = 2.4;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(player.x - 4, bodyY + 9);
      context.quadraticCurveTo(player.x, bodyY + 13, player.x + 5, bodyY + 9);
      context.stroke();

      this.drawGun(player);
    } else {
      context.strokeStyle = OUTLINE;
      context.lineWidth = 3;
      for (const side of [-1, 1]) {
        const eyeX = player.x + facing * 4 + side * 8;
        const eyeY = bodyY - radiusY * 0.1;
        context.beginPath();
        context.moveTo(eyeX - 5, eyeY - 5);
        context.lineTo(eyeX + 5, eyeY + 5);
        context.moveTo(eyeX + 5, eyeY - 5);
        context.lineTo(eyeX - 5, eyeY + 5);
        context.stroke();
      }
    }

    context.fillStyle = color;
    for (const index of [0, 1]) {
      const target = rig.targets[index];
      if (!target) continue;
      context.beginPath();
      context.arc(target.x, target.y, 4.5, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
    this.drawNameplate(player);
    context.restore();

    if (world.roundOver && !player.alive) {
      context.globalAlpha = 1;
    }
  }

  private drawGun(player: PlayerState): void {
    const context = this.context;
    const rig = this.ensureRig(player);
    const hand = rig.targets[0];
    if (!hand) return;
    const weapon = WEAPONS[player.weaponId];
    const gunX = hand.x + Math.cos(player.aimAngle) * 12;
    const gunY = hand.y + Math.sin(player.aimAngle) * 12;

    context.save();
    context.translate(gunX, gunY);
    context.rotate(player.aimAngle);
    if (Math.cos(player.aimAngle) < 0) context.scale(1, -1);
    context.fillStyle = weapon.color;
    context.strokeStyle = OUTLINE;
    context.lineWidth = 2.5;
    context.lineJoin = "round";

    const rect = (x: number, y: number, width: number, height: number): void => {
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
    };

    rect(5, weapon.thickness / 2 - 1, 9, 14);
    if (player.weaponId === "smg") {
      rect(weapon.length * 0.5, weapon.thickness / 2 - 1, 8, 17);
    }
    rect(0, -weapon.thickness / 2, weapon.length, weapon.thickness);
    if (player.weaponId === "shotgun") {
      rect(weapon.length * 0.45, weapon.thickness / 2 - 1, 14, 6);
    }
    context.fillStyle = "#2a2a36";
    rect(weapon.length - 5, -weapon.thickness / 2 - 2, 5, weapon.thickness + 4);
    context.restore();
  }

  private drawNameplate(player: PlayerState): void {
    const context = this.context;
    const width = 66;
    const x = player.x - width / 2;
    const y = player.y - player.radius - 42;
    context.globalAlpha = 0.92;
    context.fillStyle = "rgba(6,16,24,.78)";
    context.fillRect(x, y, width, 24);
    context.fillStyle = "rgba(255,255,255,.12)";
    context.fillRect(x + 4, y + 15, width - 8, 5);
    context.fillStyle = player.color;
    context.fillRect(
      x + 4,
      y + 15,
      (width - 8) * Math.max(0, player.health / player.maxHealth),
      5,
    );
    context.font = "600 10px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#e8e6df";
    const label = player.name || (player.isBot ? "BOT" : "YOU");
    context.fillText(label, player.x, y + 8);
    context.globalAlpha = 1;
  }

  private drawBullets(world: World): void {
    const context = this.context;
    context.globalCompositeOperation = "lighter";
    for (const bullet of world.bullets) {
      context.strokeStyle = bullet.explodes ? "#ffa040" : bullet.color;
      context.lineCap = "round";
      for (let index = 1; index < bullet.trail.length; index += 1) {
        const previous = bullet.trail[index - 1];
        const current = bullet.trail[index];
        if (!previous || !current) continue;
        context.globalAlpha = index / bullet.trail.length;
        context.lineWidth = (bullet.radius * 2 * index) / bullet.trail.length;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(current.x, current.y);
        context.stroke();
      }
      context.globalAlpha = 1;
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
  }

  private drawEffects(world: World): void {
    const context = this.context;
    context.globalCompositeOperation = "lighter";

    for (const flash of world.flashes) {
      const alpha = flash.life / flash.maxLife;
      context.save();
      context.translate(flash.x, flash.y);
      context.rotate(flash.angle);
      context.globalAlpha = alpha;
      context.fillStyle = "#ffd57a";
      context.beginPath();
      context.moveTo(-4, -flash.size * 0.3 * alpha - 3);
      context.lineTo(flash.size, 0);
      context.lineTo(-4, flash.size * 0.3 * alpha + 3);
      context.closePath();
      context.fill();
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(0, 0, flash.size * 0.22, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    for (const ring of world.rings) {
      const alpha = ring.life / ring.maxLife;
      context.globalAlpha = alpha;
      context.strokeStyle = ring.color;
      context.lineWidth = 1 + 4 * alpha;
      context.beginPath();
      context.arc(
        ring.x,
        ring.y,
        ring.size * (1 - alpha * alpha),
        0,
        Math.PI * 2,
      );
      if (ring.filled) {
        context.fillStyle = ring.color;
        context.globalAlpha = alpha * 0.35;
        context.fill();
        context.globalAlpha = alpha;
      }
      context.stroke();
    }

    // Draw normal particles first, then switch to "lighter" once for all
    // light (glowing) particles — switching globalCompositeOperation per
    // particle is a real canvas cost when a buckshot blast fills the screen.
    for (const particle of world.particles) {
      if (particle.light) continue;
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (alpha <= 0.02) continue;
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      if (particle.shard) {
        context.fillRect(particle.x, particle.y, particle.size, particle.size * 0.5);
      } else {
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.size * (0.4 + 0.6 * alpha),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
    context.globalCompositeOperation = "lighter";
    for (const particle of world.particles) {
      if (!particle.light) continue;
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (alpha <= 0.02) continue;
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      if (particle.shard) {
        context.fillRect(particle.x, particle.y, particle.size, particle.size * 0.5);
      } else {
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.size * (0.4 + 0.6 * alpha),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
    context.globalCompositeOperation = "source-over";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 20px system-ui, sans-serif";
    for (const text of world.texts) {
      context.globalAlpha = Math.min(1, text.life * 2);
      context.fillStyle = "#ffe27a";
      context.fillText(text.value, text.x, text.y);
    }
    context.globalAlpha = 1;
  }

  private drawCrosshair(world: World, x: number, y: number): void {
    const player = world.players.find((entry) => !entry.isBot);
    if (!player) return;
    const context = this.context;
    context.save();
    context.globalAlpha = 0.9;
    context.strokeStyle = player.color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, 8, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    for (const [dx, dy] of [
      [0, -15],
      [0, 15],
      [-15, 0],
      [15, 0],
    ] as const) {
      context.moveTo(x + dx * 0.65, y + dy * 0.65);
      context.lineTo(x + dx, y + dy);
    }
    context.stroke();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private drawDebug(world: World, view: RenderView): void {
    const context = this.context;
    context.save();
    context.globalAlpha = 0.7;
    context.strokeStyle = "#8be04e";
    context.lineWidth = 1;
    for (const platform of this.platforms) {
      context.strokeRect(platform.x, platform.y, platform.w, platform.h);
    }
    for (const player of world.players) {
      context.strokeStyle = player.color;
      context.beginPath();
      context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(
        player.x + Math.cos(player.aimAngle) * 90,
        player.y + Math.sin(player.aimAngle) * 90,
      );
      context.stroke();
      context.strokeStyle = "#ffd400";
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(player.x + player.vx * 0.15, player.y + player.vy * 0.15);
      context.stroke();
      if (player.wallDir !== 0) {
        context.strokeStyle = "#35d8ff";
        context.beginPath();
        context.moveTo(player.x + player.wallDir * player.radius, player.y - 24);
        context.lineTo(player.x + player.wallDir * player.radius, player.y + 24);
        context.stroke();
      }
    }
    context.strokeStyle = "#e8e6df";
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(view.mouseX - 14, view.mouseY);
    context.lineTo(view.mouseX + 14, view.mouseY);
    context.moveTo(view.mouseX, view.mouseY - 14);
    context.lineTo(view.mouseX, view.mouseY + 14);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }
}
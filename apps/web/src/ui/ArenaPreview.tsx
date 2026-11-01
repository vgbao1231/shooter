import { useEffect, useRef } from "react";
import { getArena, type ArenaDefinition } from "@inkshot/sim";

interface ArenaPreviewProps {
  arenaId: string;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Small silhouette of an arena: a scaled-down side view of its platforms,
 * tinted with the arena's own palette. Used in the menu, the lobby, and the
 * level-select screen so players can tell maps apart before jumping in.
 */
export function ArenaPreview({
  arenaId,
  className,
  width = 320,
  height = 144,
}: ArenaPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const arena: ArenaDefinition = getArena(arenaId);
    const scale = Math.min(canvas.width / arena.width, canvas.height / arena.height);
    const offsetX = (canvas.width - arena.width * scale) / 2;
    const offsetY = (canvas.height - arena.height * scale) / 2;

    const background = context.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, arena.palette.backgroundTop);
    background.addColorStop(1, arena.palette.backgroundBottom);
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const platform of arena.platforms) {
      const x = offsetX + platform.x * scale;
      const y = offsetY + platform.y * scale;
      const w = Math.max(1, platform.w * scale);
      const h = Math.max(1, platform.h * scale);
      if (platform.kind === "frame") {
        context.fillStyle = "#061018";
      } else if (platform.kind === "pillar") {
        context.fillStyle = arena.palette.pillar;
      } else {
        context.fillStyle = arena.palette.blockB;
      }
      context.fillRect(x, y, w, h);
    }

    // Swinging platforms hang at rest (angle 0) from their anchors.
    for (const swing of arena.swings ?? []) {
      const anchorX = offsetX + swing.anchorX * scale;
      const anchorY = offsetY + swing.anchorY * scale;
      const cx = offsetX + swing.anchorX * scale;
      const cy = offsetY + (swing.anchorY + swing.length) * scale;
      context.strokeStyle = "rgba(232,230,223,.4)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(anchorX, anchorY);
      context.lineTo(cx, cy);
      context.stroke();
      context.fillStyle = arena.palette.blockB;
      context.fillRect(
        cx - (swing.w * scale) / 2,
        cy - (swing.h * scale) / 2,
        Math.max(1, swing.w * scale),
        Math.max(1, swing.h * scale),
      );
    }

    for (const spawn of [arena.spawns.player, arena.spawns.bot, ...arena.spawns.bots]) {
      const x = offsetX + spawn.x * scale;
      const y = offsetY + spawn.y * scale;
      context.fillStyle = "#e8e6df";
      context.beginPath();
      context.arc(x, y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }, [arenaId, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={width}
      height={height}
      aria-label={`${getArena(arenaId).name} map preview`}
    />
  );
}

import { useEffect, useRef } from "react";
import type { HudState, MatchEvent, MatchStart } from "@inkshot/sim";
import { LanRuntime } from "../game/LanRuntime";
import type { LanSession } from "../game/LanSession";

interface LanGameProps {
  session: LanSession;
  matchStart: MatchStart;
  onHud: (hud: HudState) => void;
  onMatchEvent: (event: MatchEvent) => void;
}

export function LanGame({ session, matchStart, onHud, onMatchEvent }: LanGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onHudRef = useRef(onHud);
  const onEventRef = useRef(onMatchEvent);
  onHudRef.current = onHud;
  onEventRef.current = onMatchEvent;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = new LanRuntime(canvas, session, matchStart, {
      onHud: (hud) => onHudRef.current(hud),
      onMatchEvent: (event) => onEventRef.current(event),
    });
    return () => runtime.destroy();
  }, [session, matchStart]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      tabIndex={0}
      aria-label="Inkshot LAN match"
    />
  );
}

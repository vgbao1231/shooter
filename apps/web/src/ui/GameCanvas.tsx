import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { BotDifficulty, CardId, CardSpec, HudState } from "@inkshot/sim";
import { GameRuntime, type GameCallbacks, type GameHandle } from "../game/GameRuntime";

interface GameCanvasProps {
  mode: "training" | "gauntlet";
  arenaId: string;
  botCount?: number;
  botDifficulty?: BotDifficulty;
  matchTarget?: number;
  onHud: (hud: HudState) => void;
  onToggleCards: () => void;
  onDebugChange: (enabled: boolean) => void;
}

export const GameCanvas = forwardRef<GameHandle, GameCanvasProps>(
  function GameCanvas(
    {
      mode,
      arenaId,
      botCount,
      botDifficulty,
      matchTarget,
      onHud,
      onToggleCards,
      onDebugChange,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const runtimeRef = useRef<GameRuntime | null>(null);
    const callbacksRef = useRef<GameCallbacks>({
      onHud,
      onToggleCards,
      onDebugChange,
    });

    callbacksRef.current = { onHud, onToggleCards, onDebugChange };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const runtime = new GameRuntime(
        canvas,
        {
          onHud: (hud) => callbacksRef.current.onHud(hud),
          onToggleCards: () => callbacksRef.current.onToggleCards(),
          onDebugChange: (enabled) => callbacksRef.current.onDebugChange(enabled),
        },
        { mode, arenaId, botCount, botDifficulty, matchTarget },
      );
      runtimeRef.current = runtime;
      return () => {
        runtime.destroy();
        runtimeRef.current = null;
      };
    }, [mode, arenaId, botCount, botDifficulty, matchTarget]);

    useImperativeHandle(
      ref,
      () => ({
        pause: (paused: boolean) => runtimeRef.current?.pause(paused),
        reset: (clearCards?: boolean) => runtimeRef.current?.reset(clearCards),
        resetMatch: () => runtimeRef.current?.resetMatch(),
        getCardOffers: (): CardSpec[] => runtimeRef.current?.getCardOffers() ?? [],
        applyCard: (cardId: CardId): boolean => runtimeRef.current?.applyCard(cardId) ?? false,
        setDebug: (enabled: boolean) => runtimeRef.current?.setDebug(enabled),
        startWave: (wave: number) => runtimeRef.current?.startWave(wave),
        setPlayerSkin: (skin: string) => runtimeRef.current?.setPlayerSkin(skin),
      }),
      [],
    );

    return (
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={0}
        aria-label="Inkshot arena"
      />
    );
  },
);

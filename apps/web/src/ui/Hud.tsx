import { getArena, type HudState, type PlayerHud } from "@inkshot/sim";

function FighterCard({
  fighter,
  align,
  label,
  score,
  matchTarget,
}: {
  fighter: PlayerHud;
  align: "left" | "right";
  label: string;
  score?: number;
  matchTarget?: number;
}) {
  const healthPercent = Math.max(0, Math.min(100, (fighter.health / fighter.maxHealth) * 100));
  return (
    <div className={`fighter-card fighter-card--${align}`}>
      <div className="fighter-card__top">
        <span className="fighter-card__swatch" style={{ background: fighter.color }} />
        <div>
          <span className="eyebrow">{label}</span>
          <strong>{fighter.name}</strong>
        </div>
        <span className={`fighter-card__state ${fighter.alive ? "" : "is-out"}`}>
          {fighter.alive ? "LIVE" : "OUT"}
        </span>
      </div>
      <div className="fighter-card__health">
        <span style={{ width: `${healthPercent}%`, background: fighter.color }} />
      </div>
      <div className="fighter-card__meta">
        <span>{Math.ceil(fighter.health)} HP</span>
        <span>{typeof score === "number" ? `Score ${score}${matchTarget ? ` / ${matchTarget}` : ""}` : "Pistol"}</span>
        <span>{fighter.isBot ? "BOT" : "HUMAN"}</span>
      </div>
    </div>
  );
}

function MatchBanner({ hud }: { hud: HudState }) {
  const isMatch = hud.mode === "match";
  if (!isMatch) return null;

  if (hud.matchOver) {
    const winnerName =
      hud.winnerId !== null
        ? [hud.player, ...hud.bots].find((entry) => entry.id === hud.winnerId)?.name ??
          "Nobody"
        : "Nobody";
    return (
      <div className="hud__result">
        <span className="eyebrow">Match over</span>
        <strong>{winnerName} wins</strong>
        <span>Final {hud.player.score} – {hud.bot.score}</span>
      </div>
    );
  }

  if (hud.roundState === "countdown") {
    return (
      <div className="hud__result">
        <span className="eyebrow">Round {hud.roundNumber}</span>
        <strong>READY</strong>
        <span>First to {hud.matchTarget}</span>
      </div>
    );
  }

  if (hud.roundState === "roundEnd") {
    const winnerId = hud.winnerId;
    const name =
      winnerId === null
        ? "DRAW"
        : [hud.player, ...hud.bots].find((entry) => entry.id === winnerId)?.name ??
          "DRAW";
    return (
      <div className="hud__result">
        <span className="eyebrow">Round {hud.roundNumber}</span>
        <strong>{name} takes it</strong>
        <span>
          {hud.player.score} – {hud.bot.score}
        </span>
      </div>
    );
  }

  return null;
}

export function Hud({
  hud,
  debug,
  wave,
  coins,
}: {
  hud: HudState;
  debug: boolean;
  wave: number;
  coins: number;
}) {
  const { player } = hud;
  const isMatch = hud.mode === "match";
  const result =
    hud.winnerId === null
      ? "DRAW"
      : hud.winnerId === player.id
        ? hud.mode === "gauntlet"
          ? "WAVE CLEAR"
          : "YOU WIN"
        : hud.mode === "gauntlet"
          ? "GAUNTLET OVER"
          : "BOT WINS";

  const modeLine =
    hud.mode === "gauntlet"
      ? `Gauntlet · Wave ${wave}`
      : isMatch
        ? `Match · Round ${hud.roundNumber} · first to ${hud.matchTarget}`
        : "Training";
  const modeTitle = hud.mode === "gauntlet" ? "Bot Gauntlet" : getArena(hud.arenaId).name;
  const modeSub =
    hud.mode === "gauntlet"
      ? `Coins ${coins}`
      : isMatch
        ? `${player.score} – ${hud.bot.score}`
        : "Sandbox · 1v1 bot";

  return (
    <div className="hud">
      <div className="hud__top">
        <FighterCard
          fighter={player}
          align="left"
          label={isMatch ? "You" : "Player 01"}
          score={isMatch ? player.score : undefined}
          matchTarget={isMatch ? hud.matchTarget : undefined}
        />
        <div className="hud__mode">
          <span className="eyebrow">Inkshot · {modeLine}</span>
          <strong>{modeTitle}</strong>
          <span>{modeSub}</span>
        </div>
        <FighterCard
          fighter={hud.bot}
          align="right"
          label={isMatch ? "Bot squad" : hud.mode === "gauntlet" ? "Bot squad" : "Training bot"}
          score={isMatch ? hud.bot.score : undefined}
          matchTarget={isMatch ? hud.matchTarget : undefined}
        />
      </div>

      <div className="hud__controls">
        <span>A/D move</span>
        <span>Space jump</span>
        <span>Into wall + hold jump to climb</span>
        <span>LMB fire</span>
        <span>RMB/G grenade</span>
        <span>C cards</span>
        <span>R reset</span>
        <span>F1 debug</span>
      </div>

      {hud.roundOver && hud.mode === "training" ? (
        <div className="hud__result">
          <span className="eyebrow">Training result</span>
          <strong>{result}</strong>
          <span>Resetting in {Math.max(0, hud.resetIn).toFixed(1)}s</span>
        </div>
      ) : null}

      <MatchBanner hud={hud} />

      {debug ? (
        <div className="hud__debug">
          <span>FPS {hud.fps}</span>
          <span>TICK {hud.tick}</span>
          <span>
            POS {Math.round(player.x)}, {Math.round(player.y)}
          </span>
          <span>WALL {player.wallDir}</span>
          <span>BULLETS {hud.bulletCount}</span>
          <span>FX {hud.particleCount}</span>
          <span>BOTS {hud.botsAlive}</span>
          <span>ROUND {hud.roundState}</span>
        </div>
      ) : null}

      <div className="hud__fps">{hud.fps} FPS</div>
    </div>
  );
}

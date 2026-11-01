import { useEffect, useRef, useState } from "react";
import {
  ARENAS,
  ARENA_ORDER,
  type BotDifficulty,
  type CardId,
  type CardSpec,
  type HudState,
  type LobbyConfig,
  type LobbyState,
  type MatchEvent,
  type MatchStart,
} from "@inkshot/sim";
import type { GameHandle } from "./game/GameRuntime";
import { LanSession } from "./game/LanSession";
import { CardOverlay } from "./ui/CardOverlay";
import { DeckPanel } from "./ui/DeckPanel";
import { GameCanvas } from "./ui/GameCanvas";
import { Hud } from "./ui/Hud";
import { LanGame } from "./ui/LanGame";

type Screen = "menu" | "game" | "lan-lobby";
type Mode = "training" | "gauntlet" | "match" | "lan";

const SKIN_UNLOCKS = [
  { wave: 3, id: "gold", name: "Gold" },
  { wave: 5, id: "neon", name: "Neon" },
  { wave: 8, id: "ink", name: "Ink" },
] as const;

const SKIN_COLORS: Record<string, string> = {
  gold: "#ffd54a",
  neon: "#39ffb4",
  ink: "#c78bff",
};

export default function App() {
  const gameRef = useRef<GameHandle>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("training");
  const [arenaId, setArenaId] = useState(ARENA_ORDER[0] ?? "proving-grounds");
  const [hud, setHud] = useState<HudState | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [offers, setOffers] = useState<CardSpec[]>([]);
  const [debug, setDebug] = useState(false);

  // Match options.
  const [botCount, setBotCount] = useState(1);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("normal");
  const [matchTarget, setMatchTarget] = useState(3);

  // LAN (Phase 3).
  const lanRef = useRef<LanSession | null>(null);
  const [lanAddr, setLanAddr] = useState("http://localhost:8080");
  const [lanName, setLanName] = useState("YOU");
  const [lanLobby, setLanLobby] = useState<LobbyState | null>(null);
  const [lanMatchStart, setLanMatchStart] = useState<MatchStart | null>(null);
  const [lanError, setLanError] = useState<string | null>(null);
  const [lanConnecting, setLanConnecting] = useState(false);
  const [lanMatchOver, setLanMatchOver] = useState(false);

  const [wave, setWave] = useState(1);
  const [coins, setCoins] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [waveClearedHandled, setWaveClearedHandled] = useState(false);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>([]);
  const [equippedSkin, setEquippedSkin] = useState("default");

  const closeCards = (): void => {
    setCardsOpen(false);
    gameRef.current?.pause(false);
  };

  const toggleCards = (): void => {
    if (mode === "match") return; // cards are a sandbox/gauntlet tool in Phase 2
    if (cardsOpen) {
      closeCards();
      return;
    }
    const api = gameRef.current;
    if (!api) return;
    setOffers(api.getCardOffers());
    setCardsOpen(true);
    api.pause(true);
  };

  const pickCard = (cardId: CardId): void => {
    gameRef.current?.applyCard(cardId);
    closeCards();
  };

  const startGame = (): void => {
    setCoins(0);
    setWave(1);
    setGameOver(false);
    setShopOpen(false);
    setWaveClearedHandled(false);
    setUnlockedSkins([]);
    setEquippedSkin("default");
    setScreen("game");
  };

  const backToMenu = (): void => {
    setScreen("menu");
    setCardsOpen(false);
    setShopOpen(false);
    setGameOver(false);
    setHud(null);
  };

  useEffect(() => {
    if (!cardsOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Escape") {
        event.preventDefault();
        closeCards();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cardsOpen]);

  useEffect(() => {
    if (!hud || mode !== "gauntlet" || !hud.roundOver || gameOver || shopOpen || waveClearedHandled) {
      return;
    }
    if (!hud.player.alive) {
      setGameOver(true);
      return;
    }
    if (hud.botsAlive === 0) {
      setWaveClearedHandled(true);
      const reward = Math.round((50 + wave * 25) * (hud.player.cards.includes("FORTUNE") ? 1.25 : 1));
      setCoins((value) => value + reward);
      setUnlockedSkins((value) => {
        const added = SKIN_UNLOCKS.filter(
          (skin) => skin.wave <= wave && !value.includes(skin.id),
        ).map((skin) => skin.id);
        return added.length ? [...value, ...added] : value;
      });
      setShopOpen(true);
    }
  }, [hud, mode, wave, gameOver, shopOpen, waveClearedHandled]);

  const nextWave = (): void => {
    const next = wave + 1;
    setWave(next);
    setShopOpen(false);
    setWaveClearedHandled(false);
    gameRef.current?.startWave(next);
  };

  const retry = (): void => {
    gameRef.current?.reset(true);
    setCoins(0);
    setWave(1);
    setGameOver(false);
    setShopOpen(false);
    setWaveClearedHandled(false);
    setEquippedSkin("default");
    gameRef.current?.startWave(1);
  };

  const rematch = (): void => {
    gameRef.current?.resetMatch();
  };

  const disconnectLan = (): void => {
    lanRef.current?.disconnect();
    lanRef.current = null;
    setLanLobby(null);
    setLanMatchStart(null);
    setLanMatchOver(false);
    setLanError(null);
    setLanConnecting(false);
    setHud(null);
  };

  const connectLan = async (): Promise<void> => {
    const addr = lanAddr.trim() || "http://localhost:8080";
    const name = lanName.trim() || "YOU";
    if (lanConnecting) return;
    setLanConnecting(true);
    setLanError(null);
    const session = new LanSession({
      onLobby: (state) => setLanLobby(state),
      onMatchStart: (start) => {
        setLanMatchStart(start);
        setLanMatchOver(false);
        setScreen("game");
      },
      onMatchEvent: (event) => {
        if (event.type === "matchEnd") setLanMatchOver(true);
      },
      onError: (message) => setLanError(message),
      onClose: (reason) => {
        if (lanRef.current === session) {
          setLanError(reason);
          disconnectLan();
          setScreen("menu");
        }
      },
    });
    lanRef.current = session;
    try {
      await session.connect(addr, name);
      setScreen("lan-lobby");
    } catch (error) {
      setLanError(error instanceof Error ? error.message : "Connection failed");
      disconnectLan();
    } finally {
      setLanConnecting(false);
    }
  };

  const lanIsHost = lanLobby?.hostId !== null && lanRef.current?.isHost === true;

  const updateLanConfig = (patch: Partial<LobbyConfig>): void => {
    lanRef.current?.setConfig(patch);
  };

  const buyUpgrade = (cardId: CardId, cost: number): void => {
    if (coins < cost) return;
    if (hud?.player.cards.includes(cardId)) return;
    const applied = gameRef.current?.applyCard(cardId);
    if (applied) setCoins((value) => value - cost);
  };

  const equipSkin = (skin: string): void => {
    gameRef.current?.setPlayerSkin(skin);
    setEquippedSkin(skin);
  };

  const owned = hud?.player.cards ?? [];

  if (screen === "menu") {
    return (
      <main className="menu">
        <div className="menu__inner">
          <p className="menu__eyebrow">A 2–4 player LAN arena shooter</p>
          <h1 className="menu__title">INKSHOT</h1>
          <p className="menu__sub">
            Original art. Pistol-only combat. Cards turn it into a shotgun, an SMG, or something stranger.
          </p>

          <div className="menu__modes">
            <button
              className={`menu__mode ${mode === "training" ? "is-active" : ""}`}
              onClick={() => setMode("training")}
            >
              <strong>Training</strong>
              <span>1v1 bot sandbox · cards · feel-testing</span>
            </button>
            <button
              className={`menu__mode ${mode === "match" ? "is-active" : ""}`}
              onClick={() => setMode("match")}
            >
              <strong>Match</strong>
              <span>Rounds · first-to-N · bot difficulty · 1vN</span>
            </button>
            <button
              className={`menu__mode ${mode === "gauntlet" ? "is-active" : ""}`}
              onClick={() => setMode("gauntlet")}
            >
              <strong>Bot Gauntlet</strong>
              <span>Waves · earn coins · upgrades · unlock skins</span>
            </button>
            <button
              className={`menu__mode ${mode === "lan" ? "is-active" : ""}`}
              onClick={() => setMode("lan")}
            >
              <strong>LAN</strong>
              <span>2–4 browsers · host + join · same network</span>
            </button>
          </div>

          {mode === "match" ? (
            <div className="menu__match">
              <div className="menu__match-row">
                <span className="menu__label">Bots</span>
                <div className="menu__arena-row">
                  {[1, 2, 3].map((count) => (
                    <button
                      key={count}
                      className={`menu__arena-option ${botCount === count ? "is-active" : ""}`}
                      onClick={() => setBotCount(count)}
                    >
                      1v{count}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu__match-row">
                <span className="menu__label">Difficulty</span>
                <div className="menu__arena-row">
                  {(["easy", "normal", "hard"] as const).map((level) => (
                    <button
                      key={level}
                      className={`menu__arena-option ${botDifficulty === level ? "is-active" : ""}`}
                      onClick={() => setBotDifficulty(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu__match-row">
                <span className="menu__label">First to</span>
                <div className="menu__arena-row">
                  {[3, 5].map((target) => (
                    <button
                      key={target}
                      className={`menu__arena-option ${matchTarget === target ? "is-active" : ""}`}
                      onClick={() => setMatchTarget(target)}
                    >
                      {target}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {mode === "lan" ? (
            <div className="menu__lan">
              <div className="menu__match-row">
                <span className="menu__label">Host</span>
                <input
                  className="menu__input"
                  value={lanAddr}
                  onChange={(event) => setLanAddr(event.target.value)}
                  placeholder="http://192.168.1.10:8080"
                  aria-label="LAN host address"
                />
              </div>
              <div className="menu__match-row">
                <span className="menu__label">Name</span>
                <input
                  className="menu__input"
                  value={lanName}
                  onChange={(event) => setLanName(event.target.value)}
                  placeholder="YOU"
                  maxLength={16}
                  aria-label="Your name"
                />
              </div>
              {lanError ? <p className="menu__lan-error">{lanError}</p> : null}
              <button
                className="menu__start"
                onClick={() => void connectLan()}
                disabled={lanConnecting}
              >
                {lanConnecting ? "Connecting…" : "Connect"}
              </button>
              <p className="menu__hint">
                The first client in the room is the host. Everyone joins the same address.
              </p>
            </div>
          ) : (
            <>
              <div className="menu__arena">
                <span className="menu__label">Arena</span>
                <div className="menu__arena-row">
                  {ARENA_ORDER.map((id) => {
                    const arena = ARENAS[id];
                    if (!arena) return null;
                    return (
                      <button
                        key={id}
                        className={`menu__arena-option ${arenaId === id ? "is-active" : ""}`}
                        onClick={() => setArenaId(id)}
                      >
                        {arena.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="menu__start" onClick={startGame}>
                Start {mode === "gauntlet" ? "Gauntlet" : mode === "match" ? "Match" : "Training"}
              </button>
              <p className="menu__hint">Click the arena to lock the mouse · Esc releases it</p>
            </>
          )}
        </div>
      </main>
    );
  }

  if (screen === "lan-lobby") {
    const lobby = lanLobby;
    const config = lobby?.config;
    return (
      <main className="menu">
        <div className="menu__inner">
          <p className="menu__eyebrow">LAN · same network</p>
          <h1 className="menu__title">LOBBY</h1>
          {lanError ? <p className="menu__lan-error">{lanError}</p> : null}

          <div className="lobby__slots">
            {(lobby?.slots ?? []).map((slot) => {
              const occupied = Boolean(slot.sessionId);
              const isHost = slot.sessionId === lobby?.hostId;
              return (
                <div
                  key={slot.index}
                  className={`lobby__slot ${occupied ? "" : "is-empty"}`}
                >
                  <span className="lobby__slot-index">{slot.index + 1}</span>
                  <strong>{slot.sessionId ? slot.name : "Open slot"}</strong>
                  <span className="lobby__slot-tags">
                    {isHost ? <em className="lobby__tag">HOST</em> : null}
                    {occupied && !isHost ? <em className="lobby__tag">YOU</em> : null}
                    {occupied && slot.ready ? (
                      <em className="lobby__tag is-ready">READY</em>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          {lanIsHost && config ? (
            <div className="menu__match">
              <div className="menu__match-row">
                <span className="menu__label">Bots</span>
                <div className="menu__arena-row">
                  {[0, 1, 2, 3].map((count) => (
                    <button
                      key={count}
                      className={`menu__arena-option ${config.botCount === count ? "is-active" : ""}`}
                      onClick={() => updateLanConfig({ botCount: count })}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu__match-row">
                <span className="menu__label">Difficulty</span>
                <div className="menu__arena-row">
                  {(["easy", "normal", "hard"] as const).map((level) => (
                    <button
                      key={level}
                      className={`menu__arena-option ${config.botDifficulty === level ? "is-active" : ""}`}
                      onClick={() => updateLanConfig({ botDifficulty: level })}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu__match-row">
                <span className="menu__label">First to</span>
                <div className="menu__arena-row">
                  {[3, 5].map((target) => (
                    <button
                      key={target}
                      className={`menu__arena-option ${config.matchTarget === target ? "is-active" : ""}`}
                      onClick={() => updateLanConfig({ matchTarget: target })}
                    >
                      {target}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu__match-row">
                <span className="menu__label">Arena</span>
                <div className="menu__arena-row">
                  {ARENA_ORDER.map((id) => {
                    const arena = ARENAS[id];
                    if (!arena) return null;
                    return (
                      <button
                        key={id}
                        className={`menu__arena-option ${config.arenaId === id ? "is-active" : ""}`}
                        onClick={() => updateLanConfig({ arenaId: id })}
                      >
                        {arena.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className="menu__start" onClick={() => lanRef.current?.startMatch()}>
                Start match
              </button>
            </div>
          ) : (
            <div className="menu__match">
              <button
                className="menu__start"
                onClick={() =>
                  lanRef.current?.setReady(
                    !(lanLobby?.slots.find(
                      (slot) => slot.sessionId === lanRef.current?.roomSessionId,
                    )?.ready ?? false),
                  )
                }
              >
                {lanLobby?.slots.find(
                  (slot) => slot.sessionId === lanRef.current?.roomSessionId,
                )?.ready
                  ? "Unready"
                  : "Ready"}
              </button>
              <p className="menu__hint">Waiting for the host to start.</p>
            </div>
          )}

          <button className="menu-button" onClick={() => { disconnectLan(); setScreen("menu"); }}>
            Leave lobby
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="game-shell">
        {mode === "lan" && lanMatchStart && lanRef.current ? (
          <LanGame
            session={lanRef.current}
            matchStart={lanMatchStart}
            onHud={setHud}
            onMatchEvent={() => undefined}
          />
        ) : (
          <GameCanvas
            ref={gameRef}
            mode={mode as "training" | "gauntlet" | "match"}
            arenaId={arenaId}
            botCount={botCount}
            botDifficulty={botDifficulty}
            matchTarget={matchTarget}
            onHud={setHud}
            onToggleCards={toggleCards}
            onDebugChange={setDebug}
          />
        )}
        {hud ? <Hud hud={hud} debug={debug} wave={wave} coins={coins} /> : null}
        {hud ? (
          <DeckPanel
            owned={owned}
            visible={
              mode === "match" || mode === "lan"
                ? false // cards are not a LAN/match tool in Phase 3
                : mode === "training"
                  ? true
                  : !shopOpen && !gameOver
            }
          />
        ) : null}

        <button
          className="menu-button"
          onClick={() => {
            if (mode === "lan") {
              disconnectLan();
              setScreen("menu");
            } else {
              backToMenu();
            }
          }}
        >
          Menu
        </button>

        {cardsOpen && hud ? (
          <CardOverlay
            offers={offers}
            owned={owned}
            onPick={pickCard}
            onReroll={() => setOffers(gameRef.current?.getCardOffers() ?? [])}
            onClose={closeCards}
          />
        ) : null}

        {mode === "gauntlet" && shopOpen && hud ? (
          <div className="shop-overlay" role="dialog" aria-modal="true">
            <div className="shop-overlay__box">
              <span className="eyebrow">Wave {wave} cleared</span>
              <h2>Upgrade your loadout</h2>
              <p className="shop-overlay__coins">Coins: {coins}</p>
              <div className="shop-overlay__grid">
                <ShopItem
                  label="Damage"
                  detail="+4 bullet damage"
                  cost={100}
                  disabled={coins < 100 || owned.includes("MEGA")}
                  onBuy={() => buyUpgrade("MEGA", 100)}
                />
                <ShopItem
                  label="Vitality"
                  detail="+30 max HP"
                  cost={120}
                  disabled={coins < 120 || owned.includes("VITAL")}
                  onBuy={() => buyUpgrade("VITAL", 120)}
                />
                <ShopItem
                  label="Speed"
                  detail="+22% move speed"
                  cost={100}
                  disabled={coins < 100 || owned.includes("DASH")}
                  onBuy={() => buyUpgrade("DASH", 100)}
                />
                <ShopItem
                  label="Card"
                  detail="Draw 1 of 3 random cards"
                  cost={150}
                  disabled={coins < 150}
                  onBuy={() => {
                    const api = gameRef.current;
                    if (!api) return;
                    setOffers(api.getCardOffers());
                    setCoins((value) => value - 150);
                    setCardsOpen(true);
                    api.pause(true);
                  }}
                />
              </div>

              {unlockedSkins.length > 0 ? (
                <div className="shop-overlay__skins">
                  <span className="eyebrow">Skins unlocked</span>
                  <div>
                    {SKIN_UNLOCKS.filter((skin) => unlockedSkins.includes(skin.id)).map((skin) => (
                      <button
                        key={skin.id}
                        className={`skin-chip ${equippedSkin === skin.id ? "is-active" : ""}`}
                        style={{ color: SKIN_COLORS[skin.id], borderColor: SKIN_COLORS[skin.id] }}
                        onClick={() => equipSkin(skin.id)}
                      >
                        {skin.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button className="menu__start shop-overlay__next" onClick={nextWave}>
                Next wave · {wave + 1}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "gauntlet" && gameOver ? (
          <div className="gameover-overlay">
            <span className="eyebrow">Bot Gauntlet</span>
            <h2>You fell at wave {wave}</h2>
            <p>Coins earned: {coins}</p>
            <div className="gameover-overlay__actions">
              <button className="menu__start" onClick={retry}>
                Retry
              </button>
              <button className="ghost-button" onClick={backToMenu}>
                Menu
              </button>
            </div>
          </div>
        ) : null}

        {mode === "match" && hud?.matchOver ? (
          <div className="gameover-overlay">
            <span className="eyebrow">Match over</span>
            <h2>{hud.player.score > hud.bot.score ? "You win" : "Bots win"}</h2>
            <p>
              {hud.player.score} – {hud.bot.score} · first to {hud.matchTarget}
            </p>
            <div className="gameover-overlay__actions">
              <button className="menu__start" onClick={rematch}>
                Rematch
              </button>
              <button className="ghost-button" onClick={backToMenu}>
                Menu
              </button>
            </div>
          </div>
        ) : null}

        {mode === "lan" && hud?.matchOver ? (
          <div className="gameover-overlay">
            <span className="eyebrow">Match over</span>
            <h2>{hud.player.score > hud.bot.score ? "You win" : "Opponent wins"}</h2>
            <p>
              {hud.player.score} – {hud.bot.score} · first to {hud.matchTarget}
            </p>
            <div className="gameover-overlay__actions">
              {lanIsHost ? (
                <button
                  className="menu__start"
                  onClick={() => {
                    setLanMatchOver(false);
                    lanRef.current?.rematch();
                  }}
                >
                  Rematch
                </button>
              ) : (
                <p className="menu__hint">Waiting for the host to rematch…</p>
              )}
              <button
                className="ghost-button"
                onClick={() => {
                  disconnectLan();
                  setScreen("menu");
                }}
              >
                Menu
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ShopItem({
  label,
  detail,
  cost,
  disabled,
  onBuy,
}: {
  label: string;
  detail: string;
  cost: number;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="shop-item">
      <strong>{label}</strong>
      <span>{detail}</span>
      <button className="ghost-button" disabled={disabled} onClick={onBuy}>
        {disabled ? "Owned / low coins" : `${cost} coins`}
      </button>
    </div>
  );
}
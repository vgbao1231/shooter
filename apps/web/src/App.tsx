import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ARENAS,
  ARENA_ORDER,
  CARD_BY_ID,
  getArena,
  TEAM_COLORS,
  type BotDifficulty,
  type CardId,
  type CardSpec,
  type HudState,
  type LobbyConfig,
  type LobbyState,
  type MatchEvent,
  type MatchStart,
  type CardPickMessage,
} from "@inkshot/sim";
import type { GameHandle } from "./game/GameRuntime";
import { defaultServerAddr, LanSession, roomCodeFromLocation } from "./game/LanSession";
import { ArenaPreview } from "./ui/ArenaPreview";
import { CardOverlay } from "./ui/CardOverlay";
import { DeckPanel } from "./ui/DeckPanel";
import { GameCanvas } from "./ui/GameCanvas";
import { Hud } from "./ui/Hud";
import { LanGame } from "./ui/LanGame";

type Screen = "menu" | "game" | "lan-lobby" | "level-select";
type Mode = "training" | "gauntlet" | "lan";

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

interface LevelDef {
  id: number;
  arenaId: string;
  botCount: number;
  botDifficulty: BotDifficulty;
  wave: number;
}

// Temporary: every level is playable. Difficulty scales with the level so the
// gauntlet ramps up, and the two arenas alternate.
const LEVELS: LevelDef[] = [
  { id: 1, arenaId: "proving-grounds", botCount: 1, botDifficulty: "easy", wave: 1 },
  { id: 2, arenaId: "skyline", botCount: 1, botDifficulty: "normal", wave: 2 },
  { id: 3, arenaId: "proving-grounds", botCount: 2, botDifficulty: "normal", wave: 3 },
  { id: 4, arenaId: "skyline", botCount: 2, botDifficulty: "hard", wave: 4 },
  { id: 5, arenaId: "proving-grounds", botCount: 3, botDifficulty: "hard", wave: 5 },
  { id: 6, arenaId: "skyline", botCount: 3, botDifficulty: "hard", wave: 6 },
];

export default function App() {
  const gameRef = useRef<GameHandle>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("training");
  const [arenaId, setArenaId] = useState(ARENA_ORDER[0] ?? "proving-grounds");
  const [hud, setHud] = useState<HudState | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [offers, setOffers] = useState<CardSpec[]>([]);
  const [debug, setDebug] = useState(false);
  const [paused, setPaused] = useState(false);

  // Match options (training + gauntlet).
  const [botCount, setBotCount] = useState(1);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("normal");
  const [matchTarget, setMatchTarget] = useState(3);

  // LAN (Phase 3).
  const lanRef = useRef<LanSession | null>(null);
  const [lanName, setLanName] = useState("YOU");
  const [lanJoinCode, setLanJoinCode] = useState("");
  const [lanLobby, setLanLobby] = useState<LobbyState | null>(null);
  const [lanMatchStart, setLanMatchStart] = useState<MatchStart | null>(null);
  const [lanError, setLanError] = useState<string | null>(null);
  const [lanConnecting, setLanConnecting] = useState(false);
  const [lanMatchOver, setLanMatchOver] = useState(false);
  const [copied, setCopied] = useState(false);
  // Loser-picks-card overlay (a scored 1v1 round ended; the loser chooses).
  const [lanCardPick, setLanCardPick] = useState<CardPickMessage | null>(null);
  const [lanCardDeadline, setLanCardDeadline] = useState<number | null>(null);
  const [lanCardSeconds, setLanCardSeconds] = useState(0);

  useEffect(() => {
    if (lanCardDeadline === null) return;
    const tick = (): void => {
      const remaining = Math.max(0, Math.ceil((lanCardDeadline - Date.now()) / 1000));
      setLanCardSeconds(remaining);
      if (remaining <= 0) {
        setLanCardDeadline(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [lanCardDeadline]);

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

  // LAN loser-picks-card: send the choice; the overlay clears when the server
  // confirms (or auto-picks after the timeout).
  const pickLanCard = (cardId: CardId): void => {
    lanRef.current?.pickCard(cardId);
  };

  const resetGauntletState = (): void => {
    setCoins(0);
    setWave(1);
    setGameOver(false);
    setShopOpen(false);
    setWaveClearedHandled(false);
    setUnlockedSkins([]);
    setEquippedSkin("default");
  };

  const startTraining = (): void => {
    setMode("training");
    setBotCount(1);
    setBotDifficulty("normal");
    resetGauntletState();
    setPaused(false);
    setScreen("game");
  };

  const startLevel = (level: LevelDef): void => {
    setMode("gauntlet");
    setArenaId(level.arenaId);
    setBotCount(level.botCount);
    setBotDifficulty(level.botDifficulty);
    setWave(level.wave);
    setCoins(0);
    setGameOver(false);
    setShopOpen(false);
    setWaveClearedHandled(false);
    setUnlockedSkins([]);
    setEquippedSkin("default");
    setPaused(false);
    setScreen("game");
  };

  const backToMenu = (): void => {
    gameRef.current?.pause(false);
    setPaused(false);
    setScreen("menu");
    setCardsOpen(false);
    setShopOpen(false);
    setGameOver(false);
    setHud(null);
  };

  // Esc → pause/settings overlay (local modes). Cards/shop/game-over handle
  // their own keys and keep this listener quiet.
  useEffect(() => {
    if (screen !== "game" || mode === "lan" || cardsOpen || shopOpen || gameOver) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Escape") {
        event.preventDefault();
        const next = !paused;
        setPaused(next);
        gameRef.current?.pause(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, mode, paused, cardsOpen, shopOpen, gameOver]);

  // Esc leaves the LAN room: back out of the lobby or an in-progress match
  // (same as the Menu button). Without this, Esc was a no-op in LAN mode and
  // a host had no way to exit mid-room except clicking the on-screen Menu.
  useEffect(() => {
    if (mode !== "lan") return;
    if (screen !== "game" && screen !== "lan-lobby") return;
    if (lanCardPick) return; // let the card-pick overlay handle its own flow
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Escape") {
        event.preventDefault();
        disconnectLan();
        setScreen("menu");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, screen, lanCardPick]);

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

  const connectLan = async (joinCode?: string): Promise<void> => {
    const addr = defaultServerAddr();
    const name = lanName.trim() || "YOU";
    const code = joinCode?.trim().toUpperCase() || "";
    if (lanConnecting) return;
    // The game screen mounts `LanGame` only when `mode === "lan"`. A guest who
    // joins via share link (auto-join) or code never clicked the LAN menu tab,
    // so without this the match would render the local training sim instead.
    setMode("lan");
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
      onCardPick: (message) => {
        if (message.phase === "offer") {
          setLanCardPick(message);
          setLanCardDeadline(message.timeout ? Date.now() + message.timeout * 1000 : null);
        } else {
          setLanCardPick(null);
          setLanCardDeadline(null);
        }
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
      await Promise.race([
        session.connect(addr, name, code || undefined),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timed out connecting to the LAN host — is `pnpm host` running?")),
            10_000,
          ),
        ),
      ]);
      setScreen("lan-lobby");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      setLanError(
        /ROOM_CODE_TAKEN/.test(message)
          ? "Room code is taken — create a new room."
          : /no rooms found/i.test(message)
            ? "No room with that code — check the code and try again."
            : message,
      );
      disconnectLan();
    } finally {
      setLanConnecting(false);
    }
  };

  // Visiting a share link like `http://host:8080/QH3Z5` auto-joins that room.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current) return;
    autoJoined.current = true;
    const code = roomCodeFromLocation(window.location);
    if (!code) return;
    void connectLan(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lanIsHost = lanLobby?.hostId !== null && lanRef.current?.isHost === true;

  const updateLanConfig = (patch: Partial<LobbyConfig>): void => {
    lanRef.current?.setConfig(patch);
  };

  const roomLink = lanLobby?.code ? `${window.location.origin}/${lanLobby.code}` : "";
  const copyRoomLink = (): void => {
    if (!roomLink) return;
    void navigator.clipboard.writeText(roomLink).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
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

  if (screen === "level-select") {
    return (
      <main className="menu">
        <div className="menu__inner">
          <p className="menu__eyebrow">Vượt ải · Bot Gauntlet</p>
          <h1 className="menu__title">CHỌN ẢI</h1>
          <p className="menu__sub">
            Độ khó tăng dần theo ải. Tạm thời mọi ải đều mở để chơi.
          </p>

          <div className="level-grid">
            {LEVELS.map((level) => {
              const arena = getArena(level.arenaId);
              return (
                <button
                  key={level.id}
                  className="level-card"
                  onClick={() => startLevel(level)}
                >
                  <ArenaPreview arenaId={level.arenaId} className="level-card__preview" />
                  <strong>Ải {level.id}</strong>
                  <span className="level-card__meta">
                    {arena.name} · {level.botCount} bot · {level.botDifficulty}
                  </span>
                </button>
              );
            })}
          </div>

          <button className="ghost-button" onClick={() => setScreen("menu")}>
            Back to menu
          </button>
        </div>
      </main>
    );
  }

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
              className={`menu__mode ${mode === "gauntlet" ? "is-active" : ""}`}
              onClick={() => setMode("gauntlet")}
            >
              <strong>Vượt ải</strong>
              <span>Waves · pick a level · earn coins · unlock skins</span>
            </button>
            <button
              className={`menu__mode ${mode === "lan" ? "is-active" : ""}`}
              onClick={() => setMode("lan")}
            >
              <strong>LAN</strong>
              <span>2–4 browsers · host + join · same network</span>
            </button>
          </div>

          {mode === "gauntlet" ? (
            <button className="menu__start" onClick={() => setScreen("level-select")}>
              Choose a level
            </button>
          ) : null}

          {mode === "lan" ? (
            <div className="menu__lan">
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
                {lanConnecting ? "Connecting…" : "Create room"}
              </button>
              <div className="menu__lan-divider">
                <span>or</span>
              </div>
              <div className="menu__match-row">
                <span className="menu__label">Join room</span>
                <div className="menu__lan-join">
                  <input
                    className="menu__input menu__input--code"
                    value={lanJoinCode}
                    onChange={(event) => setLanJoinCode(event.target.value.toUpperCase())}
                    placeholder="QH3Z5"
                    maxLength={8}
                    aria-label="Room code"
                  />
                  <button
                    className="menu__lan-join-button"
                    onClick={() => void connectLan(lanJoinCode)}
                    disabled={lanConnecting || !lanJoinCode.trim()}
                  >
                    Join
                  </button>
                </div>
              </div>
              <p className="menu__hint">
                Create a room to get a code + share link, or enter a friend's code to join.
              </p>
            </div>
          ) : null}

          {mode === "training" ? (
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
                <ArenaPreview arenaId={arenaId} className="menu__arena-preview" />
              </div>

              <button className="menu__start" onClick={startTraining}>
                Start Training
              </button>
              <p className="menu__hint">Aim with the mouse · Esc pauses · no pointer lock</p>
            </>
          ) : null}
        </div>
      </main>
    );
  }

  if (screen === "lan-lobby") {
    const lobby = lanLobby;
    const config = lobby?.config;
    const teams = config?.teams ?? 2;
    const roomSession = lanRef.current?.roomSessionId ?? null;
    const mySlot = lobby?.slots.find((slot) => slot.sessionId === roomSession) ?? null;
    const botTeams = config?.botTeams ?? [];
    const botTotal = botTeams.reduce((sum, count) => sum + count, 0);
    const humansCount = (lobby?.slots ?? []).filter((slot) => slot.sessionId).length;
    const totalPlayers = humansCount + botTotal;
    const addBot = (team: number): void => {
      updateLanConfig({
        botTeams: botTeams.map((count, index) => (index === team ? count + 1 : count)),
      });
    };
    const removeBot = (team: number): void => {
      updateLanConfig({
        botTeams: botTeams.map((count, index) =>
          index === team ? Math.max(0, count - 1) : count,
        ),
      });
    };
    return (
      <main className="menu">
        <div className="menu__inner menu__inner--wide">
          <p className="menu__eyebrow">LAN · same network</p>
          <h1 className="menu__title">LOBBY</h1>
          {lanError ? <p className="menu__lan-error">{lanError}</p> : null}
          {!lanLobby && !lanError ? (
            <p className="menu__hint">Waiting for the lobby…</p>
          ) : null}

          {lanLobby?.code ? (
            <div className="lobby__room">
              <div className="lobby__room-code" title="Room code">
                <span className="menu__label">Room code</span>
                <strong>{lanLobby.code}</strong>
              </div>
              <div className="lobby__room-link">
                <span className="menu__label">Invite link</span>
                <code>{roomLink}</code>
              </div>
              <button
                className="menu-button"
                onClick={copyRoomLink}
                disabled={!roomLink}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          ) : null}

          <div className="lobby__grid">
            {/* Left: pick a side — team columns with host add-bot per team. */}
            <section className="lobby__col lobby__col--teams">
              <div className="lobby__col-head">
                <span className="menu__label">Pick your side</span>
                {lanIsHost ? (
                  <div className="lobby__seg" aria-label="Team count">
                    {[2, 3, 4].map((count) => (
                      <button
                        key={count}
                        className={config?.teams === count ? "is-active" : ""}
                        onClick={() => updateLanConfig({ teams: count })}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="lobby__teams">
                {Array.from({ length: teams }, (_, team) => {
                  const members = (lobby?.slots ?? []).filter(
                    (slot) => slot.team === team && slot.sessionId,
                  );
                  const selected = mySlot?.team === team;
                  const bots = botTeams[team] ?? 0;
                  const full = totalPlayers >= 4;
                  return (
                    <div
                      key={team}
                      className={`lobby__team ${selected ? "is-selected" : ""}`}
                      style={{ "--team-color": TEAM_COLORS[team] ?? "#fff" } as CSSProperties}
                    >
                      <button
                        className="lobby__team-join"
                        onClick={() => lanRef.current?.setTeam(team)}
                        title={`Join team ${team + 1}`}
                      >
                        <span className="lobby__team-name">TEAM {team + 1}</span>
                        <span className="lobby__team-members">
                          {members.length === 0 ? (
                            <em>Empty — click to join</em>
                          ) : (
                            members.map((slot) => (
                              <span key={slot.index} className="lobby__member">
                                {slot.sessionId === lobby?.hostId ? "★ " : ""}
                                {slot.name}
                              </span>
                            ))
                          )}
                        </span>
                      </button>
                      <div className="lobby__team-bots">
                        {Array.from({ length: bots }, (_, botIndex) => (
                          <span key={botIndex} className="lobby__bot-chip">
                            BOT
                            {lanIsHost ? (
                              <button
                                className="lobby__bot-remove"
                                onClick={() => removeBot(team)}
                                aria-label={`Remove bot from team ${team + 1}`}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                        {lanIsHost ? (
                          <button
                            className="lobby__bot-add"
                            onClick={() => addBot(team)}
                            disabled={full}
                            title={full ? "Room is full" : `Add a bot to team ${team + 1}`}
                          >
                            + Add bot
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Right: match setup (styled like the reference lobby panel). */}
            <section className="lobby__col lobby__col--setup">
              <div className="lobby__setup">
                <ArenaPreview
                  arenaId={config?.arenaId ?? "proving-grounds"}
                  className="lobby__setup-preview"
                />
                <span className="lobby__setup-title">MATCH SETUP</span>
                <div className="lobby__setup-grid">
                  <div className="lobby__setup-item">
                    <span className="lobby__setup-label">GAME MODE</span>
                    <strong className="lobby__setup-value">{teams} teams</strong>
                  </div>
                  <div className="lobby__setup-item">
                    <span className="lobby__setup-label">ARENA</span>
                    {lanIsHost ? (
                      <select
                        className="lobby__select"
                        value={config?.arenaId ?? "proving-grounds"}
                        onChange={(event) => updateLanConfig({ arenaId: event.target.value })}
                        aria-label="Arena"
                      >
                        {ARENA_ORDER.map((id) => {
                          const arena = ARENAS[id];
                          return arena ? (
                            <option key={id} value={id}>
                              {arena.name}
                            </option>
                          ) : null;
                        })}
                      </select>
                    ) : (
                      <strong className="lobby__setup-value">
                        {getArena(config?.arenaId ?? "proving-grounds").name}
                      </strong>
                    )}
                  </div>
                  <div className="lobby__setup-item">
                    <span className="lobby__setup-label">FIRST TO</span>
                    {lanIsHost ? (
                      <div className="lobby__seg">
                        {[3, 5].map((target) => (
                          <button
                            key={target}
                            className={config?.matchTarget === target ? "is-active" : ""}
                            onClick={() => updateLanConfig({ matchTarget: target })}
                          >
                            {target}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <strong className="lobby__setup-value">{config?.matchTarget ?? 3}</strong>
                    )}
                  </div>
                  <div className="lobby__setup-item">
                    <span className="lobby__setup-label">BOTS</span>
                    <strong className="lobby__setup-value">{botTotal}</strong>
                  </div>
                </div>

                <div className="lobby__setup-players">
                  <span className="lobby__setup-title">CONNECTED PLAYERS</span>
                  <div className="lobby__player-grid">
                    {(lobby?.slots ?? [])
                      .filter((slot) => slot.sessionId)
                      .map((slot) => (
                        <span key={slot.index} className="lobby__player-chip">
                          <i
                            className="lobby__player-dot"
                            style={{ background: TEAM_COLORS[slot.team] ?? "#fff" }}
                          />
                          {slot.sessionId === lobby?.hostId ? "★ " : ""}
                          {slot.name}
                          {slot.sessionId === roomSession ? " (you)" : ""}
                        </span>
                      ))}
                    {Array.from({ length: teams }, (_, team) =>
                      Array.from({ length: botTeams[team] ?? 0 }, (_, botIndex) => (
                        <span key={`${team}-${botIndex}`} className="lobby__player-chip">
                          <i
                            className="lobby__player-dot"
                            style={{ background: TEAM_COLORS[team] ?? "#fff" }}
                          />
                          BOT
                        </span>
                      )),
                    )}
                  </div>
                </div>

                {lanIsHost ? (
                  <button className="lobby__join" onClick={() => lanRef.current?.startMatch()}>
                    START MATCH
                  </button>
                ) : (
                  <button
                    className="lobby__join"
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
                      ? "UNREADY"
                      : "READY"}
                  </button>
                )}
              </div>
            </section>
          </div>

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
            mode={mode as "training" | "gauntlet"}
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
              mode === "lan"
                ? false // cards are not a LAN tool in Phase 3
                : mode === "training"
                  ? true
                  : !shopOpen && !gameOver
            }
          />
        ) : null}

        {!paused ? (
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
        ) : null}

        {paused && hud ? (
          <div className="pause-overlay" role="dialog" aria-modal="true">
            <div className="pause-overlay__box">
              <span className="eyebrow">Paused</span>
              <h2>Settings</h2>
              <button
                className="menu__start"
                onClick={() => {
                  setPaused(false);
                  gameRef.current?.pause(false);
                }}
              >
                Resume
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  gameRef.current?.pause(false);
                  backToMenu();
                }}
              >
                Menu
              </button>
            </div>
          </div>
        ) : null}

        {lanCardPick?.phase === "offer" &&
        lanCardPick.playerId === lanRef.current?.myPlayerId ? (
          <CardOverlay
            mode="loser"
            offers={(lanCardPick.offers ?? [])
              .map((id) => CARD_BY_ID.get(id))
              .filter((card): card is CardSpec => Boolean(card))}
            owned={[]}
            onPick={pickLanCard}
            onReroll={() => undefined}
            onClose={() => undefined}
            secondsLeft={lanCardSeconds}
          />
        ) : null}

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

        {mode === "lan" && hud?.matchOver ? (
          <LanMatchOverlay
            hud={hud}
            lanIsHost={lanIsHost}
            onRematch={() => {
              setLanMatchOver(false);
              lanRef.current?.rematch();
            }}
            onMenu={() => {
              disconnectLan();
              setScreen("menu");
            }}
          />
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

function LanMatchOverlay({
  hud,
  lanIsHost,
  onRematch,
  onMenu,
}: {
  hud: HudState;
  lanIsHost: boolean;
  onRematch: () => void;
  onMenu: () => void;
}) {
  const isTeam = hud.teamCount > 1;
  let headline: string;
  let scoreLine: string;
  if (isTeam) {
    const myTeam = hud.player.team;
    const myScore = hud.teamScores[myTeam] ?? 0;
    const bestOther = Math.max(
      ...Object.entries(hud.teamScores)
        .filter(([team]) => Number(team) !== myTeam)
        .map(([, score]) => score),
      0,
    );
    const won = myScore > bestOther;
    headline = won ? "Your team wins" : "Enemy team wins";
    scoreLine = `${myScore} – ${bestOther} · first to ${hud.matchTarget}`;
  } else {
    const won = hud.player.score > hud.bot.score;
    headline = won ? "You win" : "Opponent wins";
    scoreLine = `${hud.player.score} – ${hud.bot.score} · first to ${hud.matchTarget}`;
  }
  return (
    <div className="gameover-overlay">
      <span className="eyebrow">Match over</span>
      <h2>{headline}</h2>
      <p>{scoreLine}</p>
      <div className="gameover-overlay__actions">
        {lanIsHost ? (
          <button className="menu__start" onClick={onRematch}>
            Rematch
          </button>
        ) : (
          <p className="menu__hint">Waiting for the host to rematch…</p>
        )}
        <button className="ghost-button" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}

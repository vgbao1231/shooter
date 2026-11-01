import { CARD_BY_ID, type CardId, type CardSpec } from "@inkshot/sim";
import { CardArt } from "./CardArt";

interface CardOverlayProps {
  offers: CardSpec[];
  owned: CardId[];
  onPick: (cardId: CardId) => void;
  onReroll: () => void;
  onClose: () => void;
  /** "sandbox" (training/gauntlet, reroll + close) or "loser" (LAN 1v1 pick). */
  mode?: "sandbox" | "loser";
  /** Loser-mode countdown in seconds (shown as the auto-pick timer). */
  secondsLeft?: number;
}

export function CardOverlay({
  offers,
  owned,
  onPick,
  onReroll,
  onClose,
  mode = "sandbox",
  secondsLeft = 0,
}: CardOverlayProps) {
  const loser = mode === "loser";
  return (
    <div className="card-overlay" role="dialog" aria-modal="true" aria-label="Choose an upgrade card">
      <div className="card-overlay__box">
        <div className="card-overlay__heading">
          <span className="eyebrow">{loser ? "Round lost" : "Sandbox upgrade"}</span>
          <h2>{loser ? "Pick your comeback card" : "Choose one card"}</h2>
          <p>
            {loser
              ? secondsLeft > 0
                ? `Auto-picks in ${secondsLeft}s.`
                : "The first card is auto-picked on timeout."
              : "Cards stay for the rest of the session. In a real 1v1, only the loser picks."}
          </p>
        </div>

        {offers.length > 0 ? (
          <div className="card-hand">
            {offers.map((card, index) => (
              <button
                key={card.id}
                className="upgrade-card"
                style={{
                  ["--accent" as string]: card.accent,
                  ["--delay" as string]: `${index * 70}ms`,
                }}
                onClick={() => onPick(card.id)}
              >
                <span className="upgrade-card__frame">
                  <span className="upgrade-card__inner">
                    <strong>{card.name}</strong>
                    <span className="upgrade-card__art">
                      <CardArt card={card} />
                    </span>
                    <span className="upgrade-card__copy">
                      <span>{card.description}</span>
                      <span className="upgrade-card__lines">
                        {card.lines.map((line) => (
                          <span key={line.text} className={line.tone}>
                            {line.tone === "pos" ? "+" : "−"} {line.text}
                          </span>
                        ))}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="card-overlay__empty">Every card is already equipped.</p>
        )}

        <div className="card-overlay__actions">
          <button className="ghost-button" onClick={onReroll} disabled={offers.length === 0 || loser}>
            Reroll
          </button>
          <button className="ghost-button" onClick={onClose} disabled={loser}>
            Close · Esc
          </button>
        </div>

        {!loser && owned.length > 0 ? (
          <div className="owned-cards">
            <span>Equipped</span>
            {owned.map((cardId) => {
              const card = CARD_BY_ID.get(cardId);
              return (
                <span key={cardId} style={{ borderColor: card?.accent }}>
                  {card?.name ?? cardId}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
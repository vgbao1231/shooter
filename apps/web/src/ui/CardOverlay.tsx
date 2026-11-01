import { CARD_BY_ID, type CardId, type CardSpec } from "@inkshot/sim";
import { CardArt } from "./CardArt";

interface CardOverlayProps {
  offers: CardSpec[];
  owned: CardId[];
  onPick: (cardId: CardId) => void;
  onReroll: () => void;
  onClose: () => void;
}

export function CardOverlay({
  offers,
  owned,
  onPick,
  onReroll,
  onClose,
}: CardOverlayProps) {
  return (
    <div className="card-overlay" role="dialog" aria-modal="true" aria-label="Choose an upgrade card">
      <div className="card-overlay__box">
        <div className="card-overlay__heading">
          <span className="eyebrow">Sandbox upgrade</span>
          <h2>Choose one card</h2>
          <p>Cards stay for the rest of the session. In a real 1v1, only the loser picks.</p>
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
          <button className="ghost-button" onClick={onReroll} disabled={offers.length === 0}>
            Reroll
          </button>
          <button className="ghost-button" onClick={onClose}>
            Close · Esc
          </button>
        </div>

        {owned.length > 0 ? (
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
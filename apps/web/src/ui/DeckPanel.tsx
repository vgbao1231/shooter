import { CARD_CATALOG, CARD_CATEGORIES, type CardId } from "@inkshot/sim";

const categoryLabels: Record<string, string> = {
  projectile: "Projectile",
  combat: "Combat",
  defense: "Defense",
  movement: "Movement",
  passive: "Passive",
};

export function DeckPanel({ owned, visible }: { owned: CardId[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="deck-panel">
      <div className="deck-panel__head">
        <span className="eyebrow">Card deck</span>
        <span>{owned.length}/{CARD_CATALOG.length} equipped</span>
      </div>
      <div className="deck-panel__body">
        {CARD_CATEGORIES.map((category) => {
          const cards = CARD_CATALOG.filter((card) => card.category === category);
          return (
            <div className="deck-panel__row" key={category}>
              <span className="deck-panel__cat">{categoryLabels[category]}</span>
              <div className="deck-panel__cards">
                {cards.map((card) => {
                  const isOwned = owned.includes(card.id);
                  return (
                    <span
                      key={card.id}
                      className={`deck-panel__card ${isOwned ? "is-owned" : ""}`}
                      style={{ borderColor: card.accent, color: isOwned ? card.accent : undefined }}
                      title={card.description}
                    >
                      {card.name}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
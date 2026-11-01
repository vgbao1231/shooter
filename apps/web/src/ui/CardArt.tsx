import type { CardSpec } from "@inkshot/sim";

export function CardArt({ card }: { card: CardSpec }) {
  const color = card.accent;
  const face = {
    fill: "none",
    stroke: "#0d1424",
    strokeWidth: 3.5,
    strokeLinecap: "round" as const,
  };

  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      {card.art === "BLAST" ? (
        <polygon
          points="60,6 70,36 98,22 84,50 114,60 84,70 98,98 70,84 60,114 50,84 22,98 36,70 6,60 36,50 22,22 50,36"
          fill={color}
          opacity=".35"
        />
      ) : null}
      {card.art === "BOUNCE" ? (
        <path
          d="M10 104 28 36 52 100 76 36 100 104"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".45"
        />
      ) : null}
      {card.art === "FRAG" ? (
        <>
          <circle cx="94" cy="36" r="15" fill={color} opacity=".5" />
          <rect x="89" y="16" width="10" height="9" fill={color} opacity=".5" />
        </>
      ) : null}
      {card.art === "RAPID" ? (
        <path
          d="M14 30h40M6 52h30M14 74h40"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          opacity=".5"
        />
      ) : null}
      {card.art === "BUCKSHOT" ? (
        <g fill={color} opacity=".5">
          <circle cx="100" cy="34" r="5" />
          <circle cx="108" cy="52" r="5" />
          <circle cx="100" cy="70" r="5" />
          <circle cx="86" cy="44" r="4" />
          <circle cx="86" cy="62" r="4" />
        </g>
      ) : null}
      {card.art === "PIERCE" ? (
        <path
          d="M20 104 70 20M70 20l-8 4M70 20l-2 9"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          opacity=".55"
        />
      ) : null}
      {card.art === "MEGA" ? (
        <>
          <circle cx="82" cy="44" r="24" fill={color} opacity=".35" />
          <path
            d="M62 78l14-18 12 10 20-24"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".6"
          />
        </>
      ) : null}
      {card.art === "NITRO" ? (
        <g fill={color} opacity=".45">
          <circle cx="86" cy="42" r="20" />
          <circle cx="60" cy="72" r="11" />
          <circle cx="38" cy="94" r="6" />
        </g>
      ) : null}
      {card.art === "VITAL" ? (
        <>
          <path
            d="M60 96C44 84 32 70 32 56c0-12 9-20 18-20 6 0 8 3 10 5 2-2 4-5 10-5 9 0 18 8 18 20 0 14-12 28-28 40z"
            fill={color}
            opacity=".45"
          />
        </>
      ) : null}
      {card.art === "PLATE" ? (
        <path
          d="M60 28 96 42v24c0 18-16 30-36 38C40 96 24 84 24 66V42z"
          fill={color}
          opacity=".4"
        />
      ) : null}
      {card.art === "DASH" ? (
        <g stroke={color} strokeWidth="7" strokeLinecap="round" opacity=".55">
          <path d="M24 78h56M34 60h40M34 96h40" />
        </g>
      ) : null}
      {card.art === "SPRING" ? (
        <path
          d="M24 92c12-24 36-12 36-36S36 28 60 24"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          opacity=".55"
        />
      ) : null}
      {card.art === "FORTUNE" ? (
        <g fill={color} opacity=".5">
          <circle cx="60" cy="48" r="8" />
          <circle cx="82" cy="68" r="6" />
          <circle cx="42" cy="74" r="6" />
          <circle cx="64" cy="86" r="5" />
        </g>
      ) : null}
      <circle cx="60" cy="64" r="34" fill={color} />
      <path d="M43 60q6 6 12 0M65 60q6 6 12 0" {...face} />
      <path d="M53 78q7-6 14 0" {...face} />
    </svg>
  );
}
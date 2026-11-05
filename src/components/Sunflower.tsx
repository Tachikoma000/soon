// A hand-drawn sunflower that opens from a tight green bud (bloom = 0)
// to full flower (bloom = 1).

const FRONT = [0, 31, 59, 90, 121, 150, 180, 210, 239, 270, 301, 330];
const BACK = [15, 45, 74, 104, 135, 164, 195, 225, 254, 285, 314, 344];
const BRACTS = [8, 38, 66, 97, 128, 157, 188, 217, 247, 278, 307, 337];
const SEEDS: Array<[number, number]> = [
  [56, 50], [61, 48.5], [65.5, 51.5], [53.5, 55], [58.5, 54.5], [63.5, 55.5], [56.5, 59.5], [61.5, 60],
];
const CX = 60;
const CY = 54;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (t: number) => t * t * (3 - 2 * t);

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function petal(length: number, width: number, base = 10): string {
  const tip = CY - length;
  const b = CY - base;
  const d = b - tip;
  const f = (n: number) => n.toFixed(2);
  return `M${CX} ${f(tip)}C${f(CX + width)} ${f(tip + 0.3 * d)} ${f(CX + width * 1.1)} ${f(tip + 0.68 * d)} ${CX} ${f(b)} ${f(CX - width * 1.1)} ${f(tip + 0.68 * d)} ${f(CX - width)} ${f(tip + 0.3 * d)} ${CX} ${f(tip)}Z`;
}

type Props = {
  bloom: number;
  size?: number;
  stem?: boolean;
  sway?: boolean;
  label?: string;
  className?: string;
};

export function Sunflower({ bloom, size = 120, stem = true, sway = false, label, className }: Props) {
  const t = clamp01(bloom);
  const open = ease(clamp01((t - 0.12) / 0.88));
  const head = 0.62 + 0.38 * ease(t);
  const disk = mix("#7e9a6a", "#6e4524", ease(clamp01((t - 0.2) / 0.6)));
  const diskR = 9.5 + 5 * ease(t);
  const front = petal(11 + 29 * open, 2.5 + 5.5 * open);
  const back = petal(11 + 34 * open, 3 + 5.5 * open);
  const bract = petal(15.5, 4.4, 6);
  const viewBox = stem ? "0 0 120 170" : "12 6 96 96";
  const height = stem ? Math.round((size * 170) / 120) : size;

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={height}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className={sway ? "sway" : undefined} style={{ transformOrigin: "60px 166px", transformBox: "view-box" }}>
        {stem && (
          <g fill="none" stroke="#4f6b45" strokeLinecap="round" strokeLinejoin="round">
            <path d={`M60 ${CY + diskR * head}C57 112 63 134 59 166`} strokeWidth="2.4" />
            <path d="M60.5 128C70 114 88 112 97 117 89 129 74 134 60.5 128Z" fill="#dce5d3" strokeWidth="1.5" />
            <path d="M61 128C72 123 84 119 95 117.5" strokeWidth="1" />
            <path d="M59.5 146C50 135 33 134 25 139 33 150 47 153 59.5 146Z" fill="#dce5d3" strokeWidth="1.5" />
            <path d="M59 146C49 142 37 139 27 139" strokeWidth="1" />
          </g>
        )}
        <g transform={`translate(${CX} ${CY}) scale(${head.toFixed(3)}) translate(${-CX} ${-CY})`}>
          <g fill="#8fa77b" stroke="#4f6b45" strokeWidth="1" strokeLinejoin="round">
            {BRACTS.map((r) => (
              <path key={r} transform={`rotate(${r} ${CX} ${CY})`} d={bract} />
            ))}
          </g>
          {open > 0.02 && (
            <>
              <g fill="#f2cc6b" stroke="#9a6a2e" strokeWidth="1" strokeLinejoin="round" opacity={Math.min(1, open * 1.6)}>
                {BACK.map((r) => (
                  <path key={r} transform={`rotate(${r} ${CX} ${CY})`} d={back} />
                ))}
              </g>
              <g fill="#e2a93b" stroke="#8a5a2b" strokeWidth="1.1" strokeLinejoin="round">
                {FRONT.map((r) => (
                  <path key={r} transform={`rotate(${r} ${CX} ${CY})`} d={front} />
                ))}
              </g>
            </>
          )}
          <circle cx={CX} cy={CY} r={diskR} fill={disk} stroke={mix("#4f6b45", "#3f2512", t)} strokeWidth="1.3" />
          {t > 0.45 && (
            <g opacity={clamp01((t - 0.45) / 0.4)}>
              <circle cx={CX} cy={CY} r={diskR * 0.62} fill="none" stroke="#9a6a36" strokeWidth="1" strokeDasharray="1.6 2.6" />
              <g fill="#b98548">
                {SEEDS.map(([x, y]) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />
                ))}
              </g>
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

/** The little 8-petal mark used inline next to text. */
export function SunMark({ size = 16 }: { size?: number }) {
  const d = "M12 1.8C13.7 3.8 13.8 6.4 12 8.8 10.2 6.4 10.3 3.8 12 1.8Z";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <g fill="#e2a93b" stroke="#8a5a2b" strokeWidth="1" strokeLinejoin="round">
        {[0, 44, 91, 134, 180, 226, 269, 316].map((r) => (
          <path key={r} d={d} transform={r ? `rotate(${r} 12 12)` : undefined} />
        ))}
      </g>
      <circle cx="12" cy="12" r="3.8" fill="#6e4524" />
    </svg>
  );
}

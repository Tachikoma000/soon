// Renders the app icons (a full-bloom sunflower on paper) into public/icons.
// Run with: npm run icons

import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const petal = (L, W, base = 10) => {
  const tip = 54 - L;
  const b = 54 - base;
  const d = b - tip;
  return `M60 ${tip}C${60 + W} ${tip + 0.3 * d} ${60 + W * 1.1} ${tip + 0.68 * d} 60 ${b} ${60 - W * 1.1} ${tip + 0.68 * d} ${60 - W} ${tip + 0.3 * d} 60 ${tip}Z`;
};
const rot = (list, d, attrs) => list.map((r) => `<path transform="rotate(${r} 60 54)" d="${d}" ${attrs}/>`).join("");

const head = `
  <g stroke-linejoin="round">
    ${rot([8, 38, 66, 97, 128, 157, 188, 217, 247, 278, 307, 337], petal(15.5, 4.4, 6), 'fill="#8fa77b" stroke="#4f6b45" stroke-width="1"')}
    ${rot([15, 45, 74, 104, 135, 164, 195, 225, 254, 285, 314, 344], petal(45, 8.5), 'fill="#f2cc6b" stroke="#9a6a2e" stroke-width="1"')}
    ${rot([0, 31, 59, 90, 121, 150, 180, 210, 239, 270, 301, 330], petal(40, 8), 'fill="#e2a93b" stroke="#8a5a2b" stroke-width="1.1"')}
  </g>
  <circle cx="60" cy="54" r="14.5" fill="#6e4524" stroke="#3f2512" stroke-width="1.3"/>
  <circle cx="60" cy="54" r="9" fill="none" stroke="#9a6a36" stroke-width="1" stroke-dasharray="1.6 2.6"/>
  <g fill="#b98548">
    ${[[56, 50], [61, 48.5], [65.5, 51.5], [53.5, 55], [58.5, 54.5], [63.5, 55.5], [56.5, 59.5], [61.5, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2"/>`).join("")}
  </g>`;

// The head spans roughly 96 units around (60, 54). `fill` is how much of the icon it takes.
function svg(fill) {
  const s = 96 / fill;
  const x = 60 - s / 2;
  const y = 54 - s / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${s} ${s}">
    <rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#f7f2ea"/>
    ${head}
  </svg>`;
}

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, 0.78],
  ["icon-512.png", 512, 0.78],
  ["apple-touch-icon.png", 180, 0.74],
  ["maskable-512.png", 512, 0.58],
];
for (const [name, size, fill] of out) {
  const png = new Resvg(svg(fill), { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`public/icons/${name}`, png);
  console.log("wrote", name);
}

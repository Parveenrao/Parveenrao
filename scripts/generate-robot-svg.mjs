// generate-robot-svg.mjs
// Builds an animated SVG: a little robot walks across the GitHub contribution
// grid in a boustrophedon (zig-zag) path, "lighting up" each cell as it passes.
//
// Usage (programmatic):
//   import { buildRobotSVG } from "./generate-robot-svg.mjs";
//   const svg = buildRobotSVG(weeks, { theme: "light" | "dark" });
//
// `weeks` shape (same shape GitHub's GraphQL contributionCalendar returns):
//   [ { contributionDays: [ { date, contributionCount, weekday } , ... ] }, ... ]

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const PAD = 4;
const TIME_PER_CELL = 0.055; // seconds of travel per grid cell -> tune loop length
const BOUNCE_PERIOD = 0.42;

const PALETTES = {
  light: {
    bg: "transparent",
    empty: "#ebedf0",
    levels: ["#c9c6ff", "#a29dff", "#7b73ff", "#6C63FF"],
    robotBody: "#2d2a55",
    robotAccent: "#00ADD8",
    robotEye: "#ffffff",
    trail: "#00ADD855",
  },
  dark: {
    bg: "transparent",
    empty: "#1b1f27",
    levels: ["#2f2a63", "#4a3fa0", "#5f52d6", "#6C63FF"],
    robotBody: "#e6e6ff",
    robotAccent: "#00ADD8",
    robotEye: "#0d1117",
    trail: "#00ADD855",
  },
};

function levelForCount(count, max) {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const frac = count / max;
  if (frac > 0.75) return 4;
  if (frac > 0.5) return 3;
  if (frac > 0.25) return 2;
  return 1;
}

export function buildRobotSVG(weeks, opts = {}) {
  const theme = opts.theme === "dark" ? "dark" : "light";
  const palette = PALETTES[theme];

  // Flatten to find max contribution count (for level buckets)
  let maxCount = 0;
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      if (d.contributionCount > maxCount) maxCount = d.contributionCount;
    }
  }

  const cols = weeks.length;
  const width = PAD * 2 + cols * STEP - GAP;
  const height = PAD * 2 + 7 * STEP - GAP + 6; // small extra for robot bob

  // Build traversal order: boustrophedon (snake path) column by column
  // so every step the robot takes is exactly one grid step (equal speed).
  const nodes = []; // {x, y, week, day, count}
  weeks.forEach((w, wi) => {
    const dayOrder = wi % 2 === 0
      ? [0, 1, 2, 3, 4, 5, 6]
      : [6, 5, 4, 3, 2, 1, 0];
    for (const di of dayOrder) {
      const day = w.contributionDays[di];
      if (!day) continue;
      const x = PAD + wi * STEP + CELL / 2;
      const y = PAD + di * STEP + CELL / 2;
      nodes.push({ x, y, count: day.contributionCount });
    }
  });

  const dur = Math.max(4, (nodes.length - 1) * TIME_PER_CELL);

  // Path `d` for the robot to follow with animateMotion
  const pathD = nodes
    .map((n, i) => `${i === 0 ? "M" : "L"} ${n.x.toFixed(1)},${n.y.toFixed(1)}`)
    .join(" ");

  // Grid cells (rects) with discrete fill animation synced to when the robot passes
  const cellsSVG = [];
  weeks.forEach((w, wi) => {
    w.contributionDays.forEach((day, di) => {
      const cx = PAD + wi * STEP;
      const cy = PAD + di * STEP;
      const level = levelForCount(day.contributionCount, maxCount);
      const color = level === 0 ? palette.empty : palette.levels[level - 1];
      // find this node's index in traversal order to compute its begin time
      const idx = nodes.findIndex(
        (n) => Math.abs(n.x - (cx + CELL / 2)) < 0.01 && Math.abs(n.y - (cy + CELL / 2)) < 0.01
      );
      const begin = (idx >= 0 ? idx : 0) * TIME_PER_CELL;
      // keep the reveal keyframe a hair before the end so discrete mode has
      // a valid, spec-compliant 0..1 keyTimes range with the final segment
      // holding the revealed color until the loop restarts
      const fracBegin = Math.min(0.999, begin / dur).toFixed(4);

      cellsSVG.push(
        `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${CELL}" height="${CELL}" rx="2.5" ry="2.5" fill="${palette.empty}">` +
          (level > 0
            ? `<animate attributeName="fill" calcMode="discrete" values="${palette.empty};${color};${color}" keyTimes="0;${fracBegin};1" dur="${dur.toFixed(2)}s" begin="0s" repeatCount="indefinite"/>`
            : "") +
          `</rect>`
      );
    });
  });

  // Little pulse ring at each visited cell, timed to the robot's arrival
  // Pulse rings play on the first pass only (cosmetic flourish); the cells'
  // own discrete fill animation is what actually loops every cycle.
  const pulses = nodes
    .map((n, i) => {
      const t0 = i * TIME_PER_CELL;
      return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="1" fill="none" stroke="${palette.trail}" stroke-width="1.5" opacity="0">
        <animate attributeName="r" values="1;8" keyTimes="0;1" dur="0.5s" begin="${t0.toFixed(3)}s" fill="freeze"/>
        <animate attributeName="opacity" values="0.9;0" keyTimes="0;1" dur="0.5s" begin="${t0.toFixed(3)}s" fill="freeze"/>
      </circle>`;
    })
    .join("");

  const robotSVG = `
    <g id="robot" transform="translate(-6,-9)">
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-1.6; 0,0" keyTimes="0;0.5;1" dur="${BOUNCE_PERIOD}s" repeatCount="indefinite"/>
        <!-- antenna -->
        <line x1="6" y1="0" x2="6" y2="-3" stroke="${palette.robotAccent}" stroke-width="1.2"/>
        <circle cx="6" cy="-3.6" r="1.3" fill="${palette.robotAccent}"/>
        <!-- head/body -->
        <rect x="0" y="0" width="12" height="11" rx="3" fill="${palette.robotBody}"/>
        <rect x="1.5" y="2.5" width="9" height="4" rx="1.5" fill="${palette.robotAccent}" opacity="0.9"/>
        <circle cx="4" cy="4.5" r="0.9" fill="${palette.robotEye}"/>
        <circle cx="8" cy="4.5" r="0.9" fill="${palette.robotEye}"/>
        <!-- feet -->
        <rect x="1.5" y="11" width="3" height="1.6" rx="0.6" fill="${palette.robotBody}"/>
        <rect x="7.5" y="11" width="3" height="1.6" rx="0.6" fill="${palette.robotBody}"/>
      </g>
    </g>`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${palette.bg}"/>
  ${cellsSVG.join("\n  ")}
  ${pulses}
  <path id="robotPath" d="${pathD}" fill="none" stroke="none"/>
  <g>
    ${robotSVG}
    <animateMotion dur="${dur.toFixed(2)}s" repeatCount="indefinite" rotate="0">
      <mpath href="#robotPath"/>
    </animateMotion>
  </g>
</svg>`;
}

export function mockWeeks(numWeeks = 53) {
  const weeks = [];
  const today = new Date();
  for (let w = 0; w < numWeeks; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const r = Math.random();
      const count = r < 0.45 ? 0 : Math.floor(Math.random() * 12);
      days.push({ date: "mock", contributionCount: count, weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  return weeks;
}

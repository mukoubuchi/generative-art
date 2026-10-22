export const SIZE = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
// The three colours already used by Cafe Wall, without additional lighting.
export const DARK = [18, 22, 30];
export const LIGHT = [235, 228, 214];
export const TARGET = [126, 125, 122];
export const NEUTRAL = [202, 198, 188];
export const RIBBON_WIDTH = 8.5;

const TAU = 2 * Math.PI;
const smooth = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** One open spiral under a positive radial deformation; no branches are spliced in. */
export function ribbonPoints(samples = 5000) {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const angle = 0.62 + TAU * 10.35 * t;
    const radius = (13 + 257 * t)
      * (1 + 0.105 * Math.sin(3 * angle + 0.4) + 0.055 * Math.cos(5 * angle));
    return [SIZE / 2 + 0.98 * radius * Math.cos(angle),
      SIZE / 2 + 0.95 * radius * Math.sin(angle)];
  });
}

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Clip to the half-plane nearer a than b. The cells meet without invented borders. */
function clip(polygon, a, b) {
  const nx = b.x - a.x, ny = b.y - a.y;
  const cut = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
  const side = ([x, y]) => x * nx + y * ny - cut;
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = side(p), dq = side(q);
    if (dp <= 0) out.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function makeCells() {
  const random = generator(826311);
  const sites = [];
  const columns = 8, rows = 8;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    sites.push({ x: (x + 0.18 + 0.64 * random()) * SIZE / columns,
      y: (y + 0.18 + 0.64 * random()) * SIZE / rows,
      phase: random() * TAU });
  }
  return sites.map((site, index) => {
    let polygon = [[0, 0], [SIZE, 0], [SIZE, SIZE], [0, SIZE]];
    for (let other = 0; other < sites.length; other++) {
      if (other !== index) polygon = clip(polygon, site, sites[other]);
    }
    return { ...site, polygon };
  });
}

export function contextState(frame, held = false) {
  const time = ((frame % FRAMES) + FRAMES) % FRAMES / FPS;
  // The recorded comparison is the same held control available on the live page.
  const comparison = held || (time >= 10 && time <= 12);
  return { phase: TAU * time / DURATION, contrast: comparison ? 0 : 1, comparison };
}

export function cellColour(cell, frame, { uniform = false } = {}) {
  if (uniform) return [...NEUTRAL];
  const { phase, contrast } = contextState(frame);
  const x = cell.x / SIZE, y = cell.y / SIZE;
  const field = Math.sin(6.8 * x - 4.6 * y + phase)
    + 0.8 * Math.cos(4.1 * x + 7.3 * y - phase)
    + 0.38 * Math.sin(cell.phase + 2 * phase);
  const light = smooth((field + 0.55) / 1.1);
  return DARK.map((channel, index) => Math.round(NEUTRAL[index]
    + contrast * (channel + light * (LIGHT[index] - channel) - NEUTRAL[index])));
}

export const pageFrame = (seconds) => Math.floor(Math.max(0, seconds) * FPS) % FRAMES;

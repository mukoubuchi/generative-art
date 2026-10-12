export const WIDTH = 900;
export const HEIGHT = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
export const PAPER = [234, 227, 211];
export const INK = [43, 47, 46];
export const U_MIN = -5.2;
export const U_MAX = 5.2;
export const V_MIN = -3.35;
export const V_MAX = 3.35;
export const SAMPLE_STEP = 0.018;
const SCALE = 173;
const ROTATION = -0.34;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const root = ([x, y], n) => {
  const r = Math.hypot(x, y) ** (1 / n), a = Math.atan2(y, x) / n;
  return [r * Math.cos(a), r * Math.sin(a)];
};
const squaredDistance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** All three preimages of w under z^3 - 3z, calculated without another moving family. */
export function roots(u, v) {
  const half = [u / 2, v / 2];
  const square = mul(half, half);
  const radical = root([square[0] - 1, square[1]], 2);
  const plus = [half[0] + radical[0], half[1] + radical[1]];
  const minus = [half[0] - radical[0], half[1] - radical[1]];
  const a = root(Math.hypot(...plus) >= Math.hypot(...minus) ? plus : minus, 3);
  const norm = a[0] ** 2 + a[1] ** 2;
  const b = [a[0] / norm, -a[1] / norm];
  return [0, 1, 2].map((k) => {
    const phase = 2 * Math.PI * k / 3;
    const left = mul(a, [Math.cos(phase), Math.sin(phase)]);
    const right = mul(b, [Math.cos(phase), -Math.sin(phase)]);
    return [left[0] + right[0], left[1] + right[1]];
  });
}

export function potential(x, y) {
  return [x ** 3 - 3 * x * y ** 2 - 3 * x, 3 * x ** 2 * y - y ** 3 - 3 * y];
}

export function screenPoint([x, y], variant = 0) {
  // The intervention rotates only the second family's field, not the common aperture.
  const angle = ROTATION + (variant ? 0.41 : 0);
  return [
    WIDTH / 2 + SCALE * (Math.cos(angle) * x - Math.sin(angle) * y),
    HEIGHT / 2 - SCALE * (Math.sin(angle) * x + Math.cos(angle) * y)
  ];
}

const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function continueRoots(previous, next) {
  let order = permutations[0], best = Infinity;
  for (const permutation of permutations) {
    const cost = previous.reduce((sum, point, i) => sum + squaredDistance(point, next[permutation[i]]), 0);
    if (cost < best) { best = cost; order = permutation; }
  }
  return order.map((i) => next[i]);
}

function trace(family, value, index, count, variant) {
  const min = family === "weft" ? U_MIN : V_MIN;
  const max = family === "weft" ? U_MAX : V_MAX;
  const intervals = Math.ceil((max - min) / SAMPLE_STEP);
  const branches = [[], [], []];
  const lengths = [0, 0, 0];
  let previous;
  for (let i = 0; i <= intervals; i += 1) {
    const parameter = min + (max - min) * i / intervals;
    const u = family === "weft" ? parameter : value;
    const v = family === "weft" ? value : parameter;
    let solutions = roots(u, v);
    if (previous) solutions = continueRoots(previous, solutions);
    previous = solutions;
    solutions.forEach((z, branch) => {
      const [x, y] = screenPoint(z, variant);
      const points = branches[branch];
      if (i) lengths[branch] += Math.hypot(x - points[i - 1].x, y - points[i - 1].y);
      points.push({ x, y, u, v, s: lengths[branch], ink: exposure(x, y) > 0.03 });
    });
  }
  return branches.map((points, branch) => {
    // Opposite portions have distinct arrivals, while both drawing rules stay independent.
    const start = family === "warp" ? 0.4 + 3.4 * index / (count - 1) + 0.42 * branch
      : 6.2 + 2.6 * index / (count - 1) + 0.45 * branch;
    const speed = family === "warp" ? 42 : 48;
    return { family, value, index, branch, points, length: lengths[branch], start, speed,
      end: start + lengths[branch] / speed };
  });
}

function levels(groups) {
  return groups.flatMap(([lo, hi, count]) => Array.from({ length: count }, (_, i) =>
    lo + (hi - lo) * i / (count - 1)));
}

export function makeDrawing({ warp = true, weft = true, weftVariant = 0 } = {}) {
  const drawing = { warp: [], weft: [] };
  const u = levels([[-4.8, -2.15, 31], [-1.75, 1.35, 16], [2.13, 4.8, 29]]);
  const v = levels([[-2.86, -2.0, 3], [-0.68, 0.21, 2], [1.35, 2.99, 3]]);
  if (warp) u.forEach((value, i) => drawing.warp.push(...trace("warp", value, i, u.length, 0)));
  if (weft) v.forEach((value, i) => drawing.weft.push(...trace("weft", value, i, v.length, weftVariant)));
  return drawing;
}

/** One fixed opening in the paper, shared by both families of deposited ink. */
export function exposure(x, y) {
  const middle = 340 + 0.23 * (x - 450) + 24 * Math.sin((x - 280) / 155);
  const d = y - middle;
  const passage = 1 - Math.exp(-((d / 40) ** 4));
  const edge = Math.exp(-((d / 210) ** 6));
  return passage * edge;
}

export function positionAt(line, distance) {
  const d = clamp(distance, 0, line.length);
  let lo = 0, hi = line.points.length - 1;
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (line.points[mid].s <= d) lo = mid; else hi = mid;
  }
  const a = line.points[lo], b = line.points[hi];
  const t = (d - a.s) / (b.s - a.s || 1);
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** The renderer and geometric checks share these literal straight ink segments. */
export function inkSegments(line, from = 0, to = line.length, aperture = true) {
  const segments = [];
  if (to <= from) return segments;
  for (let i = 1; i < line.points.length; i += 1) {
    const a = line.points[i - 1], b = line.points[i];
    if (b.s <= from || a.s >= to) continue;
    if (aperture && (!a.ink || !b.ink)) continue;
    const left = Math.max(a.s, from), right = Math.min(b.s, to);
    const t0 = (left - a.s) / (b.s - a.s);
    const t1 = (right - a.s) / (b.s - a.s);
    segments.push([
      a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0,
      a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1,
      aperture ? exposure((a.x + b.x) / 2, (a.y + b.y) / 2) : 1
    ]);
  }
  return segments;
}

export function travelled(line, seconds) {
  return clamp((seconds - line.start) * line.speed, 0, line.length);
}

export function pageFrame(seconds) {
  return clamp(Math.floor(Math.max(0, seconds) * FPS), 0, FRAMES - 1);
}

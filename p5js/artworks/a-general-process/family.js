export const WIDTH = 900;
export const HEIGHT = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
export const SCALE = 138;
export const ANGLE = -0.21;
export const PARAMETERS = Array.from({ length: 97 }, (_, i) => -1.5 + i / 32);
const TAU = 2 * Math.PI;
const C = Math.cos(ANGLE), S = Math.sin(ANGLE);
const smooth = (t) => t * t * (3 - 2 * t);

/** The source circle is projected by W = 1 - lambda X. */
export function homogeneous(theta, lambda) {
  const x = Math.cos(theta), y = Math.sin(theta);
  return [x, y, 1 - lambda * x];
}

export function screen([x, y, w]) {
  return [WIDTH / 2 + SCALE * (C * x - S * y) / w,
    HEIGHT / 2 + SCALE * (S * x + C * y) / w];
}

/** Integer representatives of the same conic, for exact algebraic checks. */
export function rationalPoint(u, v, p, q) {
  return [2n * q * u * v, q * (u * u - v * v), q * (u * u + v * v) - 2n * p * u * v];
}

export function exactResidual([x, y, w], p, q) {
  return q * q * (x * x + y * y) - (q * w + p * x) ** 2n;
}

export function conicType(lambda) {
  return Math.abs(lambda) < 1 ? "ellipse" : Math.abs(lambda) === 1 ? "parabola" : "hyperbola";
}

/** Roots of a cos(theta) + b sin(theta) + c = 0. */
function roots(a, b, c) {
  const radius = Math.hypot(a, b);
  if (!radius || Math.abs(c) > radius) return [];
  const centre = Math.atan2(b, a), half = Math.acos(Math.max(-1, Math.min(1, -c / radius)));
  return [centre - half, centre + half].map((t) => ((t % TAU) + TAU) % TAU);
}

export function poles(lambda) {
  return roots(-lambda, 0, 1);
}

/** Split at every viewport intersection and every projective pole before sampling. */
export function visibleArcs(lambda, tolerance = 0.12) {
  const cuts = [0, TAU, ...poles(lambda)];
  for (const edge of [0, WIDTH]) {
    const d = WIDTH / 2 - edge;
    cuts.push(...roots(SCALE * C - d * lambda, -SCALE * S, d));
  }
  for (const edge of [0, HEIGHT]) {
    const d = HEIGHT / 2 - edge;
    cuts.push(...roots(SCALE * S - d * lambda, SCALE * C, d));
  }
  cuts.sort((a, b) => a - b);
  const unique = cuts.filter((t, i) => !i || t - cuts[i - 1] > 1e-10);
  const arcs = [];
  const at = (theta) => ({ theta, h: homogeneous(theta, lambda), xy: screen(homogeneous(theta, lambda)) });
  function subdivide(a, b, points, depth = 0) {
    const m = at((a.theta + b.theta) / 2);
    const error = Math.hypot(m.xy[0] - (a.xy[0] + b.xy[0]) / 2,
      m.xy[1] - (a.xy[1] + b.xy[1]) / 2);
    if (error > tolerance && depth < 18) {
      subdivide(a, m, points, depth + 1);
      subdivide(m, b, points, depth + 1);
    } else points.push(b);
  }
  for (let i = 1; i < unique.length; i++) {
    const start = unique[i - 1], end = unique[i], mid = at((start + end) / 2);
    if (!mid.xy.every(Number.isFinite) || mid.xy[0] < 0 || mid.xy[0] > WIDTH
      || mid.xy[1] < 0 || mid.xy[1] > HEIGHT) continue;
    const a = at(start), b = at(end);
    // A finite viewport cannot contain a pole; its edge roots occur first.
    if (Math.abs(a.h[2]) < 1e-10 || Math.abs(b.h[2]) < 1e-10) continue;
    const count = Math.max(1, Math.ceil((end - start) / (Math.PI / 32)));
    const points = [a];
    for (let n = 1; n <= count; n++) {
      subdivide(points[points.length - 1], at(start + (end - start) * n / count), points);
    }
    arcs.push(points);
  }
  return arcs;
}

const STATIONS = [[0, 0], [2, 0], [8, 0.9], [12, 1.1], [16, 1.5], [20, 0.9], [24, 0]];
export function stateAt(frame) {
  const time = ((frame % FRAMES) + FRAMES) % FRAMES / FPS;
  let lambda = 0;
  for (let i = 1; i < STATIONS.length; i++) {
    const [end, to] = STATIONS[i], [start, from] = STATIONS[i - 1];
    if (time <= end) { lambda = from + (to - from) * smooth((time - start) / (end - start)); break; }
  }
  return { lambda, type: conicType(lambda), time };
}
export const frameAt = (seconds) => Math.floor(Math.max(0, seconds) * FPS) % FRAMES;

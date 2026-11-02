export const WIDTH = 900, HEIGHT = 680, FPS = 30, DURATION = 24, FRAMES = FPS * DURATION;
export const N = 24, SPREAD_FRAMES = 180, SAMPLES = 96;
export const CENTRE = [450, 340], RADIUS = 300;
export const BASE_LINE = [[0.6, -0.8], [0.6, 0.8]];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
export const frameAt = (seconds) => Math.min(FRAMES - 1, Math.max(0, Math.floor(seconds * FPS)));

export function stateAt(frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= FRAMES) throw new RangeError("Frame outside performance");
  const spread = Math.max(0, Math.min(SPREAD_FRAMES, frame - 45));
  const travel = ease((frame - 330) / 300);
  return { frameIndex: frame, spread, projectionMix: ease((frame - 225) / 150),
    boostX: -0.62 + 0.9 * travel, boostY: -0.12 + 0.8 * travel,
    rotation: -0.26 + 0.67 * travel, pencilCount: spread ? 2 * N + 1 : 1 };
}

export function direction(k, spread = SPREAD_FRAMES) {
  if (!Number.isInteger(k) || Math.abs(k) > N || !Number.isInteger(spread) || spread < 0 || spread > SPREAD_FRAMES)
    throw new RangeError("Invalid pencil member");
  return [3 * k * spread, 4 * N * SPREAD_FRAMES];
}

// For g: x=3/5, the homogeneous Euclidean meeting point is (3dx,3dy,5dx).
// Its relation to the open disk is decided in integers, including ideal endpoints.
export function crossingClass([dx, dy]) {
  if (!Number.isSafeInteger(dx) || !Number.isSafeInteger(dy) || (!dx && !dy)) throw new RangeError("Integer direction required");
  if (!dx) return "euclidean-parallel";
  const x = BigInt(dx), y = BigInt(dy), margin = 9n * y * y - 16n * x * x;
  return margin > 0n ? "outside" : margin === 0n ? "ideal" : "inside";
}

export function endpoints(vector) {
  const length = Math.hypot(...vector), q = vector.map((v) => v / length);
  return [q.map((v) => -v), q];
}

// Lorentz boosts act projectively on the Klein disk; their unit circle is fixed as a set.
export function transform([x, y], state) {
  const cx = Math.cosh(state.boostX), sx = Math.sinh(state.boostX);
  const cy = Math.cosh(state.boostY), sy = Math.sinh(state.boostY);
  const t1 = cx + sx * x, x1 = sx + cx * x;
  const t2 = cy * t1 + sy * y, y2 = sy * t1 + cy * y;
  const c = Math.cos(state.rotation), s = Math.sin(state.rotation);
  return [(c * x1 - s * y2) / t2, (s * x1 + c * y2) / t2];
}

// The intermediate radial maps are bijections, not different curvatures.
export function project([x, y], mix) {
  const norm2 = x * x + y * y;
  const factor = (1 - mix) + mix / (1 + Math.sqrt(Math.max(0, 1 - norm2)));
  return [x * factor, y * factor];
}
export function pointAt(pair, u, state) {
  const q = pair[0].map((v, axis) => v * (1 - u) + pair[1][axis] * u);
  return project(transform(q, state), state.projectionMix);
}
export function screen(q) { return [CENTRE[0] + RADIUS * q[0], CENTRE[1] - RADIUS * q[1]]; }
export function linePoints(pair, state, count = SAMPLES) {
  // Cosine sampling resolves the radial map's steep derivative near the ideal rim.
  return Array.from({ length: count + 1 }, (_, i) => pointAt(pair, (1 - Math.cos(Math.PI * i / count)) / 2, state));
}

export function referenceNet() {
  const lines = [];
  for (let family = 0; family < 3; family++) {
    const angle = Math.PI * family / 3, c = Math.cos(angle), s = Math.sin(angle);
    for (let j = -22; j <= 22; j++) {
      const x = Math.tanh(j * 0.105), y = Math.sqrt(1 - x * x);
      lines.push({ family, index: j, ends: [[c*x+s*y, s*x-c*y], [c*x-s*y, s*x+c*y]] });
    }
  }
  return lines;
}

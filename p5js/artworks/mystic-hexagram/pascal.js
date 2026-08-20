/**
 * Pascal's six points, in the lettering and incidence of the 1640 Essay.
 *
 * The hexagon is K-P-Q-V-O-N. Its opposite side pairs meet at
 *
 *   M = KP ∩ VO,   T = PQ ∩ ON,   S = QV ∩ NK.
 *
 * Pascal wrote the result in Desargues's language: MS, NO and PQ are "de mesme
 * ordre", a pencil of concurrent or parallel lines. In the finite configurations drawn
 * here they concur at T. The modern statement follows immediately: M, T and S are
 * collinear, the three intersections of opposite sides of an inscribed hexagon.
 */

export const CONIC_RADIUS_X = 310;
export const CONIC_RADIUS_Y = 220;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;
export const VERTEX_LABELS = ["K", "P", "Q", "V", "O", "N"];
export const PARAMETER_SLOTS = [0, 2, 4, 1, 5, 3];
export const WOBBLE = 0.1;

const FULL_TURN = Math.PI * 2;
const LABEL_PHASE = Math.PI * (3 - Math.sqrt(5));

export function phaseAt(frameIndex) {
  const wrapped = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  return wrapped / TOTAL_FRAMES;
}

export function pointOnConic(angle) {
  return {
    x: CONIC_RADIUS_X * Math.cos(angle),
    y: CONIC_RADIUS_Y * Math.sin(angle)
  };
}

export function lineThrough(from, to) {
  const a = from.y - to.y;
  const b = to.x - from.x;
  const length = Math.hypot(a, b);
  if (length < 1e-12) {
    throw new Error("A line needs two distinct points");
  }
  return {
    a: a / length,
    b: b / length,
    c: (from.x * to.y - from.y * to.x) / length
  };
}

export function intersection(first, second) {
  const denominator = first.a * second.b - first.b * second.a;
  if (Math.abs(denominator) < 1e-9) {
    throw new Error("The construction reached a point at infinity");
  }
  return {
    x: (first.b * second.c - first.c * second.b) / denominator,
    y: (first.c * second.a - first.a * second.c) / denominator
  };
}

/** Signed perpendicular distance, since lineThrough normalizes its first two terms. */
export function incidence(line, point) {
  return line.a * point.x + line.b * point.y + line.c;
}

export function constructionAt(frameIndex) {
  const phase = phaseAt(frameIndex);
  const vertices = Object.fromEntries(VERTEX_LABELS.map((label, index) => {
    const base = -Math.PI / 2 + (PARAMETER_SLOTS[index] * FULL_TURN) / 6;
    const angle = base + FULL_TURN * phase
      + WOBBLE * Math.sin(2 * FULL_TURN * phase + index * LABEL_PHASE);
    return [label, { ...pointOnConic(angle), angle }];
  }));

  const sideNames = ["KP", "PQ", "QV", "VO", "ON", "NK"];
  const sides = Object.fromEntries(sideNames.map((name) => [
    name,
    lineThrough(vertices[name[0]], vertices[name[1]])
  ]));

  const M = intersection(sides.KP, sides.VO);
  const T = intersection(sides.PQ, sides.ON);
  const S = intersection(sides.QV, sides.NK);
  const pascalLine = lineThrough(M, S);

  return {
    frameIndex,
    vertices,
    sides,
    intersections: { M, T, S },
    pascalLine
  };
}

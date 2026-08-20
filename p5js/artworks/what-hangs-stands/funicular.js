/**
 * One uniformly loaded hanging chain and the masonry arch obtained by turning it over.
 *
 * Hooke's sentence is exact here rather than illustrative. The hanging polygon carries
 * one vertical load at each interior joint in tension. Reflecting every joint across the
 * support line and reversing tension into compression leaves every force balance zero.
 * The curve is a catenary sampled into voussoirs, so the discrete loads are the ones its
 * actual chord slopes require rather than decorative arrows of equal length.
 */

export const SPAN = 680;
export const HALF_SPAN = SPAN / 2;
export const CATENARY_PARAMETER = 360;
export const NODE_COUNT = 31;
export const HORIZONTAL_THRUST = 1;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Down is positive, matching canvas coordinates; the supports therefore have zero sag. */
export function sagAt(x) {
  return CATENARY_PARAMETER * (
    Math.cosh(HALF_SPAN / CATENARY_PARAMETER) - Math.cosh(x / CATENARY_PARAMETER)
  );
}

export function hangingNodes() {
  return Array.from({ length: NODE_COUNT }, (unused, index) => {
    const x = -HALF_SPAN + (SPAN * index) / (NODE_COUNT - 1);
    return { x, y: sagAt(x) };
  });
}

export function reflectedNodes(nodes = hangingNodes()) {
  return nodes.map(({ x, y }) => ({ x, y: -y }));
}

export function segmentSlopes(nodes) {
  return nodes.slice(0, -1).map((from, index) => {
    const to = nodes[index + 1];
    return (to.y - from.y) / (to.x - from.x);
  });
}

/**
 * The downward point load required at each interior hanging joint.
 *
 * With horizontal tension H, the two adjacent tension forces add to
 * H(slopeRight - slopeLeft) vertically. The catenary is concave upward in mathematical
 * coordinates and downward here, so this sum is upward and the balancing load is positive.
 */
export function jointLoads(nodes = hangingNodes(), thrust = HORIZONTAL_THRUST) {
  const slopes = segmentSlopes(nodes);
  return slopes.slice(0, -1).map((leftSlope, index) => ({
    index: index + 1,
    load: thrust * (leftSlope - slopes[index + 1])
  }));
}

/** The full force residual at a joint of the hanging, tension-only polygon. */
export function hangingResidual(nodes, index, load, thrust = HORIZONTAL_THRUST) {
  const leftSlope = (nodes[index].y - nodes[index - 1].y)
    / (nodes[index].x - nodes[index - 1].x);
  const rightSlope = (nodes[index + 1].y - nodes[index].y)
    / (nodes[index + 1].x - nodes[index].x);
  return {
    x: -thrust + thrust,
    y: -thrust * leftSlope + thrust * rightSlope + load
  };
}

/** The full force residual at the corresponding joint of the compression-only arch. */
export function archResidual(nodes, index, load, thrust = HORIZONTAL_THRUST) {
  const leftSlope = (nodes[index].y - nodes[index - 1].y)
    / (nodes[index].x - nodes[index - 1].x);
  const rightSlope = (nodes[index + 1].y - nodes[index].y)
    / (nodes[index + 1].x - nodes[index].x);
  return {
    x: thrust - thrust,
    y: thrust * leftSlope - thrust * rightSlope + load
  };
}

function smootherStep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/**
 * How far the reflection has crossed the span. The chain is held, turns into its reflected
 * arch from left to right, is held again, then returns right to left before the loop closes.
 */
export function reflectionProgressAt(frameIndex) {
  const wrapped = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const phase = wrapped / TOTAL_FRAMES;
  if (phase < 0.15) {
    return 0;
  }
  if (phase < 0.45) {
    return smootherStep((phase - 0.15) / 0.3);
  }
  if (phase < 0.65) {
    return 1;
  }
  if (phase < 0.95) {
    return 1 - smootherStep((phase - 0.65) / 0.3);
  }
  return 0;
}

/** Local share of arch at one horizontal position, softened around the moving frontier. */
export function archShareAt(x, frameIndex, feather = 0.07) {
  const along = (x + HALF_SPAN) / SPAN;
  const progress = reflectionProgressAt(frameIndex);
  const frontier = -feather + (1 + 2 * feather) * progress;
  const t = Math.max(0, Math.min(1, (along - (frontier - feather)) / (2 * feather)));
  return 1 - t * t * (3 - 2 * t);
}

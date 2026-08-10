export const PATH_COUNT = 2;
export const TRIANGLES_PER_PATH = 3;
export const TRIANGLE_COUNT = PATH_COUNT * TRIANGLES_PER_PATH;
/** Processing's default frame rate, which is the rate the original's step was tuned to. */
export const STEPS_PER_SECOND = 60;
/**
 * The original advanced its angle by 0.05 radians per frame, so a turn took 125.66 steps
 * and never closed exactly. Rounding to a whole 126 steps makes the clip loop seamlessly
 * and changes the speed by a third of a per cent.
 */
export const STEPS_PER_CYCLE = 126;

const FULL_TURN = Math.PI * 2;
const CORNER_STEP = FULL_TURN / TRIANGLES_PER_PATH;
/** The second path is a sixth of a turn round, which is what interleaves the two. */
export const PATH_ROTATION = Math.PI / 3;

/**
 * The corner circle of each triangular path, as a fraction of the hexagon radius.
 *
 * The Processing sketch wrote `(1 + 1/2) * hexagonRadius * sin(PI/3)`. In Java that `1/2`
 * is integer division, so the factor is 1 rather than the 1.5 the expression suggests. The
 * value it actually produced is what makes the figure fit its canvas — at 1.5 the triangles
 * would reach a third of the way past the edge — so the port keeps the effective radius and
 * drops the misleading expression.
 */
export const PATH_RADIUS_RATIO = Math.sin(Math.PI / 3);

/** Each triangle's own size, as a fraction of the path radius. */
export const TRIANGLE_RADIUS_RATIO = Math.cos(Math.PI / 3);

function corner(pathIndex, cornerIndex, pathRadius) {
  const angle = pathIndex * PATH_ROTATION + cornerIndex * CORNER_STEP;
  return { x: pathRadius * Math.cos(angle), y: pathRadius * Math.sin(angle) };
}

/**
 * Where the six triangles sit at a given step, and how far each is turned.
 *
 * Every triangle walks one edge of its path over a whole cycle. At the end of the cycle a
 * triangle stands on the corner its neighbour started from, so the six of them occupy the
 * same six places they began in and the motion closes without a jump.
 */
export function trianglesAt(step, pathRadius) {
  const progress = (((step % STEPS_PER_CYCLE) + STEPS_PER_CYCLE) % STEPS_PER_CYCLE)
    / STEPS_PER_CYCLE;
  const placed = [];
  for (let pathIndex = 0; pathIndex < PATH_COUNT; pathIndex += 1) {
    for (let cornerIndex = 0; cornerIndex < TRIANGLES_PER_PATH; cornerIndex += 1) {
      const from = corner(pathIndex, cornerIndex, pathRadius);
      const to = corner(pathIndex, cornerIndex + 1, pathRadius);
      placed.push({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        // The original rotated the whole coordinate system for the second path, so its
        // triangles point the other way. That opposition is what makes the hexagram.
        rotation: pathIndex * PATH_ROTATION
      });
    }
  }
  return placed;
}

/** The triangle itself: three vertices on a circle, before the path rotation is applied. */
export function triangleShape(triangleRadius, rotation) {
  return Array.from({ length: TRIANGLES_PER_PATH }, (unused, index) => {
    const angle = rotation + index * CORNER_STEP;
    return { x: triangleRadius * Math.cos(angle), y: triangleRadius * Math.sin(angle) };
  });
}

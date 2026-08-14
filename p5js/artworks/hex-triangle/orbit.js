export const PATH_COUNT = 2;
export const TRIANGLES_PER_PATH = 3;
export const TRIANGLE_COUNT = PATH_COUNT * TRIANGLES_PER_PATH;
/** Processing's default frame rate, which is the rate the original's step was tuned to. */
export const STEPS_PER_SECOND = 60;
/**
 * The original advanced its angle by 0.05 radians per frame, so a walk took 125.66 steps
 * and never closed exactly. A whole 120 makes the clip loop seamlessly and lets five
 * walks fill exactly ten seconds, at a twentieth more speed than the original ran.
 */
export const STEPS_PER_CYCLE = 120;
/** Five gatherings and five partings, which is the clip. */
export const CYCLES = 5;
export const TOTAL_STEPS = CYCLES * STEPS_PER_CYCLE;

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

/**
 * The three corners a path is walked around. Nothing draws them -- the sketch once
 * stroked both paths faintly under the triangles and no longer does -- but they are what
 * the walk is built out of, and the tests measure the path against them.
 */
export function pathCorners(pathIndex, pathRadius) {
  return Array.from({ length: TRIANGLES_PER_PATH }, (unused, cornerIndex) =>
    corner(pathIndex, cornerIndex, pathRadius));
}

/**
 * How far the six stand from the centre at a given step, in units of the path radius.
 * Walking an edge of an equilateral path carries a triangle from a corner, at the full
 * radius, to the edge's midpoint, at exactly half of it — the inradius of an
 * equilateral triangle being half its circumradius — and back out to the next corner.
 * All six share this distance at every step, because both paths are the same triangle
 * and all six walk in step, so it is a property of the moment rather than of a triangle.
 *
 * The drawing once read this, through a normalised `gatheringAt` that mapped the corners
 * to nought and the meeting to one, and keyed the triangles' shade to it. There is one ink
 * now, so the ramp went with the shade it existed for. The measurement stays: it is the
 * walk's own property, and the tests hold the closing and the opening against it.
 */
export function radiusAt(step) {
  const progress = (((step % STEPS_PER_CYCLE) + STEPS_PER_CYCLE) % STEPS_PER_CYCLE)
    / STEPS_PER_CYCLE;
  // The point on a chord nearest the centre is its midpoint, so the distance is the
  // straight interpolation of the two corners, measured.
  const corners = pathCorners(0, 1);
  const from = corners[0];
  const to = corners[1];
  return Math.hypot(
    from.x + (to.x - from.x) * progress,
    from.y + (to.y - from.y) * progress
  );
}

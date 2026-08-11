/**
 * The plastic ratio, the real root of x^3 = x + 1. It is to this construction what the
 * golden ratio is to the Fibonacci spiral: rho^3 = rho + 1 is exactly what lets a square
 * and two smaller rectangles of the same proportion tile their parent without a remainder.
 */
export const PLASTIC_RATIO =
  Math.cbrt((9 + Math.sqrt(69)) / 18) + Math.cbrt((9 - Math.sqrt(69)) / 18);

const QUARTER_TURN = Math.PI / 4;
const ROOT_TWO = Math.sqrt(2);

function along(start, axis, distance) {
  return { x: start.x + axis.x * distance, y: start.y + axis.y * distance };
}

function alongBoth(start, firstAxis, firstDistance, secondAxis, secondDistance) {
  return {
    x: start.x + firstAxis.x * firstDistance + secondAxis.x * secondDistance,
    y: start.y + firstAxis.y * firstDistance + secondAxis.y * secondDistance
  };
}

function negate(vector) {
  return { x: -vector.x, y: -vector.y };
}

function distance(start, end) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

/**
 * The largest exact plastic rectangle that fits inside the margins, centred on the canvas.
 * The canvas is only a display frame; the proportion belongs to the construction.
 */
export function rootRectangle(width, height, margin) {
  const availableLongSide = width - 2 * margin;
  const availableShortSide = height - 2 * margin;
  const shortSide = Math.min(availableShortSide, availableLongSide / PLASTIC_RATIO);
  const longSide = shortSide * PLASTIC_RATIO;
  return {
    origin: { x: (width - longSide) / 2, y: (height - shortSide) / 2 },
    longAxis: { x: 1, y: 0 },
    shortAxis: { x: 0, y: 1 },
    longSide,
    shortSide
  };
}

function largeBranchArc(squareOrigin, longAxis, shortAxis, squareSide) {
  return {
    center: alongBoth(squareOrigin, longAxis, -squareSide / 2, shortAxis, squareSide / 2),
    xAxis: longAxis,
    yAxis: shortAxis,
    radius: squareSide / ROOT_TWO,
    startAngle: -QUARTER_TURN,
    endAngle: QUARTER_TURN
  };
}

function smallBranchArc(junction, branchEnd, longAxis, shortAxis) {
  const chord = distance(junction, branchEnd);
  return {
    center: alongBoth(junction, longAxis, chord / 2, shortAxis, chord / 2),
    xAxis: longAxis,
    yAxis: shortAxis,
    radius: chord / ROOT_TWO,
    startAngle: -3 * QUARTER_TURN,
    endAngle: -QUARTER_TURN
  };
}

/**
 * Subdivides a rectangle and recurses into both children, returning one cell per
 * subdivision in the order the original produced them.
 *
 * Construction is recursive because the figure is self-similar; the drawing walks the
 * finished list iteratively.
 */
export function buildCells(rectangle, minimumSquareSide) {
  const cells = [];
  const largeChildShortSide = rectangle.shortSide / PLASTIC_RATIO;
  const squareSide = rectangle.shortSide / (PLASTIC_RATIO * PLASTIC_RATIO);
  const smallChildShortSide = squareSide / PLASTIC_RATIO;
  if (squareSide < minimumSquareSide) {
    return cells;
  }

  const squareOrigin = along(rectangle.origin, rectangle.longAxis, largeChildShortSide);
  const junction = along(squareOrigin, rectangle.shortAxis, squareSide);
  const smallChildSquareOrigin = along(
    junction,
    rectangle.longAxis,
    smallChildShortSide / PLASTIC_RATIO
  );

  cells.push({
    rectangle,
    squareOrigin,
    junction,
    squareSide,
    largeBranchArc: largeBranchArc(
      squareOrigin,
      rectangle.longAxis,
      rectangle.shortAxis,
      squareSide
    ),
    smallBranchArc: smallBranchArc(
      junction,
      smallChildSquareOrigin,
      rectangle.longAxis,
      rectangle.shortAxis
    )
  });

  // The large child turns a quarter into the parent's short-side direction.
  cells.push(...buildCells({
    origin: squareOrigin,
    longAxis: rectangle.shortAxis,
    shortAxis: negate(rectangle.longAxis),
    longSide: rectangle.shortSide,
    shortSide: largeChildShortSide
  }, minimumSquareSide));
  // The small child keeps the parent's orientation, below the new square.
  cells.push(...buildCells({
    origin: junction,
    longAxis: rectangle.longAxis,
    shortAxis: rectangle.shortAxis,
    longSide: squareSide,
    shortSide: smallChildShortSide
  }, minimumSquareSide));
  return cells;
}

/** The four corners of a rectangle, in drawing order. */
export function rectangleCorners(rectangle) {
  const longCorner = along(rectangle.origin, rectangle.longAxis, rectangle.longSide);
  return [
    rectangle.origin,
    longCorner,
    along(longCorner, rectangle.shortAxis, rectangle.shortSide),
    along(rectangle.origin, rectangle.shortAxis, rectangle.shortSide)
  ];
}

/** The two cuts a subdivision makes inside its parent. */
export function partitionLines(cell) {
  return [
    [cell.squareOrigin, along(cell.squareOrigin, cell.rectangle.shortAxis, cell.rectangle.shortSide)],
    [cell.junction, along(cell.junction, cell.rectangle.longAxis, cell.squareSide)]
  ];
}

/**
 * An arc as a polyline. The segment count follows the arc's own length so long arcs are no
 * coarser than short ones, with a floor of four so the smallest ones still curve.
 */
export function arcPoints(arc, vertexSpacing) {
  const sweep = Math.abs(arc.endAngle - arc.startAngle);
  const segmentCount = Math.max(4, Math.ceil(arc.radius * sweep / vertexSpacing));
  return Array.from({ length: segmentCount + 1 }, (unused, index) => {
    const angle = arc.startAngle + (arc.endAngle - arc.startAngle) * (index / segmentCount);
    return alongBoth(
      arc.center,
      arc.xAxis,
      arc.radius * Math.cos(angle),
      arc.yAxis,
      arc.radius * Math.sin(angle)
    );
  });
}

/**
 * Which generation of the cascade a cell belongs to, read off its own size: the large
 * branch shrinks a rectangle by one power of the plastic ratio and the small branch by
 * three, so every cell's short side is the root's divided by an exact integer power.
 * That the measured logarithm lands on an integer is a theorem of the construction,
 * and the tests hold it to nine decimal places.
 */
export function generationOf(root, cell) {
  const exact = Math.log(root.shortSide / cell.rectangle.shortSide) / Math.log(PLASTIC_RATIO);
  return Math.round(exact);
}

/**
 * The cascade's schedule: one wave per generation, each wave taking a settled share
 * less time than the one before, whole frames dealt by largest remainder so the build
 * lands exactly on its budget.
 */
export const WAVE_RATIO = 0.82;
export const BUILD_FRAMES = 252;
export const HOLD_FRAMES = 48;
export const TOTAL_FRAMES = BUILD_FRAMES + HOLD_FRAMES;

export function wavePlan(generationCount) {
  const weights = Array.from({ length: generationCount }, (unused, index) =>
    WAVE_RATIO ** index);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight / total) * BUILD_FRAMES);
  const floored = exact.map(Math.floor);
  let leftover = BUILD_FRAMES - floored.reduce((sum, frames) => sum + frames, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (leftover === 0) {
      break;
    }
    floored[index] += 1;
    leftover -= 1;
  }
  let cursor = 0;
  return floored.map((frames, generation) => {
    const wave = { generation, start: cursor, frames };
    cursor += frames;
    return wave;
  });
}

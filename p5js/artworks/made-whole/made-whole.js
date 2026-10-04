/**
 * Al-Khwarizmi's second geometric completion of x² + 10x = 39.
 *
 * Lengths are held in half-units. The four equal quarters of the ten roots are therefore
 * five half-units wide — 5/2 in ordinary units — and pairing two quarters gives each of
 * the two rectangles in the second proof its width of five. Nothing in the layout needs a
 * rounded coordinate: the completed square, every region in it, and every unit-grid line
 * are all made from these integers before the drawing turns them into pixels.
 */

export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** The two quantities stated by the problem. Everything else below is derived from them. */
export const ROOT_COEFFICIENT = 10;
export const GIVEN_AREA = 39;

export const HALF_UNITS_PER_UNIT = 2;
export const WING_COUNT = 4;
export const PROOF_SIDE_COUNT = 2;

function greatestCommonDivisor(first, second) {
  let left = Math.abs(first);
  let right = Math.abs(second);
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

/** A reduced rational, used where the first proof divides ten roots into four wings. */
export function reducedRational(numerator, denominator) {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
    throw new TypeError("A rational needs two whole numbers and a non-zero denominator");
  }
  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator) / divisor
  };
}

/** One of four 10/4 wings: 5/2, kept as the integer five in half-units. */
export const WING_WIDTH = Object.freeze(reducedRational(ROOT_COEFFICIENT, WING_COUNT));
export const WING_WIDTH_TWICE = WING_WIDTH.numerator
  * (HALF_UNITS_PER_UNIT / WING_WIDTH.denominator);

/** The second proof pairs the four wings, giving two strips whose width is five. */
export const WINGS_PER_SIDE = WING_COUNT / PROOF_SIDE_COUNT;
export const SIDE_WIDTH_TWICE = WING_WIDTH_TWICE * WINGS_PER_SIDE;

/** Area in quarter-units, the product of two lengths stored in half-units. */
export function areaInQuarterUnits(widthTwice, heightTwice) {
  if (!Number.isInteger(widthTwice) || !Number.isInteger(heightTwice)) {
    throw new TypeError("Area lengths must be whole half-units");
  }
  return widthTwice * heightTwice;
}

/** The stated equation, multiplied by four so a half-unit candidate stays exact. */
export function equationInQuarterUnits(
  rootTwice,
  coefficient = ROOT_COEFFICIENT
) {
  return rootTwice * rootTwice + HALF_UNITS_PER_UNIT * coefficient * rootTwice;
}

/**
 * Exhaust every positive half-unit that could solve x² + bx = a. Since both terms are
 * positive, x cannot exceed a; twice a therefore bounds the integer half-unit scan.
 */
export function positiveHalfUnitSolutions(
  coefficient = ROOT_COEFFICIENT,
  area = GIVEN_AREA
) {
  if (!Number.isInteger(coefficient) || coefficient <= 0 || !Number.isInteger(area) || area <= 0) {
    throw new RangeError("The coefficient and area must be positive whole numbers");
  }
  const target = HALF_UNITS_PER_UNIT ** 2 * area;
  const maximumTwice = HALF_UNITS_PER_UNIT * area;
  const solutions = [];
  for (let rootTwice = 1; rootTwice <= maximumTwice; rootTwice += 1) {
    if (equationInQuarterUnits(rootTwice, coefficient) === target) {
      solutions.push(rootTwice);
    }
  }
  return solutions;
}

const ROOT_SOLUTIONS_TWICE = positiveHalfUnitSolutions();
if (ROOT_SOLUTIONS_TWICE.length !== 1) {
  throw new Error("The stated equation must have exactly one positive half-unit solution");
}

export const UNKNOWN_SIDE_TWICE = ROOT_SOLUTIONS_TWICE[0];
export const UNKNOWN_SIDE = UNKNOWN_SIDE_TWICE / HALF_UNITS_PER_UNIT;

/** The missing corner has the side added to each of the original square's two sides. */
export const ADDED_AREA_QUARTERS = areaInQuarterUnits(SIDE_WIDTH_TWICE, SIDE_WIDTH_TWICE);
export const ADDED_AREA = ADDED_AREA_QUARTERS / (HALF_UNITS_PER_UNIT ** 2);
export const COMPLETED_AREA_QUARTERS = GIVEN_AREA * (HALF_UNITS_PER_UNIT ** 2)
  + ADDED_AREA_QUARTERS;
export const COMPLETED_AREA = COMPLETED_AREA_QUARTERS / (HALF_UNITS_PER_UNIT ** 2);

function exactIntegerSquareRoot(value) {
  const root = Math.sqrt(value);
  if (!Number.isInteger(root)) {
    throw new Error(`${value} is not a square`);
  }
  return root;
}

export const COMPLETED_SIDE_TWICE = exactIntegerSquareRoot(COMPLETED_AREA_QUARTERS);
export const COMPLETED_SIDE = COMPLETED_SIDE_TWICE / HALF_UNITS_PER_UNIT;

/**
 * The four rectangles of the completed figure, in half-units. The first three are the
 * problem's thirty-nine; the last is the twenty-five that completes the square.
 */
export const REGIONS = Object.freeze([
  Object.freeze({ id: "unknown", role: "unknown", x: 0, y: 0,
    width: UNKNOWN_SIDE_TWICE, height: UNKNOWN_SIDE_TWICE }),
  Object.freeze({ id: "root-horizontal", role: "root", x: UNKNOWN_SIDE_TWICE, y: 0,
    width: SIDE_WIDTH_TWICE, height: UNKNOWN_SIDE_TWICE }),
  Object.freeze({ id: "root-vertical", role: "root", x: 0, y: UNKNOWN_SIDE_TWICE,
    width: UNKNOWN_SIDE_TWICE, height: SIDE_WIDTH_TWICE }),
  Object.freeze({ id: "completion", role: "completion",
    x: UNKNOWN_SIDE_TWICE, y: UNKNOWN_SIDE_TWICE,
    width: SIDE_WIDTH_TWICE, height: SIDE_WIDTH_TWICE })
]);

export function regionArea(region) {
  return areaInQuarterUnits(region.width, region.height)
    / (HALF_UNITS_PER_UNIT ** 2);
}

/** Canvas and grid measurements, all derived from the completed side. */
export const LOGICAL_SIZE = 680;
export const UNIT_ON_PAGE = 60;
export const HALF_UNIT_ON_PAGE = UNIT_ON_PAGE / HALF_UNITS_PER_UNIT;
export const COMPLETED_SIDE_ON_PAGE = COMPLETED_SIDE * UNIT_ON_PAGE;
export const PAGE_MARGIN = (LOGICAL_SIZE - COMPLETED_SIDE_ON_PAGE) / 2;

export function regionOnPage(region) {
  return {
    x: PAGE_MARGIN + region.x * HALF_UNIT_ON_PAGE,
    y: PAGE_MARGIN + region.y * HALF_UNIT_ON_PAGE,
    width: region.width * HALF_UNIT_ON_PAGE,
    height: region.height * HALF_UNIT_ON_PAGE
  };
}

/**
 * The count, tile by tile. The figure is laid one unit square at a time, so the areas the
 * proof adds are counted out as they are made: the nine of the unknown square, the thirty
 * of the two roots, then a beat on the empty corner, then the corner's twenty-five in
 * diagonal waves from the field outwards, then the side of the whole counted along its
 * top, eight, and the five of the corner's side falling away to leave the three.
 */
export const ACTS = Object.freeze(["unknown", "roots", "completion", "count"]);
export const ACT_FRAMES = Object.freeze([44, 96, 46, 114]);
export const ACT_STARTS = Object.freeze(ACT_FRAMES.map((unused, index) => (
  ACT_FRAMES.slice(0, index).reduce((total, frames) => total + frames, 0)
)));

/** Unit tiles in the unknown square, in the two roots together, and diagonal waves in the corner. */
export const UNKNOWN_TILES = UNKNOWN_SIDE * UNKNOWN_SIDE;
export const ROOT_TILES = PROOF_SIDE_COUNT * UNKNOWN_SIDE * (SIDE_WIDTH_TWICE / HALF_UNITS_PER_UNIT);
export const CORNER_WAVES = 2 * (SIDE_WIDTH_TWICE / HALF_UNITS_PER_UNIT) - 1;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/** Smootherstep: the first and second derivatives vanish at both ends. */
export function eased(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function span(frame, from, to) {
  return eased((frame - from) / (to - from));
}

export function actAt(frameIndex) {
  const wrapped = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  let start = 0;
  for (let index = 0; index < ACT_FRAMES.length; index += 1) {
    start += ACT_FRAMES[index];
    if (wrapped < start) {
      return index;
    }
  }
  return ACT_FRAMES.length - 1;
}

/**
 * The count at one exact frame. The tile counts run continuously, so a tile is part-laid
 * between whole numbers; `gap` is the dashed outline of the empty corner, shown while the
 * thirty-nine wait for it; `sideCount` is how many of the eight marks along the top are
 * drawn and `fallAway` how far the five of the corner's side have gone.
 */
export function sceneAt(frameIndex) {
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const act = actAt(frame);
  return {
    frameIndex: frame,
    act,
    actName: ACTS[act],
    unknownTiles: clamp01((frame - 4) / 36) * UNKNOWN_TILES,
    rootTiles: clamp01((frame - 44) / 60) * ROOT_TILES,
    cornerWave: clamp01((frame - 140) / 36) * CORNER_WAVES,
    gap: span(frame, 108, 124) * (1 - span(frame, 140, 150)),
    count: span(frame, 186, 206),
    sideCount: clamp01((frame - 206) / 32) * COMPLETED_SIDE,
    fallAway: span(frame, 244, 262)
  };
}

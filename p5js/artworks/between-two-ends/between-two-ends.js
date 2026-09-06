/**
 * Two uniform circular motions, one straight oscillation.
 *
 * The carrier turns once. Relative to that carrier the small circle turns twice
 * in the opposite direction; in the fixed frame its material radius turns once
 * backwards. Confusing those two frames of reference destroys the diameter.
 */
export const LOGICAL_SIZE = 680;
export const LARGE_RADIUS = 240;
export const RADIUS_RATIO = 2;
export const LOCAL_TURNS = -2;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

function integerFrame(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  return frameIndex;
}

function multiply([ax, ay], [bx, by]) {
  return [ax * bx - ay * by, ax * by + ay * bx];
}

function power(unit, turns) {
  const step = [unit[0], turns < 0 ? -unit[1] : unit[1]];
  let value = [1, 0];
  for (let index = 0; index < Math.abs(turns); index += 1) {
    value = multiply(value, step);
  }
  return value;
}

/** Exact cardinal phases avoid the floating-point sine of pi at the endpoints. */
export function unitAtFrame(frameIndex) {
  const frame = ((integerFrame(frameIndex) % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  if (frame % (TOTAL_FRAMES / 4) === 0) {
    return [[1, 0], [0, 1], [-1, 0], [0, -1]][frame / (TOTAL_FRAMES / 4)];
  }
  const angle = 2 * Math.PI * frame / TOTAL_FRAMES;
  return [Math.cos(angle), Math.sin(angle)];
}

/**
 * Compose the center's motion with the material radius in the fixed frame.
 * The point is calculated in two dimensions, never projected onto the diameter.
 * Optional conditions are for the mathematical controls, not viewer settings.
 */
export function mechanismAtUnit(unit, {
  radiusRatio = RADIUS_RATIO,
  localTurns = LOCAL_TURNS
} = {}) {
  if (!(radiusRatio > 1) || !Number.isInteger(localTurns)) {
    throw new RangeError("Use a radius ratio greater than one and integer relative turns.");
  }
  const smallRadius = LARGE_RADIUS / radiusRatio;
  const centerRadius = LARGE_RADIUS - smallRadius;
  const smallCenter = unit.map((coordinate) => centerRadius * coordinate);
  const materialRadius = power(unit, 1 + localTurns);
  const materialPoint = smallCenter.map((coordinate, axis) => (
    coordinate + smallRadius * materialRadius[axis]
  ));
  return {
    largeRadius: LARGE_RADIUS,
    smallRadius,
    smallCenter,
    materialPoint,
    tangentPoint: unit.map((coordinate) => LARGE_RADIUS * coordinate)
  };
}

/** Unwrapped turn counts retain the revolutions that a wrapped picture cannot. */
export function rotationCounts(frameIndex) {
  const carrier = integerFrame(frameIndex);
  return {
    carrier,
    local: LOCAL_TURNS * carrier,
    world: (1 + LOCAL_TURNS) * carrier,
    denominator: TOTAL_FRAMES
  };
}

export function sceneAt(frameIndex) {
  const frame = ((integerFrame(frameIndex) % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  return {
    frameIndex: frame,
    ...mechanismAtUnit(unitAtFrame(frame)),
    rotations: rotationCounts(frame)
  };
}

/**
 * Rational counterpart, deliberately composed in the carried frame first.
 * For a^2 + b^2 = d^2 it returns the exact two-dimensional point in units of
 * the small radius. BigInt keeps the cancellation test independent of pixels
 * and of floating-point tolerance. No output coordinate is forced to zero.
 */
export function exactPoint(a, b, d, {
  radiusRatio = BigInt(RADIUS_RATIO),
  localTurns = LOCAL_TURNS
} = {}) {
  if (![a, b, d, radiusRatio].every((value) => typeof value === "bigint")) {
    throw new TypeError("Rational coordinates and the radius ratio must be BigInts.");
  }
  if (d <= 0n || a * a + b * b !== d * d || radiusRatio <= 1n
    || !Number.isInteger(localTurns)) {
    throw new RangeError("Use a rational unit point, positive denominator, and valid turns.");
  }
  const step = [a, localTurns < 0 ? -b : b];
  let numerator = [1n, 0n];
  let denominator = 1n;
  for (let index = 0; index < Math.abs(localTurns); index += 1) {
    numerator = multiply(numerator, step);
    denominator *= d;
  }
  numerator[0] += (radiusRatio - 1n) * denominator;
  return {
    numerator: multiply([a, b], numerator),
    denominator: d * denominator
  };
}

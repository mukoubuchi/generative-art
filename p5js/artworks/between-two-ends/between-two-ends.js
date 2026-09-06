/**
 * Two uniform circular motions, one straight oscillation, and what happens
 * when the same construction is turned on its own premises.
 *
 * The first stage is the mechanism the quoted sentence describes. The carrier
 * turns once. Relative to that carrier the small circle turns twice in the
 * opposite direction; in the fixed frame its material radius turns once
 * backwards. Confusing those two frames of reference destroys the diameter.
 *
 * Everything past the first stage is this project's construction, not the
 * manuscript's: a second couple inside the small circle, whose points leave
 * astroids rather than a line; three points where the sentence speaks of one;
 * and four whole couples where the sentence gives the contact point and its
 * diameter a privileged direction.
 */
export const LOGICAL_SIZE = 680;
export const LARGE_RADIUS = 240;
export const RADIUS_RATIO = 2;
export const LOCAL_TURNS = -2;
/** The nested carrier runs at twice its parent's angle. One and three do not close into an astroid. */
export const NESTED_GEAR = 2;
export const COUPLE_COUNT = 4;
export const NESTED_POINT_COUNT = 3;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/**
 * The two lines the first-stage points actually run. Four couples a quarter
 * apart give four directions, and a diameter is the same line as the diameter
 * turned half round, so there are two. Drawing four would lay each down twice.
 */
export const DIAMETER_ANGLES = [0, Math.PI / 2];

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

/**
 * A quarter turn, done by exchanging and negating coordinates rather than by
 * a cosine of pi over two. The four couples stand a quarter apart, so this is
 * every turn the picture needs, and it keeps the exact phases exact: at the
 * quarter phases the four first-stage points are the same point turned, so
 * they meet at the centre exactly rather than to within a rounding.
 */
function quarterTurns([x, y], quarters) {
  // Negating a zero coordinate would leave a negative zero, which draws the
  // same but reads as a different number when the exact phases are compared.
  const negate = (value) => (value === 0 ? 0 : -value);
  const turns = ((quarters % 4) + 4) % 4;
  if (turns === 1) return [negate(y), x];
  if (turns === 2) return [negate(x), negate(y)];
  if (turns === 3) return [y, negate(x)];
  return [x, y];
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

/**
 * The couple set inside the small circle. Its own large circle is the small
 * one, so its radii are halved again; its carrier runs at `gear` times the
 * parent's angle, measured in the parent's frame, which the small circle's
 * material frame turns backwards by one.
 *
 * A point set at `alpha` on the nested circumference runs the nested frame's
 * diameter at alpha/2, exactly as the first stage does in the page. Seen from
 * the page, that same point runs an astroid turned by alpha/4.
 */
export function nestedAtUnit(unit, {
  gear = NESTED_GEAR,
  pointIndex = 0,
  pointCount = NESTED_POINT_COUNT
} = {}) {
  if (!Number.isInteger(gear) || !Number.isInteger(pointIndex) || !Number.isInteger(pointCount)
    || pointCount < 1 || pointIndex < 0 || pointIndex >= pointCount) {
    throw new RangeError("Use an integer gear and a point index inside the point count.");
  }
  const { smallCenter, smallRadius } = mechanismAtUnit(unit);
  const carried = power(unit, gear);
  const alpha = 2 * Math.PI * pointIndex / pointCount;
  const halfCosine = Math.cos(alpha / 2);
  const halfSine = Math.sin(alpha / 2);
  // The parent's frame is the small circle's material frame, which turns back
  // by one; its direction is the conjugate unit rather than an angle, so the
  // cardinal phases stay exact here as well as in the first stage.
  const [frameX, frameY] = [unit[0], -unit[1]];
  // cos(gear * theta - alpha / 2), read off the carried unit.
  const along = smallRadius * (carried[0] * halfCosine + carried[1] * halfSine);
  // The frame's diameter turned by alpha / 2, still without an angle.
  const direction = [
    frameX * halfCosine - frameY * halfSine,
    frameY * halfCosine + frameX * halfSine
  ];
  // exp(i * frameAngle) * carried, for the nested centre.
  const carriedInFrame = [
    frameX * carried[0] - frameY * carried[1],
    frameY * carried[0] + frameX * carried[1]
  ];
  return {
    nestedRadius: smallRadius / 2,
    nestedCenter: [
      smallCenter[0] + (smallRadius / 2) * carriedInFrame[0],
      smallCenter[1] + (smallRadius / 2) * carriedInFrame[1]
    ],
    materialPoint: [
      smallCenter[0] + along * direction[0],
      smallCenter[1] + along * direction[1]
    ],
    /** The page-frame turn that carries the base astroid onto this point's own. */
    turnedBy: alpha / 4
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

/**
 * The whole plate at one phase: four couples a quarter apart, each carrying
 * its nested couple and that couple's three points.
 */
export function sceneAt(frameIndex) {
  const frame = ((integerFrame(frameIndex) % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const unit = unitAtFrame(frame);
  const base = mechanismAtUnit(unit);
  const couples = [];
  for (let copy = 0; copy < COUPLE_COUNT; copy += 1) {
    const turn = 2 * Math.PI * copy / COUPLE_COUNT;
    // The copy index is the number of quarter turns; see quarterTurns.
    const nested = [];
    for (let pointIndex = 0; pointIndex < NESTED_POINT_COUNT; pointIndex += 1) {
      nested.push(nestedAtUnit(unit, { pointIndex }));
    }
    couples.push({
      turn,
      smallRadius: base.smallRadius,
      smallCenter: quarterTurns(base.smallCenter, copy),
      materialPoint: quarterTurns(base.materialPoint, copy),
      nestedRadius: nested[0].nestedRadius,
      nestedCenter: quarterTurns(nested[0].nestedCenter, copy),
      nestedPoints: nested.map((one) => quarterTurns(one.materialPoint, copy))
    });
  }
  return {
    frameIndex: frame,
    largeRadius: LARGE_RADIUS,
    couples,
    rotations: rotationCounts(frame)
  };
}

/**
 * The closed path one nested point runs over the whole revolution, sampled at
 * the displayed phases. The four couples run these same three curves at a
 * quarter's phase difference, because an astroid is unchanged by a quarter
 * turn; there are three curves in the picture, not twelve.
 */
export function nestedTrace(pointIndex) {
  const path = [];
  for (let frame = 0; frame <= TOTAL_FRAMES; frame += 1) {
    path.push(nestedAtUnit(unitAtFrame(frame), { pointIndex }).materialPoint);
  }
  return path;
}

/**
 * Rational counterpart of the first stage, deliberately composed in the
 * carried frame first. For a^2 + b^2 = d^2 it returns the exact
 * two-dimensional point in units of the small radius. BigInt keeps the
 * cancellation test independent of pixels and of floating-point tolerance.
 * No output coordinate is forced to zero.
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
    numerator = bigMultiply(numerator, step);
    denominator *= d;
  }
  numerator[0] += (radiusRatio - 1n) * denominator;
  return {
    numerator: bigMultiply([a, b], numerator),
    denominator: d * denominator
  };
}

function bigMultiply([ax, ay], [bx, by]) {
  return [ax * bx - ay * by, ax * by + ay * bx];
}

/*
 * Exact arithmetic for the nested stage.
 *
 * The three points sit a third of the nested circumference apart, so the half
 * angles are 0, 60 and 120 degrees and the turns that carry the base astroid
 * onto each point's own are 0, 30 and 60. Every cosine and sine involved is
 * either rational or a rational multiple of the square root of three, so the
 * whole second stage can be evaluated without a tolerance: a value is written
 * `(rational + root * sqrt 3) / denominator`. This is why the two turned
 * astroids are pinned exactly rather than to a bound.
 */
const SURD_HALF_ANGLES = [
  [[2n, 0n], [0n, 0n]],
  [[1n, 0n], [0n, 1n]],
  [[-1n, 0n], [0n, 1n]]
];
const SURD_QUARTER_ANGLES = [
  [[2n, 0n], [0n, 0n]],
  [[0n, 1n], [1n, 0n]],
  [[1n, 0n], [0n, 1n]]
];

function surdMultiply([leftRational, leftRoot], [rightRational, rightRoot]) {
  return [
    leftRational * rightRational + 3n * leftRoot * rightRoot,
    leftRational * rightRoot + leftRoot * rightRational
  ];
}

function surdAdd([leftRational, leftRoot], [rightRational, rightRoot]) {
  return [leftRational + rightRational, leftRoot + rightRoot];
}

function surdSubtract([leftRational, leftRoot], [rightRational, rightRoot]) {
  return [leftRational - rightRational, leftRoot - rightRoot];
}

function surdIsZero([rational, root]) {
  return rational === 0n && root === 0n;
}

/**
 * The nested point at a rational phase, exactly. Composed the way the drawing
 * composes it: the carried cosine times the material direction, added to the
 * first stage's centre. Returns `(rational + root * sqrt 3) / denominator`
 * for each coordinate, over one shared denominator.
 */
export function exactNestedPoint(a, b, d, { pointIndex = 0, gear = NESTED_GEAR } = {}) {
  if (![a, b, d].every((value) => typeof value === "bigint")) {
    throw new TypeError("Rational coordinates must be BigInts.");
  }
  if (d <= 0n || a * a + b * b !== d * d) {
    throw new RangeError("Use a rational unit point and a positive denominator.");
  }
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= SURD_HALF_ANGLES.length) {
    throw new RangeError("The point index must name one of the three nested points.");
  }
  const [halfCosine, halfSine] = SURD_HALF_ANGLES[pointIndex];
  // The carrier raised to the gear, as an exact rational pair over d ** gear.
  let carried = [1n, 0n];
  let carriedDenominator = 1n;
  for (let index = 0; index < gear; index += 1) {
    carried = bigMultiply(carried, [a, b]);
    carriedDenominator *= d;
  }
  // cos(gear * theta - alpha / 2), over 2 * carriedDenominator.
  const along = surdAdd(
    surdMultiply([carried[0], 0n], halfCosine),
    surdMultiply([carried[1], 0n], halfSine)
  );
  // exp(i * (alpha / 2 - theta)) = (halfCosine + i halfSine)(a - i b) / d, over 2 d.
  const directionReal = surdAdd(surdMultiply(halfCosine, [a, 0n]), surdMultiply(halfSine, [b, 0n]));
  const directionImaginary = surdSubtract(
    surdMultiply(halfSine, [a, 0n]),
    surdMultiply(halfCosine, [b, 0n])
  );
  const smallRadius = BigInt(LARGE_RADIUS / RADIUS_RATIO);
  const scale = 4n * carriedDenominator * d;
  const centerScale = scale / d;
  return {
    x: surdAdd(
      [smallRadius * a * centerScale, 0n],
      surdMultiply([smallRadius, 0n], surdMultiply(along, directionReal))
    ),
    y: surdAdd(
      [smallRadius * b * centerScale, 0n],
      surdMultiply([smallRadius, 0n], surdMultiply(along, directionImaginary))
    ),
    denominator: scale
  };
}

/**
 * Turn the exact nested point back by its own quarter angle and put it into
 * the implicit astroid equation. A point of the base astroid of radius R
 * satisfies `(x^2 + y^2 - R^2)^3 + 27 R^2 x^2 y^2 = 0`, so a residue of
 * exactly zero says the turned curve is the base astroid turned, with nothing
 * rounded on the way.
 */
export function astroidResidue(point, pointIndex) {
  const [quarterCosine, quarterSine] = SURD_QUARTER_ANGLES[pointIndex];
  const turnedX = surdAdd(
    surdMultiply(point.x, quarterCosine),
    surdMultiply(point.y, quarterSine)
  );
  const turnedY = surdSubtract(
    surdMultiply(point.y, quarterCosine),
    surdMultiply(point.x, quarterSine)
  );
  const denominator = point.denominator * 2n;
  const radius = BigInt(LARGE_RADIUS) * denominator;
  const squares = surdAdd(surdMultiply(turnedX, turnedX), surdMultiply(turnedY, turnedY));
  const offset = surdSubtract(squares, [radius * radius, 0n]);
  const cube = surdMultiply(surdMultiply(offset, offset), offset);
  const product = surdMultiply(
    [27n * radius * radius, 0n],
    surdMultiply(surdMultiply(turnedX, turnedX), surdMultiply(turnedY, turnedY))
  );
  return surdAdd(cube, product);
}

export function isExactlyZero(residue) {
  return surdIsZero(residue);
}

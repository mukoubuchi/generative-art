/**
 * One tower that is round from far away and square from close to.
 *
 * Two pinhole eyes stand on one horizontal line, at the same height, one far from the
 * tower and one near it. Each floor of the tower is a closed curve in space built so that
 * the far eye sees it exactly where it would see a circle, and the near eye sees it
 * exactly where it would see a square. Both eyes lie on the line `x = 0, z = h`, and the
 * circle and the square are drawn at one height, so a point of the curve answers to the
 * circle point and the square point that share its `x`: it is where the far eye's ray to
 * the one meets the near eye's ray to the other. Where the circle and the square are
 * apart the two rays are not the same ray, and the point they meet at is off the floor's
 * plane -- forward of the eyes it rises, behind them it dips.
 *
 * The share `s` along the far ray depends only on how far apart the two nominal points
 * are in depth, not on the height of the floor. So every floor has the same footprint on
 * the ground, and the tower is that footprint extruded straight up with the floor lines
 * bent across it. A vertical line at one `x` joins exactly corresponding points of the
 * floors: from the far eye it is a generator of the cylinder, from the near eye an edge
 * of the prism.
 *
 * Coordinates here are the tower's own: `x` across, `y` in depth away from the eyes, `z`
 * up. The sketch maps them onto its stage.
 */
export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** The eyes: one height, one line, two distances. */
export const EYE_HEIGHT = 3;
export const FAR_DISTANCE = 12;
export const NEAR_DISTANCE = 4;
/** The nominal circle's radius and the nominal square's half side, which are one number. */
export const RADIUS = 1;
export const FLOOR_COUNT = 8;
export const FLOOR_SPACING = 0.5;
export const FLOOR_HEIGHTS = Array.from({ length: FLOOR_COUNT }, (unused, index) => index * FLOOR_SPACING);
/** Where both eyes look: halfway up the tower, so it stays centred as the eye walks. */
export const TOWER_MIDDLE = (FLOOR_HEIGHTS[0] + FLOOR_HEIGHTS[FLOOR_COUNT - 1]) / 2;
/** Even, so that the two corners of each floor fall on samples rather than between them. */
export const RIM_SEGMENTS = 360;

/** One tower unit on the stage, in logical pixels before the perspective divide. */
export const STAGE_SCALE = 100;

/**
 * The near eye's vertical field of view, and the rule that carries it to every other
 * distance: the tower keeps one angular height as the eye walks, so its picture stays one
 * size and only its shape changes. `tan(fov / 2) * distance` is the constant.
 */
export const NEAR_FIELD_OF_VIEW = 62 * Math.PI / 180;
export const FIELD_CONSTANT = Math.tan(NEAR_FIELD_OF_VIEW / 2) * NEAR_DISTANCE;

export function fieldOfView(distance) {
  if (!(distance > 0)) {
    throw new RangeError("The eye stands at a positive distance.");
  }
  return 2 * Math.atan(FIELD_CONSTANT / distance);
}

export function eyeAt(distance) {
  if (!(distance > 0)) {
    throw new RangeError("The eye stands at a positive distance.");
  }
  return [0, -distance, EYE_HEIGHT];
}

export const FAR_EYE = eyeAt(FAR_DISTANCE);
export const NEAR_EYE = eyeAt(NEAR_DISTANCE);
export const LOOK_AT = [0, 0, TOWER_MIDDLE];

/**
 * The share of the far ray at which it meets the near ray, from the depths of the
 * circle point and the square point that share an `x`. Solving
 * `C_far + s (Q_circle - C_far) = C_near + u (Q_square - C_near)` coordinate by
 * coordinate: the heights give `s = u`, the `x` gives the same `x`, and the depths give
 * this. Where the two nominal points coincide the share is one and the curve touches
 * the floor's plane.
 */
export function rimShare(circleDepth, squareDepth) {
  const gap = FAR_DISTANCE - NEAR_DISTANCE;
  return gap / (gap + circleDepth - squareDepth);
}

/** The point of the floor at `x`, from its circle depth, its square depth and its height. */
export function rimPoint(x, circleDepth, squareDepth, floorHeight) {
  const share = rimShare(circleDepth, squareDepth);
  return [
    share * x,
    -FAR_DISTANCE + share * (circleDepth + FAR_DISTANCE),
    EYE_HEIGHT + share * (floorHeight - EYE_HEIGHT)
  ];
}

/**
 * A corner of the floor: at `x = ±r` the circle has one point and the square a whole
 * side, so the curve runs straight along the far eye's ray between the near eye's rays
 * to the side's two ends. From far it is a point; from near it is the side.
 */
export function cornerEnds(sign, floorHeight) {
  return [
    rimPoint(sign * RADIUS, 0, -RADIUS, floorHeight),
    rimPoint(sign * RADIUS, 0, RADIUS, floorHeight)
  ];
}

/**
 * The whole floor as one closed polyline, sampled at the circle's angles so that the
 * far eye's picture of it is the same polygon it would draw of the circle. It starts at
 * the front end of the left corner, runs the front (the side nearer the eyes), turns the
 * right corner front to back, runs the back, and closes through the left corner.
 */
export function rimAt(floorHeight, segments = RIM_SEGMENTS) {
  if (!Number.isInteger(segments) || segments < 4 || segments % 2 !== 0) {
    throw new RangeError("Sample the rim with an even number of segments, at least four.");
  }
  const half = segments / 2;
  const points = [];
  const [leftFront, leftBack] = cornerEnds(-1, floorHeight);
  const [rightFront, rightBack] = cornerEnds(1, floorHeight);
  points.push(leftFront);
  for (let index = 1; index < half; index += 1) {
    const angle = Math.PI + 2 * Math.PI * index / segments;
    points.push(rimPoint(RADIUS * Math.cos(angle), RADIUS * Math.sin(angle), -RADIUS, floorHeight));
  }
  points.push(rightFront, rightBack);
  for (let index = half + 1; index < segments; index += 1) {
    const angle = Math.PI + 2 * Math.PI * index / segments;
    points.push(rimPoint(RADIUS * Math.cos(angle), RADIUS * Math.sin(angle), RADIUS, floorHeight));
  }
  points.push(leftBack, leftFront);
  return points;
}

/**
 * The four vertical hairlines, one at each corner end, from the lowest floor to the
 * highest. The footprint is one curve for every floor, so these are exactly vertical.
 */
export function verticals() {
  const lowest = FLOOR_HEIGHTS[0];
  const highest = FLOOR_HEIGHTS[FLOOR_COUNT - 1];
  const lines = [];
  for (const sign of [-1, 1]) {
    const [lowFront, lowBack] = cornerEnds(sign, lowest);
    const [highFront, highBack] = cornerEnds(sign, highest);
    lines.push([lowFront, highFront], [lowBack, highBack]);
  }
  return lines;
}

/*
 * The walk.
 *
 * The clip is a recorded walk: the eye rests far off, walks in to the near station,
 * rests there, walks back out and rests again, and the last frame is the first. On the
 * page the same lever is the pointer's place across the canvas.
 */
export const REST_FAR_OPENING = 15;
export const WALK_IN = 120;
export const REST_NEAR = 30;
export const WALK_OUT = 120;
export const REST_FAR_CLOSING = TOTAL_FRAMES - REST_FAR_OPENING - WALK_IN - REST_NEAR - WALK_OUT;

/**
 * How the lever is read as a distance. `reciprocal` spends the lever evenly in `1 / d`,
 * which is what the picture changes evenly in; `linear` spends it evenly in the
 * distance itself.
 */
export const WALK_LAWS = ["reciprocal", "linear"];
export const WALK_LAW = "reciprocal";

/** The lever, nought at the far station and one at the near, from the frame. */
export function leverAtFrame(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  if (frame < REST_FAR_OPENING) return 0;
  if (frame < REST_FAR_OPENING + WALK_IN) return (frame - REST_FAR_OPENING) / WALK_IN;
  if (frame < REST_FAR_OPENING + WALK_IN + REST_NEAR) return 1;
  if (frame < TOTAL_FRAMES - REST_FAR_CLOSING) {
    return 1 - (frame - REST_FAR_OPENING - WALK_IN - REST_NEAR) / WALK_OUT;
  }
  return 0;
}

/** The distance the lever stands for. The two stations are returned exactly. */
export function distanceAtLever(lever, law = WALK_LAW) {
  if (!(lever >= 0 && lever <= 1)) {
    throw new RangeError("The lever runs from nought to one.");
  }
  if (!WALK_LAWS.includes(law)) {
    throw new RangeError("The walk follows one of the named laws.");
  }
  if (lever === 0) return FAR_DISTANCE;
  if (lever === 1) return NEAR_DISTANCE;
  if (law === "linear") {
    return FAR_DISTANCE + lever * (NEAR_DISTANCE - FAR_DISTANCE);
  }
  return 1 / ((1 - lever) / FAR_DISTANCE + lever / NEAR_DISTANCE);
}

/**
 * The pointer's lane across the page, in fractions of the canvas: the lever runs from
 * the left inset to the right, and the clip's pointer sweeps that same lane so that where
 * the hand is drawn is where the hand would have to be. The lane lies under the tower's
 * foot, which at the near station reaches nine tenths of the way down the frame.
 */
export const LANE_INSET = 0.08;
export const LANE_HEIGHT = 0.955;

export function leverFromPointer(pointerX, width) {
  const inset = width * LANE_INSET;
  const lever = (pointerX - inset) / (width - 2 * inset);
  return Math.max(0, Math.min(1, lever));
}

export function pointerAtLever(lever, width, height) {
  const inset = width * LANE_INSET;
  return { x: inset + lever * (width - 2 * inset), y: height * LANE_HEIGHT };
}

/** The whole picture at one frame or one lever position. */
export function sceneAtLever(lever, law = WALK_LAW) {
  const distance = distanceAtLever(lever, law);
  return {
    lever,
    distance,
    fieldOfView: fieldOfView(distance),
    eye: eyeAt(distance),
    lookAt: LOOK_AT,
    floors: FLOOR_HEIGHTS.map((height) => rimAt(height)),
    verticals: verticals()
  };
}

export function sceneAt(frameIndex, law = WALK_LAW) {
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  return { frameIndex: frame, ...sceneAtLever(leverAtFrame(frame), law) };
}

/*
 * Exact arithmetic.
 *
 * A rational point of the unit circle, `(a / d, b / d)` with `a² + b² = d²`, gives a
 * rational share and a rational point of the floor, so the claim that the point lies on
 * both rays can be tested as an integer identity rather than to a tolerance. Points are
 * `{ numerator: [x, y, z], denominator }` with BigInt parts.
 */
const FAR_N = BigInt(FAR_DISTANCE);
const NEAR_N = BigInt(NEAR_DISTANCE);
const EYE_N = BigInt(EYE_HEIGHT);
const RADIUS_N = BigInt(RADIUS);

function assertBigInts(values) {
  if (!values.every((value) => typeof value === "bigint")) {
    throw new TypeError("Exact coordinates must be BigInts.");
  }
}

/** A floor's height as a rational, `numerator / denominator`, both BigInt. */
export function exactFloor(height) {
  const twice = Math.round(height * 2);
  if (twice !== height * 2) {
    throw new RangeError("Floor heights are multiples of a half.");
  }
  return { numerator: BigInt(twice), denominator: 2n };
}

/**
 * The exact point of the floor at the rational circle point `(a / d, b / d) * r` on the
 * side of the square `side * r` (`-1n` front, `1n` back), at the given floor height.
 */
export function exactRimPoint(a, b, d, side, floor) {
  assertBigInts([a, b, d, side, floor.numerator, floor.denominator]);
  if (d <= 0n || a * a + b * b !== d * d || (side !== 1n && side !== -1n)) {
    throw new RangeError("Use a rational unit point, a positive denominator and a side of ±1.");
  }
  const gap = FAR_N - NEAR_N;
  // s = gap / (gap + b r / d - side r) = gap d / (gap d + b r - side r d)
  const shareNumerator = gap * d;
  const shareDenominator = gap * d + b * RADIUS_N - side * RADIUS_N * d;
  const denominator = shareDenominator * d * floor.denominator;
  return {
    numerator: [
      shareNumerator * a * RADIUS_N * floor.denominator,
      (-FAR_N * shareDenominator * d + shareNumerator * (b * RADIUS_N + FAR_N * d)) * floor.denominator,
      EYE_N * shareDenominator * d * floor.denominator
        + shareNumerator * (floor.numerator - EYE_N * floor.denominator) * d
    ],
    denominator,
    share: { numerator: shareNumerator, denominator: shareDenominator }
  };
}

/** The exact circle point and square point the rim point answers to. */
export function exactNominalPoints(a, b, d, side, floor) {
  assertBigInts([a, b, d, side, floor.numerator, floor.denominator]);
  const denominator = d * floor.denominator;
  return {
    circle: {
      numerator: [a * RADIUS_N * floor.denominator, b * RADIUS_N * floor.denominator, floor.numerator * d],
      denominator
    },
    square: {
      numerator: [a * RADIUS_N * floor.denominator, side * RADIUS_N * denominator, floor.numerator * d],
      denominator
    }
  };
}

export function exactEye(distance) {
  return { numerator: [0n, -BigInt(distance), EYE_N], denominator: 1n };
}

function exactDifference(point, from) {
  return point.numerator.map((part, axis) => (
    part * from.denominator - from.numerator[axis] * point.denominator
  ));
}

/**
 * Whether `point` lies on the line through `eye` and `target`: the cross product of the
 * two differences vanishes as integers. The common denominators are positive and cancel
 * from the zero test.
 */
export function exactlyOnRay(point, eye, target) {
  const [px, py, pz] = exactDifference(point, eye);
  const [tx, ty, tz] = exactDifference(target, eye);
  return py * tz - pz * ty === 0n && pz * tx - px * tz === 0n && px * ty - py * tx === 0n;
}

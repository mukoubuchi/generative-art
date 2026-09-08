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
 * The clip is a staged walk: the eye rests far off, walks in, rests near, and then a
 * third eye leaves the line the two stations share and swings round and up to show the
 * floors for what they are, before the eye returns and walks back out. Coordinates here
 * are the tower's own: `x` across, `y` in depth away from the eyes, `z` up. The sketch
 * maps them onto its stage.
 */
export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 12;
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
 * distance. The tower is allowed to grow as the eye walks in, but not as fast as a fixed
 * lens would let it: `tan(fov / 2)` goes as one over the square root of the distance, so
 * the tower's angular height rises by the square root of the ratio of distances rather
 * than by the ratio itself. What the reader sees is both an approach and a change of shape.
 */
export const NEAR_FIELD_OF_VIEW = 68 * Math.PI / 180;
export const FIELD_CONSTANT = Math.tan(NEAR_FIELD_OF_VIEW / 2) * Math.sqrt(NEAR_DISTANCE);

export function fieldOfView(distance) {
  if (!(distance > 0)) {
    throw new RangeError("The eye stands at a positive distance.");
  }
  return 2 * Math.atan(FIELD_CONSTANT / Math.sqrt(distance));
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

/**
 * The walls: between two floors, at each sample, the vertical quad on the shared
 * footprint. Its corners are the floors' own points and nothing else, and its normal is
 * horizontal, at right angles to the footprint's run. From the far eye the walls turn
 * round the tower like a cylinder's; from the near eye four of them lie flat.
 */
export function wallQuads(rims) {
  const quads = [];
  for (let floor = 1; floor < rims.length; floor += 1) {
    const below = rims[floor - 1];
    const above = rims[floor];
    for (let index = 1; index < below.length; index += 1) {
      const a = below[index - 1];
      const b = below[index];
      const across = b[0] - a[0];
      const along = b[1] - a[1];
      const length = Math.hypot(across, along);
      quads.push({
        corners: [a, b, above[index], above[index - 1]],
        normal: [along / length, -across / length, 0]
      });
    }
  }
  return quads;
}

/**
 * How far the floors' picture stands from the nominal figure's, seen from an eye at
 * `distance` on the stations' line: the largest angle, over all eight floors and all
 * 363 vertices including both ends of each corner, between the ray to a floor point and
 * the ray to the circle point or square point it answers to. In radians, and independent
 * of any lens. Exactly nought at the figure's own station.
 */
export function deviation(distance, figure) {
  if (figure !== "circle" && figure !== "square") {
    throw new RangeError("The deviation is from the circle or from the square.");
  }
  const eye = eyeAt(distance);
  const half = RIM_SEGMENTS / 2;
  let worst = 0;
  for (const height of FLOOR_HEIGHTS) {
    const rim = rimAt(height);
    for (let index = 0; index <= RIM_SEGMENTS + 1; index += 1) {
      const sample = index <= half ? index : index - 1;
      const angle = Math.PI + 2 * Math.PI * sample / RIM_SEGMENTS;
      const corner = index === 0 || index === half || index === half + 1 || index === RIM_SEGMENTS + 1;
      const x = corner ? (index === 0 || index === RIM_SEGMENTS + 1 ? -RADIUS : RADIUS) : RADIUS * Math.cos(angle);
      const circleDepth = corner ? 0 : RADIUS * Math.sin(angle);
      const squareDepth = index === 0 || index === half ? -RADIUS
        : index === half + 1 || index === RIM_SEGMENTS + 1 ? RADIUS : Math.sign(circleDepth) * RADIUS;
      const target = figure === "circle" ? [x, circleDepth, height] : [x, squareDepth, height];
      const point = rim[index];
      const a = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]];
      const b = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
      const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const sine = Math.hypot(...cross) / (Math.hypot(...a) * Math.hypot(...b));
      worst = Math.max(worst, Math.asin(Math.min(1, sine)));
    }
  }
  // At a figure's own station every ray pair is collinear -- proved as an integer identity
  // by the exact arithmetic below -- and what the floating point leaves is the rounding of
  // that collinearity, a few units in the seventeenth place. That is returned as the
  // nought it is, rather than as a number that would light the station a hair short.
  return worst < 1e-14 ? 0 : worst;
}

/** The same deviation in the picture's own pixels, at the logical size, under the walk's lens. */
export function deviationPixels(distance, figure) {
  return deviation(distance, figure) * (LOGICAL_SIZE / 2) / Math.tan(fieldOfView(distance) / 2);
}

/**
 * The station glow: one where the picture is the figure's, falling off with the deviation
 * so that a few pixels of it are already half the light and a few dozen are none.
 */
export const GLOW_REACH = 6;

export function glow(pixels) {
  if (!(pixels >= 0)) {
    throw new RangeError("A deviation is not negative.");
  }
  return Math.exp(-pixels / GLOW_REACH);
}

/*
 * The staging, as one continuous move.
 *
 * The eye stands at the far station, walks in to the near one, waits a beat there, and is
 * then whipped round and up in six tenths of a second to where the floors show as the bent
 * curves they are on the one footprint they share; it settles, holds, comes back to the
 * line and walks out, and the last frame is the first.
 *
 * Every stretch is smootherstep, whose first and second derivatives vanish at both ends,
 * and each stretch begins exactly where the one before it ended, so neither speed nor
 * acceleration jumps at a join. The stations are moments of zero speed rather than dead
 * stops. An earlier staging ran each act's progress from nought to one step short of one,
 * so the walk arrived still moving and the next act's constant stopped it dead: the clip
 * had two such cliffs in it, and forty per cent of its frames stood still.
 */
export const ACTS = [
  ["in", 110], ["near", 16], ["whip", 18], ["settle", 30], ["hold", 30], ["back", 60], ["out", 96]
];
export const ACT_FRAMES = ACTS.reduce((sum, [, frames]) => sum + frames, 0);
/** How far the whip carries the turn before the settle takes it the rest of the way. */
export const WHIP_SHARE = 0.9;
/** The frames the eye stands exactly at a station: the first, and the end of the walk in. */
export const FAR_FRAME = 0;
export const NEAR_FRAME = ACTS[0][1];
/**
 * The arrival beat: at a station's own frame the station's light swells by this much and
 * falls back over these frames. It is a beat of the staging and not a measurement -- the
 * deviation and the glow it lights are measured, and this is laid over them.
 */
export const ARRIVAL_SWELL = 1.9;
export const ARRIVAL_FALL = 18;

/** The walk spends its frames evenly in `1 / d`, which is what the picture changes evenly in. */
export function distanceAtLever(lever) {
  if (!(lever >= 0 && lever <= 1)) {
    throw new RangeError("The lever runs from nought to one.");
  }
  if (lever === 0) return FAR_DISTANCE;
  if (lever === 1) return NEAR_DISTANCE;
  return 1 / ((1 - lever) / FAR_DISTANCE + lever / NEAR_DISTANCE);
}

/**
 * Smootherstep: the walk sets off and arrives with neither speed nor acceleration on it,
 * which is what lets one stretch of the move be joined to the next without a jolt.
 */
export function eased(t) {
  const u = Math.min(Math.max(t, 0), 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * The third eye's path, as an orbit about the point both stations look at. It starts
 * exactly at the near station and swings to an azimuth and elevation from which the
 * bent floors and the footprint read, drawing back as it goes so that the whole tower
 * stays in the frame.
 */
export const REVEAL_AZIMUTH = 62 * Math.PI / 180;
export const REVEAL_ELEVATION = 48 * Math.PI / 180;
export const REVEAL_RADIUS = 7;
const NEAR_OFFSET = NEAR_EYE.map((part, axis) => part - LOOK_AT[axis]);
export const ORBIT_RADIUS = Math.hypot(...NEAR_OFFSET);
export const ORBIT_ELEVATION = Math.asin(NEAR_OFFSET[2] / ORBIT_RADIUS);

export function orbitRadius(turn) {
  return ORBIT_RADIUS + (REVEAL_RADIUS - ORBIT_RADIUS) * turn;
}

export function orbitEye(turn) {
  if (!(turn >= 0 && turn <= 1)) {
    throw new RangeError("The orbit runs from nought to one.");
  }
  if (turn === 0) return NEAR_EYE;
  const azimuth = REVEAL_AZIMUTH * turn;
  const elevation = ORBIT_ELEVATION + (REVEAL_ELEVATION - ORBIT_ELEVATION) * turn;
  const radius = orbitRadius(turn);
  return [
    LOOK_AT[0] + radius * Math.cos(elevation) * Math.sin(azimuth),
    LOOK_AT[1] - radius * Math.cos(elevation) * Math.cos(azimuth),
    LOOK_AT[2] + radius * Math.sin(elevation)
  ];
}

/**
 * How far the walk and the turn have come at a frame. The walk runs from the far station
 * to the near one and back; the turn takes the third eye off the line and back.
 */
export function stagingAt(frameIndex) {
  const { name, progress } = actAt(frameIndex);
  if (name === "in") return { act: name, walk: eased(progress), turn: 0 };
  if (name === "near") return { act: name, walk: 1, turn: 0 };
  if (name === "whip") return { act: name, walk: 1, turn: WHIP_SHARE * eased(progress) };
  if (name === "settle") return { act: name, walk: 1, turn: WHIP_SHARE + (1 - WHIP_SHARE) * eased(progress) };
  if (name === "hold") return { act: name, walk: 1, turn: 1 };
  if (name === "back") return { act: name, walk: 1, turn: 1 - eased(progress) };
  return { act: name, walk: 1 - eased(progress), turn: 0 };
}

/**
 * The arrival beat at a frame: one everywhere except in the frames just after a station,
 * where the station's light swells and falls back. Staging, not measurement.
 */
export function arrivalAt(frameIndex) {
  const frame = actAt(frameIndex).frame;
  const since = (station) => (frame - station + TOTAL_FRAMES) % TOTAL_FRAMES;
  const beat = Math.min(since(FAR_FRAME), since(NEAR_FRAME));
  if (beat >= ARRIVAL_FALL) return 1;
  const left = 1 - beat / ARRIVAL_FALL;
  return 1 + (ARRIVAL_SWELL - 1) * left * left;
}

/** Which act a frame falls in, and how far through it. */
export function actAt(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  let start = 0;
  for (const [name, frames] of ACTS) {
    if (frame < start + frames) {
      return { frame, name, progress: (frame - start) / frames };
    }
    start += frames;
  }
  throw new RangeError("The acts do not cover the clip.");
}

/**
 * The whole picture at one frame: where the eye is, how wide it sees, whether it is on
 * the stations' line, and how brightly each station's figure is lit.
 */
export function sceneAt(frameIndex) {
  const { frame } = actAt(frameIndex);
  const { act, walk, turn } = stagingAt(frameIndex);
  const onLine = turn === 0;
  const distance = onLine ? distanceAtLever(walk) : null;
  const eye = onLine ? eyeAt(distance) : orbitEye(turn);
  // Off the line the lens is read from a distance that starts at the near station's, so
  // the field does not jump as the third eye sets off; and the near station's glow is
  // carried out with the turn rather than dropped, for the same reason. Neither is a
  // measurement: the deviation is defined on the stations' line only.
  const lens = onLine ? distance : NEAR_DISTANCE + (REVEAL_RADIUS - NEAR_DISTANCE) * turn;
  return {
    frameIndex: frame,
    act,
    walk,
    turn,
    onLine,
    distance,
    eye,
    lookAt: LOOK_AT,
    fieldOfView: fieldOfView(lens),
    // The two glows are measurements; the arrival is the beat laid over them.
    circleGlow: onLine ? glow(deviationPixels(distance, "circle")) : 0,
    squareGlow: onLine ? glow(deviationPixels(distance, "square")) : 1 - turn,
    arrival: arrivalAt(frameIndex)
  };
}

/**
 * How far the eye moves between this frame and the next, in the tower's own units: the
 * move's speed, which the tests hold to arriving at nought rather than being stopped at it.
 */
export function eyeStepAt(frameIndex) {
  const here = sceneAt(frameIndex).eye;
  const next = sceneAt(frameIndex + 1).eye;
  return Math.hypot(next[0] - here[0], next[1] - here[1], next[2] - here[2]);
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

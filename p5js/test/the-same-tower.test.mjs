import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACTS,
  ACT_FRAMES,
  DURATION_SECONDS,
  EYE_HEIGHT,
  FAR_DISTANCE,
  FAR_EYE,
  FIELD_CONSTANT,
  FLOOR_COUNT,
  FLOOR_HEIGHTS,
  FLOOR_SPACING,
  GLOW_REACH,
  LOGICAL_SIZE,
  LOOK_AT,
  NEAR_DISTANCE,
  NEAR_EYE,
  NEAR_FIELD_OF_VIEW,
  ORBIT_RADIUS,
  PLAYBACK_FPS,
  RADIUS,
  REVEAL_AZIMUTH,
  REVEAL_ELEVATION,
  REVEAL_RADIUS,
  RIM_SEGMENTS,
  STAGE_SCALE,
  TOTAL_FRAMES,
  TOWER_MIDDLE,
  ARRIVAL_FALL,
  ARRIVAL_SWELL,
  FAR_FRAME,
  NEAR_FRAME,
  WHIP_SHARE,
  actAt,
  arrivalAt,
  eyeStepAt,
  stagingAt,
  cornerEnds,
  deviation,
  deviationPixels,
  distanceAtLever,
  eased,
  exactEye,
  exactFloor,
  exactNominalPoints,
  exactRimPoint,
  exactlyOnRay,
  eyeAt,
  fieldOfView,
  glow,
  orbitEye,
  rimAt,
  rimPoint,
  rimShare,
  sceneAt,
  verticals,
  wallQuads
} from "../artworks/the-same-tower/the-same-tower.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/the-same-tower/sketch.js", import.meta.url);

/** Rational unit points: the phases where the arithmetic can be exact. */
const RATIONAL_POINTS = [[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n], [20n, 21n, 29n], [7n, 24n, 25n]];

function signedPoints(triples = RATIONAL_POINTS) {
  const points = [];
  for (const [a, b, d] of triples) {
    for (const acrossSign of [1n, -1n]) {
      for (const depthSign of [1n, -1n]) points.push([acrossSign * a, depthSign * b, d]);
    }
  }
  return points;
}

/** The side of the square a circle point answers to: the one on its own side of the eyes. */
function sideOf(b) {
  return b < 0n ? -1n : 1n;
}

const EXACT_FLOORS = [0, 1.5, 3.5].map(exactFloor);

function sameFraction(left, right) {
  return left.value * right.denominator === right.value * left.denominator;
}

function coordinate(point, axis) {
  return { value: point.numerator[axis], denominator: point.denominator };
}

function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Distance of `point` from the line through `eye` and `target`, in tower units. */
function offLine(point, eye, target) {
  const along = subtract(target, eye);
  const [x, y, z] = cross(subtract(point, eye), along);
  return Math.hypot(x, y, z) / Math.hypot(...along);
}

test("the two eyes, the tower and the clip keep their numbers", () => {
  assert.equal(EYE_HEIGHT, 3);
  assert.equal(FAR_DISTANCE, 12);
  assert.equal(NEAR_DISTANCE, 4);
  assert.equal(RADIUS, 1);
  assert.equal(FLOOR_COUNT, 8);
  assert.equal(FLOOR_SPACING, 0.5);
  assert.deepEqual(FLOOR_HEIGHTS, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  assert.equal(TOWER_MIDDLE, 1.75);
  assert.equal(RIM_SEGMENTS, 360);
  assert.equal(STAGE_SCALE, 100);
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 12);
  assert.equal(TOTAL_FRAMES, 360);
  assert.deepEqual(FAR_EYE, [0, -12, 3]);
  assert.deepEqual(NEAR_EYE, [0, -4, 3]);
  assert.deepEqual(LOOK_AT, [0, 0, 1.75]);
  assert.equal(GLOW_REACH, 6);
});

test("at forty rational points on three floors the rim point is on both rays, as an integer identity", () => {
  let checks = 0;
  for (const floor of EXACT_FLOORS) {
    for (const [a, b, d] of signedPoints()) {
      const side = sideOf(b);
      const point = exactRimPoint(a, b, d, side, floor);
      const { circle, square } = exactNominalPoints(a, b, d, side, floor);
      assert.ok(exactlyOnRay(point, exactEye(FAR_DISTANCE), circle));
      assert.ok(exactlyOnRay(point, exactEye(NEAR_DISTANCE), square));
      // The circle and the square are apart here, so the point is off the floor's plane.
      assert.notEqual(point.share.numerator, point.share.denominator);
      assert.ok(!sameFraction(coordinate(point, 2), { value: floor.numerator, denominator: floor.denominator }));
      checks += 1;
    }
  }
  assert.equal(checks, 3 * 20);
});

test("the footprint is one curve for every floor, and the floors stand in order on it", () => {
  for (const [a, b, d] of signedPoints()) {
    const side = sideOf(b);
    const ground = exactRimPoint(a, b, d, side, EXACT_FLOORS[0]);
    let previousHeight = null;
    for (const floor of EXACT_FLOORS) {
      const point = exactRimPoint(a, b, d, side, floor);
      assert.ok(sameFraction(coordinate(point, 0), coordinate(ground, 0)));
      assert.ok(sameFraction(coordinate(point, 1), coordinate(ground, 1)));
      const height = coordinate(point, 2);
      if (previousHeight) {
        // Higher floor, higher point: the share is positive.
        assert.ok(height.value * previousHeight.denominator > previousHeight.value * height.denominator);
      }
      previousHeight = height;
    }
  }
});

test("each corner is a straight run along the far ray between the near rays to the side's ends", () => {
  for (const floor of EXACT_FLOORS) {
    for (const sign of [1n, -1n]) {
      const ends = [-1n, 1n].map((side) => exactRimPoint(sign, 0n, 1n, side, floor));
      const { circle } = exactNominalPoints(sign, 0n, 1n, 1n, floor);
      for (const [index, side] of [-1n, 1n].entries()) {
        const { square } = exactNominalPoints(sign, 0n, 1n, side, floor);
        assert.ok(exactlyOnRay(ends[index], exactEye(FAR_DISTANCE), circle));
        assert.ok(exactlyOnRay(ends[index], exactEye(NEAR_DISTANCE), square));
      }
      // Both ends on one line through the eye, so the segment between them is on it too.
      const midpoint = {
        numerator: ends[0].numerator.map((part, axis) => (
          part * ends[1].denominator + ends[1].numerator[axis] * ends[0].denominator
        )),
        denominator: 2n * ends[0].denominator * ends[1].denominator
      };
      assert.ok(exactlyOnRay(midpoint, exactEye(FAR_DISTANCE), circle));
    }
  }
  // The numbers the notes give for the ground floor's right corner.
  const [front, back] = cornerEnds(1, 0);
  assert.deepEqual(front.map((value) => Math.round(value * 63)), [56, -84, 21]);
  assert.deepEqual(back.map((value) => Math.round(value * 63)), [72, 108, -27]);
});

test("where the circle touches the square the curve touches the floor", () => {
  for (const floor of EXACT_FLOORS) {
    const point = exactRimPoint(0n, -1n, 1n, -1n, floor);
    const { circle, square } = exactNominalPoints(0n, -1n, 1n, -1n, floor);
    assert.equal(point.share.numerator, point.share.denominator);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(sameFraction(coordinate(point, axis), coordinate(circle, axis)));
      assert.ok(sameFraction(coordinate(point, axis), coordinate(square, axis)));
    }
  }
  assert.equal(rimShare(-RADIUS, -RADIUS), 1);
});

// These controls are synthetic departures from the construction, not frozen code defects.
test("a third eye, a moved eye, or the wrong pairing puts the point on no ray", () => {
  const floor = EXACT_FLOORS[1];
  for (const [a, b, d] of signedPoints([[3n, 4n, 5n], [5n, 12n, 13n]])) {
    const side = sideOf(b);
    const point = exactRimPoint(a, b, d, side, floor);
    const { circle, square } = exactNominalPoints(a, b, d, side, floor);
    // Another station on the same line sees neither figure.
    for (const distance of [2, 7, 20]) {
      assert.ok(!exactlyOnRay(point, exactEye(distance), circle));
      assert.ok(!exactlyOnRay(point, exactEye(distance), square));
    }
    // The eyes off their line: across, or raised.
    assert.ok(!exactlyOnRay(point, { numerator: [1n, -12n, 3n], denominator: 1n }, circle));
    assert.ok(!exactlyOnRay(point, { numerator: [0n, -12n, 4n], denominator: 1n }, circle));
    assert.ok(!exactlyOnRay(point, { numerator: [1n, -4n, 3n], denominator: 1n }, square));
    assert.ok(!exactlyOnRay(point, { numerator: [0n, -4n, 4n], denominator: 1n }, square));
    // The right eyes, the wrong figures.
    assert.ok(!exactlyOnRay(point, exactEye(FAR_DISTANCE), square));
    assert.ok(!exactlyOnRay(point, exactEye(NEAR_DISTANCE), circle));
  }
});

test("every drawn floor is a closed polyline through its corners, and every sample is on both rays", () => {
  const half = RIM_SEGMENTS / 2;
  let checked = 0;
  for (const height of FLOOR_HEIGHTS) {
    const rim = rimAt(height);
    assert.equal(rim.length, RIM_SEGMENTS + 3);
    assert.deepEqual(rim[0], rim[rim.length - 1]);
    const [leftFront, leftBack] = cornerEnds(-1, height);
    const [rightFront, rightBack] = cornerEnds(1, height);
    assert.deepEqual([rim[0], rim[half], rim[half + 1], rim[RIM_SEGMENTS + 1]], [leftFront, rightFront, rightBack, leftBack]);
    for (let index = 0; index <= RIM_SEGMENTS + 1; index += 1) {
      const angle = Math.PI + 2 * Math.PI * (index <= half ? index : index - 1) / RIM_SEGMENTS;
      const isCorner = index === 0 || index === half || index === half + 1 || index === RIM_SEGMENTS + 1;
      const circlePoint = isCorner
        ? [index === 0 || index === RIM_SEGMENTS + 1 ? -RADIUS : RADIUS, 0, height]
        : [RADIUS * Math.cos(angle), RADIUS * Math.sin(angle), height];
      const side = index === 0 || index === half ? -RADIUS : index === half + 1 || index === RIM_SEGMENTS + 1 ? RADIUS : Math.sign(circlePoint[1]) * RADIUS;
      const squarePoint = [circlePoint[0], side, height];
      assert.ok(offLine(rim[index], FAR_EYE, circlePoint) < 1e-12, `floor ${height} sample ${index} off the far ray`);
      assert.ok(offLine(rim[index], NEAR_EYE, squarePoint) < 1e-12, `floor ${height} sample ${index} off the near ray`);
      checked += 1;
    }
  }
  assert.equal(checked, FLOOR_COUNT * (RIM_SEGMENTS + 2));
  assert.throws(() => rimAt(0, 7), RangeError);
  assert.throws(() => rimAt(0, 2), RangeError);
});

test("the floors never cross: at every sample they stand in order, on one footprint", () => {
  const rims = FLOOR_HEIGHTS.map((height) => rimAt(height));
  for (let index = 0; index < rims[0].length; index += 1) {
    for (let floor = 1; floor < FLOOR_COUNT; floor += 1) {
      const below = rims[floor - 1][index];
      const above = rims[floor][index];
      assert.ok(Math.abs(above[0] - below[0]) < 1e-12);
      assert.ok(Math.abs(above[1] - below[1]) < 1e-12);
      assert.ok(above[2] > below[2]);
    }
  }
  // The swing of a floor's height is proportional to its distance below the eyes, so it
  // turns over above them and vanishes at their height: the numbers the notes give.
  const swing = (height) => {
    const heights = rimAt(height).map((point) => point[2] - height);
    return [Math.max(...heights), Math.min(...heights)];
  };
  const [groundUp, groundDown] = swing(0);
  assert.ok(Math.abs(groundUp - 1 / 3) < 1e-12);
  assert.ok(Math.abs(groundDown + 3 / 7) < 1e-12);
  const [topUp, topDown] = swing(3.5);
  assert.ok(Math.abs(topUp - 1 / 14) < 1e-12);
  assert.ok(Math.abs(topDown + 1 / 18) < 1e-12);
  // The ground floor rises at its front and dips at its back; the top floor the other way.
  const [groundFront, groundBack] = cornerEnds(1, 0);
  const [topFront, topBack] = cornerEnds(1, 3.5);
  assert.ok(groundFront[2] > 0 && groundBack[2] < 0);
  assert.ok(topFront[2] < 3.5 && topBack[2] > 3.5);
  assert.deepEqual(swing(EYE_HEIGHT), [0, 0]);
  assert.ok(Math.abs(rimPoint(0, -RADIUS, -RADIUS, 0)[2]) < 1e-12);
});

test("the four hairlines are vertical, run the tower's whole height, and stand at the corner ends", () => {
  const lines = verticals();
  assert.equal(lines.length, 4);
  const lowest = FLOOR_HEIGHTS[0];
  const highest = FLOOR_HEIGHTS[FLOOR_COUNT - 1];
  const expected = [-1, 1].flatMap((sign) => {
    const low = cornerEnds(sign, lowest);
    const high = cornerEnds(sign, highest);
    return [[low[0], high[0]], [low[1], high[1]]];
  });
  assert.deepEqual(lines, expected);
  for (const [from, to] of lines) {
    assert.equal(from[0], to[0]);
    assert.equal(from[1], to[1]);
    assert.ok(to[2] > from[2]);
  }
  // From the far eye the two hairlines of one side lie on one ray: a cylinder has two
  // silhouette lines, not four.
  for (const sign of [-1, 1]) {
    const [front, back] = cornerEnds(sign, lowest);
    assert.ok(offLine(back, FAR_EYE, front) < 1e-12);
  }
});

test("the walls are vertical quads whose corners are the floors' own points", () => {
  const rims = FLOOR_HEIGHTS.map((height) => rimAt(height));
  const quads = wallQuads(rims);
  assert.equal(quads.length, (FLOOR_COUNT - 1) * (RIM_SEGMENTS + 2));
  let index = 0;
  for (let floor = 1; floor < FLOOR_COUNT; floor += 1) {
    for (let sample = 1; sample < rims[floor].length; sample += 1) {
      const quad = quads[index];
      // The corners are the points themselves, not copies near them.
      assert.equal(quad.corners[0], rims[floor - 1][sample - 1]);
      assert.equal(quad.corners[1], rims[floor - 1][sample]);
      assert.equal(quad.corners[2], rims[floor][sample]);
      assert.equal(quad.corners[3], rims[floor][sample - 1]);
      // The two side edges are exactly vertical: one footprint for every floor.
      assert.equal(quad.corners[0][0], quad.corners[3][0]);
      assert.equal(quad.corners[0][1], quad.corners[3][1]);
      assert.equal(quad.corners[1][0], quad.corners[2][0]);
      assert.equal(quad.corners[1][1], quad.corners[2][1]);
      // The normal is horizontal, unit, and at right angles to the footprint's run.
      assert.equal(quad.normal[2], 0);
      assert.ok(Math.abs(Math.hypot(...quad.normal) - 1) < 1e-12);
      const run = subtract(quad.corners[1], quad.corners[0]);
      assert.ok(Math.abs(quad.normal[0] * run[0] + quad.normal[1] * run[1]) < 1e-12);
      index += 1;
    }
  }
  assert.equal(index, quads.length);
});

test("the eye's field widens as the square root of the approach: 62 degrees at the near station, 38.26 at the far", () => {
  assert.ok(Math.abs(NEAR_FIELD_OF_VIEW - 62 * Math.PI / 180) < 1e-15);
  assert.ok(Math.abs(fieldOfView(NEAR_DISTANCE) - NEAR_FIELD_OF_VIEW) < 1e-15);
  assert.ok(Math.abs(fieldOfView(FAR_DISTANCE) * 180 / Math.PI - 38.26404047298219) < 1e-12);
  let previous = Infinity;
  for (let step = 0; step <= 80; step += 1) {
    const distance = NEAR_DISTANCE + (FAR_DISTANCE - NEAR_DISTANCE) * step / 80;
    const field = fieldOfView(distance);
    assert.ok(Math.abs(Math.tan(field / 2) * Math.sqrt(distance) - FIELD_CONSTANT) < 1e-14);
    assert.ok(field < previous);
    previous = field;
  }
  // Between a fixed lens and a full dolly: the tower's angular height rises by the square
  // root of the ratio of distances, neither by the ratio nor not at all.
  const ratio = Math.tan(fieldOfView(FAR_DISTANCE) / 2) / Math.tan(fieldOfView(NEAR_DISTANCE) / 2);
  assert.ok(Math.abs(ratio - Math.sqrt(NEAR_DISTANCE / FAR_DISTANCE)) < 1e-14);
  assert.throws(() => fieldOfView(0), RangeError);
  assert.throws(() => eyeAt(-1), RangeError);
  assert.deepEqual(eyeAt(7), [0, -7, EYE_HEIGHT]);
});

test("the deviation is nought exactly at a figure's own station and positive everywhere else on the line", () => {
  assert.equal(deviation(FAR_DISTANCE, "circle"), 0);
  assert.equal(deviation(NEAR_DISTANCE, "square"), 0);
  assert.equal(deviationPixels(FAR_DISTANCE, "circle"), 0);
  assert.equal(deviationPixels(NEAR_DISTANCE, "square"), 0);
  for (const distance of [2, 4.5, 5, 6, 8, 10, 11, 11.9, 20]) {
    assert.ok(deviation(distance, "circle") > 0, `circle at ${distance}`);
    assert.ok(deviation(distance, "square") > 0, `square at ${distance}`);
  }
  assert.ok(deviation(FAR_DISTANCE, "square") > 0);
  assert.ok(deviation(NEAR_DISTANCE, "circle") > 0);
  // The radian measure knows nothing of the lens; the pixel measure is it times the lens's scale.
  for (const distance of [5, 8, 11]) {
    const scale = (LOGICAL_SIZE / 2) / Math.tan(fieldOfView(distance) / 2);
    assert.ok(Math.abs(deviationPixels(distance, "circle") - deviation(distance, "circle") * scale) < 1e-9);
  }
  // The values the notes give, under this definition and this lens.
  const pixels = (distance, figure) => Number(deviationPixels(distance, figure).toFixed(2));
  assert.deepEqual([11, 10, 8].map((d) => pixels(d, "circle")), [2.86, 6.58, 18.07]);
  assert.deepEqual([4.5, 5, 6].map((d) => pixels(d, "square")), [5.28, 9.44, 15.11]);
  assert.throws(() => deviation(8, "triangle"), RangeError);
});

test("the glow is one at nought, falls with the deviation, and never rises", () => {
  assert.equal(glow(0), 1);
  assert.ok(Math.abs(glow(GLOW_REACH) - Math.exp(-1)) < 1e-15);
  let previous = 1;
  for (let pixels = 0.5; pixels <= 100; pixels += 0.5) {
    const value = glow(pixels);
    assert.ok(value < previous);
    assert.ok(value > 0);
    previous = value;
  }
  assert.ok(glow(30) < 0.01);
  assert.throws(() => glow(-1), RangeError);
  // Along the walk in the circle's light only ever goes out; the square's only ever comes
  // on once the eye is nearer than ten, which is where its deviation starts to fall.
  let circleBefore = 1;
  let squareBefore = 0;
  for (let step = 0; step <= 100; step += 1) {
    const distance = distanceAtLever(step / 100);
    const circle = glow(deviationPixels(distance, "circle"));
    const square = glow(deviationPixels(distance, "square"));
    assert.ok(circle <= circleBefore + 1e-12);
    if (distance <= 10) assert.ok(square >= squareBefore - 1e-12, `square at ${distance}`);
    circleBefore = circle;
    squareBefore = square;
  }
  // Far off, the square's light is out: under three hundredths at the far station.
  assert.ok(glow(deviationPixels(FAR_DISTANCE, "square")) < 0.03);
});

test("the move is one continuous stretch, and the eye stands exactly at a station on the station's own frame", () => {
  assert.deepEqual(ACTS, [
    ["in", 110], ["near", 16], ["whip", 18], ["settle", 30], ["hold", 30], ["back", 60], ["out", 96]
  ]);
  assert.equal(ACT_FRAMES, TOTAL_FRAMES);
  assert.equal(NEAR_FRAME, 110);
  assert.equal(FAR_FRAME, 0);
  assert.equal(actAt(0).name, "in");
  assert.equal(actAt(110).name, "near");
  assert.equal(actAt(126).name, "whip");
  assert.equal(actAt(144).name, "settle");
  assert.equal(actAt(174).name, "hold");
  assert.equal(actAt(204).name, "back");
  assert.equal(actAt(264).name, "out");
  assert.equal(actAt(359).name, "out");
  assert.throws(() => actAt(1.5), TypeError);

  // The stations: the eye is exactly the module's own far and near eyes on their frames,
  // and each station's own figure is lit to one there.
  assert.deepEqual(sceneAt(FAR_FRAME).eye, FAR_EYE);
  assert.equal(sceneAt(FAR_FRAME).distance, FAR_DISTANCE);
  assert.equal(sceneAt(FAR_FRAME).circleGlow, 1);
  assert.deepEqual(sceneAt(NEAR_FRAME).eye, NEAR_EYE);
  assert.equal(sceneAt(NEAR_FRAME).distance, NEAR_DISTANCE);
  assert.equal(sceneAt(NEAR_FRAME).squareGlow, 1);
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scene = sceneAt(frame);
    if (scene.onLine) {
      assert.equal(scene.eye[0], 0);
      assert.equal(scene.eye[2], EYE_HEIGHT);
      assert.ok(scene.distance >= NEAR_DISTANCE && scene.distance <= FAR_DISTANCE);
    } else {
      assert.equal(scene.distance, null);
      assert.equal(scene.circleGlow, 0);
    }
  }

  // The walk in is monotone and so is the walk out, and each stretch begins exactly where
  // the one before it ended: the staging's walk and turn are continuous at every join.
  for (let frame = 1; frame < NEAR_FRAME; frame += 1) assert.ok(sceneAt(frame).distance <= sceneAt(frame - 1).distance);
  for (let frame = 265; frame < TOTAL_FRAMES; frame += 1) assert.ok(sceneAt(frame).distance >= sceneAt(frame - 1).distance);
  assert.equal(stagingAt(110).walk, 1);
  assert.equal(stagingAt(126).turn, 0);
  assert.equal(stagingAt(144).turn, WHIP_SHARE);
  assert.equal(stagingAt(174).turn, 1);
  assert.equal(stagingAt(204).turn, 1);
  assert.equal(stagingAt(264).turn, 0);
  assert.equal(stagingAt(264).walk, 1);
  // The whip carries nine tenths of the turn in eighteen frames and the settle the rest in
  // thirty, so the reveal arrives fast and comes to rest slowly.
  assert.equal(stagingAt(135).turn, WHIP_SHARE * eased(9 / 18));
  assert.equal(stagingAt(159).turn, WHIP_SHARE + (1 - WHIP_SHARE) * eased(15 / 30));
  assert.ok(stagingAt(135).turn > stagingAt(134).turn);

  /*
   * No cliff. The old staging ran each act's progress to one step short of one, so the
   * walk arrived with speed still on it and the next act's constant stopped it dead. Here
   * the eye's step never falls from a moving one to nothing: measured over every frame of
   * the clip, the largest step is 0.61 of a tower unit, and every step that is followed by
   * a still frame is under a thousandth of it.
   */
  const steps = Array.from({ length: TOTAL_FRAMES }, (unused, frame) => eyeStepAt(frame));
  const largest = Math.max(...steps);
  assert.ok(Math.abs(largest - 0.6076) < 1e-3, `the largest step is ${largest}`);
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const next = steps[(frame + 1) % TOTAL_FRAMES];
    if (next === 0) {
      assert.ok(steps[frame] < largest / 1000, `frame ${frame} stops dead from ${steps[frame]}`);
    }
  }
  // And the move never runs away: no step is more than a fifth of the largest bigger than
  // the one before it.
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const next = steps[(frame + 1) % TOTAL_FRAMES];
    assert.ok(next - steps[frame] < largest / 5, `frame ${frame} jumps from ${steps[frame]} to ${next}`);
  }
  // Control: the fault as it shipped. The old staging eased with smoothstep over an act
  // whose progress ran to one step short of one, so the walk's last step into the station
  // was a real one -- 0.0077 of a tower unit, near four hundred times the step this
  // staging arrives on -- and the next act's constant then stopped it dead.
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const oldLastStep = Math.abs(distanceAtLever(smoothstep(54 / 55)) - distanceAtLever(smoothstep(53 / 55)));
  assert.ok(oldLastStep > 100 * eyeStepAt(NEAR_FRAME - 1), `the old walk arrived at ${oldLastStep}`);
  assert.ok(Math.abs(oldLastStep - 0.0077) < 1e-4);

  assert.deepEqual(sceneAt(TOTAL_FRAMES), sceneAt(0));
  assert.deepEqual(sceneAt(-1), sceneAt(359));
  // The walk spends its frames evenly in 1 / d and returns the stations exactly.
  assert.equal(distanceAtLever(0), FAR_DISTANCE);
  assert.equal(distanceAtLever(1), NEAR_DISTANCE);
  assert.equal(distanceAtLever(0.5), 6);
  assert.throws(() => distanceAtLever(1.1), RangeError);
  // Smootherstep, not smoothstep: both ends are flat in speed and in acceleration.
  assert.equal(eased(0), 0);
  assert.equal(eased(1), 1);
  assert.equal(eased(0.5), 0.5);
  assert.equal(eased(0.25), 0.103515625);
  assert.ok(eased(0.1) < 0.1 * 0.1);
});

test("the arrival beat swells the station's light and falls back, and is not a measurement", () => {
  assert.equal(ARRIVAL_SWELL, 1.9);
  assert.equal(ARRIVAL_FALL, 18);
  assert.equal(arrivalAt(FAR_FRAME), ARRIVAL_SWELL);
  assert.equal(arrivalAt(NEAR_FRAME), ARRIVAL_SWELL);
  assert.equal(arrivalAt(FAR_FRAME + ARRIVAL_FALL), 1);
  assert.equal(arrivalAt(NEAR_FRAME + ARRIVAL_FALL), 1);
  // It falls as the square of the time left, so the swell goes off quickly and lands soft.
  assert.equal(arrivalAt(NEAR_FRAME + 9), 1 + (ARRIVAL_SWELL - 1) * 0.25);
  for (let beat = 1; beat < ARRIVAL_FALL; beat += 1) {
    assert.ok(arrivalAt(NEAR_FRAME + beat) < arrivalAt(NEAR_FRAME + beat - 1));
  }
  // Between the beats it is exactly one, so the glow is the measurement and nothing else.
  for (const frame of [60, 100, 150, 200, 250, 300, 359]) assert.equal(arrivalAt(frame), 1);
  // The glow it multiplies is still the measured one: nothing here touches the deviation.
  assert.equal(sceneAt(NEAR_FRAME).squareGlow, glow(deviationPixels(NEAR_DISTANCE, "square")));
  assert.equal(sceneAt(FAR_FRAME).circleGlow, glow(deviationPixels(FAR_DISTANCE, "circle")));
  assert.equal(sceneAt(NEAR_FRAME).arrival, ARRIVAL_SWELL);
  assert.equal(sceneAt(200).arrival, 1);
});

test("the third eye sets off from the near station, swings round and up, and comes back to it", () => {
  assert.deepEqual(orbitEye(0), NEAR_EYE);
  assert.ok(Math.abs(ORBIT_RADIUS - Math.hypot(0, 4, 1.25)) < 1e-12);
  assert.ok(Math.abs(REVEAL_AZIMUTH - 62 * Math.PI / 180) < 1e-15);
  assert.ok(Math.abs(REVEAL_ELEVATION - 48 * Math.PI / 180) < 1e-15);
  assert.equal(REVEAL_RADIUS, 7);
  const rest = orbitEye(1);
  // Off the stations' line in both ways: across, and above the eyes' height.
  assert.ok(rest[0] > 3);
  assert.ok(rest[2] > EYE_HEIGHT + 3);
  assert.ok(Math.abs(Math.hypot(...subtract(rest, LOOK_AT)) - REVEAL_RADIUS) < 1e-12);
  // The whole hold is one eye: every frame of it is the same picture.
  for (let frame = 174; frame < 204; frame += 1) assert.deepEqual(sceneAt(frame), { ...sceneAt(174), frameIndex: frame });
  // Out and back are the same path at the same turns: the third eye returns by the way it
  // went, with the near station at both ends.
  for (const turn of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const out = orbitEye(turn);
    const back = orbitEye(turn);
    for (let axis = 0; axis < 3; axis += 1) assert.equal(out[axis], back[axis]);
  }
  assert.deepEqual(sceneAt(204).eye, sceneAt(174).eye);
  // The return's last frame is a thousandth of a unit short of the station and the walk
  // out's first frame is the station itself, so the two stretches meet on it.
  assert.ok(Math.hypot(...subtract(sceneAt(263).eye, NEAR_EYE)) < 1e-3);
  assert.deepEqual(sceneAt(264).eye, NEAR_EYE);
  // No jump at the line's edge: the last frame on the line and the first off it agree, and
  // the whip's first step is smaller than its middle one.
  assert.deepEqual(sceneAt(126).eye, sceneAt(125).eye);
  assert.equal(sceneAt(126).fieldOfView, sceneAt(125).fieldOfView);
  assert.equal(sceneAt(126).squareGlow, sceneAt(125).squareGlow);
  assert.ok(eyeStepAt(126) < eyeStepAt(135));
  assert.throws(() => orbitEye(1.5), RangeError);
});

test("the catalog keeps the clause as both editions print it", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "sextus-ho-autos-pyrgos");
  const approved = "ὁ αὐτὸς πύργος πόρρωθεν μὲν φαίνεται στρογγύλος ἐγγύθεν δὲ τετράγωνος";
  assert.equal(quote.text, approved);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 69);
  // No quotation mark and no comma: the two editions differ only in those, at I.32.
  assert.doesNotMatch(quote.text, /[,‘’“”]/u);
  assert.equal(quote.lang, "grc");
  assert.equal(quote.author, "Σέξτος Ἐμπειρικός");
  assert.equal(quote.source, "Pyrrhoniae hypotyposes I.118");
  assert.equal(quote.year, null);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://archive.org/details/sextiempiriciope01sext/page/n62/mode/1up");
  assert.equal(CATALOG.quotes.filter((entry) => entry.lang === "grc").length, 10);
});

test("the notes name both editions, keep the extension as the project's, and say what the floors are", () => {
  // This work's own paragraphs only: the notes run on into the next work's.
  const section = NOTES.slice(
    NOTES.indexOf("The Same Tower starts from"),
    NOTES.indexOf("All on One Circumference starts from")
  );
  assert.ok(section.length > 0 && section.length < NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  assert.match(section, /Mutschmann 1912/u);
  assert.match(section, /Bekker 1842/u);
  assert.match(section, /`στρογγύλος,\] Mutschmann 1912, p\. 12 : στρογγύλος Bekker 1842, p\. 9`/u);
  assert.match(section, /one footprint/u);
  assert.match(section, /The distances, the floors, the walls and the walk are this project's construction/u);
  assert.doesNotMatch(section, /Sextus (?:knew|drew|described) (?:a|the) (?:ambiguous|tower)/u);
  assert.match(section, /the ground floor's swing is \+1\/3 at the front of a corner and −3\/7 at its back/u);
  assert.match(section, /the top floor's, half a unit above the eyes, is −1\/18 and \+1\/14/u);
  assert.match(section, /closes the first section of the fifth mode/u);
  assert.doesNotMatch(section, /closes the fifth mode/u);
  // The related form is quoted from pages that were read, with the editor's supplement marked.
  assert.match(section, /Mutschmann page 78\]\(https:\/\/archive\.org\/details\/sextiempiriciope01sext\/page\/n109\/mode\/1up\) prints `τὸν ⟨αὐτὸν⟩ πύργον ὁτὲ μὲν στρογγύλον, ὁτὲ δὲ τετράγωνον`/u);
  assert.match(section, /Bekker page 69\]\(https:\/\/archive\.org\/details\/sextusempiricus00bekkgoog\/page\/n76\/mode\/1up\) prints `τὸν πύργον ὁτὲ μὲν στρογγύλον ὁτὲ δὲ τετράγωνον`/u);
  // The form is a clip because a reader's hand did not show the trick; the notes say so.
  assert.match(section, /a reader who moved the pointer could not tell what the movement stood for/u);
  assert.match(section, /The two stations lie on one line; the reveal is a third eye/u);
  // The deviation's definition and the numbers under it.
  assert.match(section, /the largest angle, over all eight floors and all 363 vertices/u);
  assert.match(section, /2\.86, 6\.58 and 18\.07 pixels/u);
  assert.match(section, /5\.28, 9\.44 and 15\.11/u);
  assert.match(section, /62 degrees at the near station and 38\.26 at the far/u);
  // The staging as one continuous move, and the fault it was made from.
  assert.match(section, /The staging is one continuous move/u);
  assert.match(section, /whipped round in eighteen — six tenths of a second/u);
  assert.match(section, /Every stretch is smootherstep, whose first and second derivatives vanish at both ends/u);
  assert.match(section, /the stations are moments of zero speed rather than dead stops/u);
  assert.match(section, /two cliffs in it — 0\.39 of a level of grey falling to nought at the end of the walk in, and 0\.65 at the end of the third eye's swing/u);
  assert.match(section, /one jump the other way, from nothing to 1\.04 as the third eye set off/u);
  assert.match(section, /A hundred and forty-five of its three hundred and sixty frames stood still, the longest stretch of them fifty frames/u);
  assert.match(section, /no cliff at all, forty-one frames still, the longest stretch thirty-two, and a peak of 14\.5 against the old 9\.6/u);
  // The arrival beat, said as staging and not as measurement.
  assert.match(section, /an arrival beat/u);
  assert.match(section, /multiplied by nineteen tenths and the multiplier falls back to one over eighteen frames/u);
  assert.match(section, /The glow it multiplies is the measurement and is unchanged; the beat is staging/u);
  // The register is the pentagram's, and the gold is gone.
  assert.match(section, /in Recursive Pentagram's starlight on its ground/u);
  assert.match(section, /the arrival's heart is the only white/u);
  assert.doesNotMatch(section, /Platonic Duals' gold/u);
  assert.doesNotMatch(section, /Night ground/u);
  // The frame the notes name is the frame the manifest carries, and it is in the hold.
  const shown = MANIFEST.artworks.find((entry) => entry.id === "the-same-tower").thumbnail.frame;
  assert.match(section, new RegExp(`The thumbnail is frame ${shown}, the middle of the reveal's hold`, "u"));
  assert.equal(sceneAt(shown).act, "hold");
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "the-same-tower");
  const quote = CATALOG.quotes.find((entry) => entry.id === "sextus-ho-autos-pyrgos");
  assert.equal(artwork.title, "The Same Tower");
  assert.equal(artwork.entry, "p5js/artworks/the-same-tower/index.html");
  assert.equal(artwork.interactivePath, "the-same-tower/");
  assert.deepEqual(artwork.canvas, { width: 680, height: 680 });
  assert.deepEqual(artwork.quoteIds, ["sextus-ho-autos-pyrgos"]);
  // The thumbnail is the middle of the reveal's hold: the third eye, holding.
  assert.deepEqual(artwork.thumbnail, { frame: 190 });
  assert.equal(sceneAt(190).act, "hold");
  assert.equal(sceneAt(190).turn, 1);
  assert.equal(actAt(200).name, "hold");
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/TheSameTower.mp4", durationSeconds: 12, scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `the-same-tower` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 12 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 167);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">The Same Tower</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="grc">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
  // No legend row: the artwork no longer answers to the reader.
  assert.doesNotMatch(NOTES, /\| `the-same-tower` \| pointer \|/u);
});

test("the sketch's whole drawing vocabulary is faces, lines and the eye, and nothing of the lever remains", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), [
    "background", "beginShape", "blendMode", "camera", "createCanvas", "endShape", "fill",
    "frameRate", "line", "linePerspective", "noFill", "noLoop", "noStroke", "perspective",
    "pixelDensity", "pop", "push", "setAttributes", "stroke", "strokeWeight", "vertex"
  ]);
  // No letter, numeral, arrow, hand or nominal figure can reach the frame: nothing that
  // could draw one is ever called.
  for (const forbidden of ["text", "rect", "circle", "ellipse", "arc", "box", "sphere", "cylinder", "image", "createGraphics", "translate"]) {
    assert.ok(!called.has(forbidden), `${forbidden} must not be drawn`);
  }
  // The eye is the sketch's own, and the lever, the legend and the hand are gone.
  assert.doesNotMatch(source, /pinLogicalCamera|drawKeyHint|hint-mode|input-indicator|leverFromPointer|pointerAtLever|mouseX|LANE_/u);
  assert.match(source, /p\.perspective\(scene\.fieldOfView, 1, NEAR_PLANE, FAR_PLANE\)/u);
  assert.match(source, /p\.camera\(\.\.\.onStage\(scene\.eye\), \.\.\.onStage\(scene\.lookAt\), 0, 1, 0\)/u);
  assert.match(source, /p\.linePerspective\(false\)/u);
});

async function loadSketch(search, record) {
  const noop = () => {};
  class RecordingP5 {
    constructor(define) {
      const p = {
        WEBGL: "WEBGL", TRIANGLES: "TRIANGLES", ADD: "ADD", BLEND: "BLEND",
        frameCount: 0,
        drawingContext: { DEPTH_TEST: "DEPTH_TEST", disable: (what) => record.depth.push(["off", what]), enable: (what) => record.depth.push(["on", what]) },
        createCanvas: (...args) => { record.canvas = args; return { parent: noop }; },
        setAttributes: (...args) => record.attributes.push(args),
        linePerspective: (value) => record.linePerspective.push(value),
        pixelDensity: (value) => record.density.push(value),
        frameRate: (value) => record.frameRate.push(value),
        noLoop: noop,
        background: (...colour) => {
          record.background = colour;
          record.lines = []; record.strokes = []; record.weights = []; record.perspective = [];
          record.camera = []; record.fills = []; record.vertices = 0; record.shapes = []; record.blends = []; record.depth = [];
        },
        perspective: (...args) => record.perspective.push(args),
        camera: (...args) => record.camera.push(args),
        beginShape: (mode) => record.shapes.push(mode),
        endShape: noop,
        vertex: () => { record.vertices += 1; },
        fill: (...colour) => record.fills.push(colour),
        blendMode: (mode) => record.blends.push(mode),
        noFill: noop, noStroke: noop, push: noop, pop: noop,
        stroke: (...colour) => record.strokes.push(colour),
        strokeWeight: (weight) => record.weights.push(weight),
        line: (...args) => record.lines.push(args)
      };
      define(p);
      record.p = p;
      p.setup();
    }
  }
  globalThis.window = { p5: RecordingP5, location: { search } };
  await import(`${SKETCH_URL.href}?${search.slice(1)}`);
}

function freshRecord() {
  return {
    attributes: [], linePerspective: [], density: [], frameRate: [],
    lines: [], strokes: [], weights: [], perspective: [], camera: [], fills: [], vertices: 0, shapes: [], blends: [], depth: []
  };
}

test("an export frame draws the walls, the four hairlines and the floors under the module's eye, and the glow at a station", async () => {
  const priorWindow = globalThis.window;
  const record = freshRecord();
  const wallCount = (FLOOR_COUNT - 1) * (RIM_SEGMENTS + 2);
  const floorLines = FLOOR_COUNT * (RIM_SEGMENTS + 2);
  try {
    await loadSketch("?capture=1&renderScale=2", record);
    assert.deepEqual(record.canvas, [1360, 1360, "WEBGL"]);
    assert.deepEqual(record.attributes, [["preserveDrawingBuffer", true]]);
    assert.deepEqual(record.linePerspective, [false]);
    assert.deepEqual(record.density, [1]);
    assert.deepEqual(record.frameRate, [30]);
    // At load: the far station, one canvas, the circle's glow full on and the arrival's
    // swell over it.
    assert.deepEqual(record.background, [10, 12, 18]);
    assert.deepEqual(record.perspective, [[fieldOfView(FAR_DISTANCE), 1, 50, 4000]]);
    assert.deepEqual(record.camera, [[0, -300, 1200, 0, -175, 0, 0, 1, 0]]);
    assert.deepEqual(record.shapes, ["TRIANGLES"]);
    assert.equal(record.vertices, 6 * wallCount);
    assert.equal(record.fills.length, wallCount);
    assert.ok(record.fills.every((colour) => colour.length === 4 && colour[3] === 46));
    // A wall's face is the same starlight as the lines, dimmed by the two lights and by
    // nothing else: every face is that one colour scaled, and the brightest is all of it.
    const ofStarlight = (colour) =>
      Math.abs(colour[0] / 202 - colour[1] / 192) < 1e-9 && Math.abs(colour[0] / 202 - colour[2] / 232) < 1e-9;
    assert.ok(record.fills.every(ofStarlight), "a wall's face must be starlight at some brightness");
    const brightest = Math.max(...record.fills.map((colour) => colour[0] / 202));
    assert.ok(brightest > 0.99 && brightest <= 1.05, `the brightest wall is ${brightest} of starlight`);
    assert.deepEqual(record.blends, ["ADD", "BLEND"]);
    assert.deepEqual(record.depth, [["off", "DEPTH_TEST"], ["on", "DEPTH_TEST"]]);
    // Four hairlines, the floors once, the floors four times more as halo, and once as the
    // arrival's white heart.
    assert.equal(record.lines.length, 4 + floorLines * (1 + 4 + 1));
    assert.deepEqual(record.strokes[0], [202, 192, 232, 235]);
    assert.deepEqual(record.strokes[1], [202, 192, 232, 235]);
    assert.equal(record.weights[0], 2.8);
    // Four halo passes in starlight at the swollen strength, and one white heart over them.
    assert.equal(record.strokes.length, 2 + 4 + 1);
    assert.ok(record.strokes.slice(2, 6).every((colour) => Math.abs(colour[3] - 255 * 0.045 * ARRIVAL_SWELL) < 1e-9));
    assert.ok(record.strokes.slice(2, 6).every((colour) => colour[0] === 202 && colour[1] === 192 && colour[2] === 232));
    assert.deepEqual(record.strokes[6].slice(0, 3), [248, 250, 255]);
    assert.ok(Math.abs(record.strokes[6][3] - 255 * (ARRIVAL_SWELL - 1) * 0.05) < 1e-9);
    assert.equal(record.weights[6], 1.4 * 1.6 * 2);

    const state = await window.__renderFrame(200);
    const scene = sceneAt(200);
    assert.equal(state.kind, "video");
    assert.equal(state.frameIndex, 200);
    assert.equal(state.totalFrames, 360);
    assert.equal(state.durationSeconds, 12);
    assert.equal(state.act, "hold");
    assert.equal(state.arrival, 1);
    assert.equal(state.onLine, false);
    assert.equal(state.distance, null);
    assert.deepEqual(state.eye, scene.eye);
    assert.equal(state.walls, wallCount);
    assert.equal(state.palette, "starlight");
    assert.deepEqual(state.outputSize, { width: 1360, height: 1360 });
    // Off the line at the rest: no glow, so no halo pass at all.
    assert.deepEqual(record.blends, []);
    assert.equal(record.lines.length, 4 + floorLines);
    assert.deepEqual(record.camera, [[scene.eye[0] * STAGE_SCALE, -scene.eye[2] * STAGE_SCALE, -scene.eye[1] * STAGE_SCALE, 0, -175, 0, 0, 1, 0]]);
    assert.deepEqual(record.perspective, [[scene.fieldOfView, 1, 50, 4000]]);

    const near = await window.__renderFrame(NEAR_FRAME);
    assert.equal(near.squareGlow, 1);
    assert.equal(near.arrival, ARRIVAL_SWELL);
    assert.deepEqual(record.camera, [[0, -300, 400, 0, -175, 0, 0, 1, 0]]);
    assert.deepEqual(record.perspective, [[NEAR_FIELD_OF_VIEW, 1, 50, 4000]]);
    // The station's own frame: the swell is on, so the heart is drawn there too.
    assert.equal(record.lines.length, 4 + floorLines * (1 + 4 + 1));

    // The frame before it, off the beat: all but at the station, and the measured glow
    // alone, with no heart over it.
    const beforeTheBeat = await window.__renderFrame(NEAR_FRAME - 1);
    assert.equal(beforeTheBeat.arrival, 1);
    assert.ok(beforeTheBeat.squareGlow > 0.99);
    assert.equal(record.lines.length, 4 + floorLines * (1 + 4));

    const opening = await window.__renderFrame(0);
    assert.deepEqual({ ...await window.__renderFrame(360), frameIndex: 0 }, opening);
    // The clip's last frame is a step short of its first, and the first is where the walk
    // out lands and the arrival's swell fires: the loop closes on the far station.
    const last = await window.__renderFrame(359);
    assert.equal(last.act, "out");
    assert.ok(last.walk < 1e-4 && last.walk > 0);
    assert.equal(last.arrival, 1);
    assert.equal(opening.arrival, ARRIVAL_SWELL);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

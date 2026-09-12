import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACTS,
  ACT_FRAMES,
  CHART_EDGE_LATITUDE,
  COURSES,
  COURSE_MAXIMUM_SAMPLES,
  COURSE_MINIMUM_SAMPLES,
  COURSE_PSI_END,
  DURATION_SECONDS,
  FLATNESS_FLOOR,
  FRAME_FILL,
  LOGICAL_SIZE,
  MAXIMUM_BEARING,
  MERIDIAN_STEP,
  OPENING_BEARING,
  PLAYBACK_FPS,
  SPHERE_SCALE,
  SPIN_FRAMES,
  TOTAL_FRAMES,
  UNWOUND_BEARING,
  actAt,
  courseChordLength,
  courseCurve,
  courseLength,
  courseLongitude,
  courseOrigins,
  courseSamples,
  courseTurns,
  degrees,
  depthFloor,
  figureFrame,
  graticuleBox,
  graticuleCurves,
  greatCircleBearing,
  greatCirclePoints,
  isometricLatitude,
  latitudeFromIsometric,
  measuredBearing,
  meridianLongitudes,
  morphAt,
  morphPoint,
  parallelLatitudes,
  sceneAt,
  spherePoint,
  splitByDepth,
  viewCurve,
  viewPoint,
  wrapLongitude
} from "../artworks/loxodrome/loxodrome.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const README = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const SKETCH = readFileSync(new URL("../artworks/loxodrome/sketch.js", import.meta.url), "utf8");
const INDEX_HTML = readFileSync(new URL("../artworks/loxodrome/index.html", import.meta.url), "utf8");

const APPROVED_QUOTE = "The voyage of the best ship is a zigzag line of a hundred tacks. \u2026 "
  + "See the line from a sufficient distance, and it straightens itself to the average tendency.";
/** What the ellipsis stands in for, which both 1841 printings carry and the revision drops. */
const ELIDED_SENTENCE = "This is only microscopic criticism.";

const BEARINGS = [15, 45, 75];
const LATITUDES = [-80, -60, -30, 0, 30, 60, 80];
const inDegrees = (radians) => radians * 180 / Math.PI;

/** The perpendicular distance of the farthest point from the line through the ends. */
function strayFromStraight(points) {
  const [first] = points;
  const last = points.at(-1);
  const runX = last[0] - first[0];
  const runY = last[1] - first[1];
  const length = Math.hypot(runX, runY);
  let worst = 0;
  for (const [x, y] of points) {
    worst = Math.max(worst, Math.abs((x - first[0]) * runY - (y - first[1]) * runX) / length);
  }
  return worst;
}

function chartPoints(bearing, project, samples = 600) {
  const from = degrees(-80);
  const to = degrees(80);
  const points = [];
  for (let index = 0; index <= samples; index += 1) {
    const phi = from + (to - from) * index / samples;
    points.push(project(phi, courseLongitude(isometricLatitude(phi), bearing, 0)));
  }
  return points;
}

test("the acts cover the clip and it comes home to the station it opened on", () => {
  assert.equal(ACT_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, PLAYBACK_FPS * DURATION_SECONDS);
  assert.equal(DURATION_SECONDS, 12);
  assert.deepEqual(
    ACTS.map(([name]) => name),
    ["globe", "pole", "back", "unwind", "wind", "open", "chart", "close"]
  );
  assert.equal(actAt(0).name, "globe");
  assert.equal(actAt(TOTAL_FRAMES - 1).name, "close");
  assert.equal(actAt(TOTAL_FRAMES).name, "globe");

  const first = sceneAt(0);
  const last = sceneAt(TOTAL_FRAMES - 1);
  // The same figure, the same lens, and a turn of the globe that is a whole revolution.
  assert.equal(last.open, first.open);
  assert.equal(last.bearing, first.bearing);
  assert.equal(last.tilt, first.tilt);
  assert.equal(last.scale, first.scale);
  assert.equal(first.spin, 0);
  assert.equal(last.spin, 2 * Math.PI);
  assert.ok(Math.abs(Math.cos(last.spin) - 1) < 1e-15);
  assert.ok(Math.abs(Math.sin(last.spin)) < 1e-15);
  // The globe's turn is spent before the chart opens, so the chart does not scroll.
  assert.equal(sceneAt(SPIN_FRAMES - 1).spin, 2 * Math.PI);
  assert.equal(sceneAt(SPIN_FRAMES).spin, 2 * Math.PI);
  assert.equal(sceneAt(SPIN_FRAMES).act, "open");

  // Each act arrives where the next sets off from: no jolt at any seam of the staging.
  let start = 0;
  for (const [name, frames] of ACTS) {
    const ending = sceneAt(start + frames - 1);
    const next = sceneAt((start + frames) % TOTAL_FRAMES);
    assert.ok(Math.abs(ending.open - next.open) < 1e-12, `${name} jumps in the opening`);
    assert.ok(Math.abs(ending.bearing - next.bearing) < 1e-12, `${name} jumps in the bearing`);
    assert.ok(Math.abs(ending.tilt - next.tilt) < 1e-12, `${name} jumps in the tilt`);
    start += frames;
  }
});

test("the bearing is the same wherever the course is measured", () => {
  // Measured from three-dimensional positions and the local east and north, which know
  // nothing of the longitude having been built to be affine in the chart's height.
  let worst = 0;
  for (const bearing of BEARINGS) {
    for (const latitude of LATITUDES) {
      const measured = inDegrees(measuredBearing(degrees(latitude), degrees(bearing)));
      worst = Math.max(worst, Math.abs(measured - bearing));
      assert.equal(measured.toFixed(6), bearing.toFixed(6));
    }
  }
  assert.ok(worst < 1e-8, `the worst departure was ${worst}`);

  // A second opinion from a second formula: the spherical initial bearing, which is
  // one-sided and so agrees to fewer places rather than to none.
  for (const bearing of BEARINGS) {
    const phi = degrees(30);
    const step = 1e-6;
    const at = (value) => [value, courseLongitude(isometricLatitude(value), degrees(bearing), 0)];
    const initial = inDegrees(greatCircleBearing(at(phi), at(phi + step)));
    assert.ok(Math.abs(initial - bearing) < 1e-3, `${bearing} read as ${initial}`);
  }

  // The control, and the thing a rhumb line is not: the shorter way between the same
  // two places holds no bearing at all.
  const great = greatCirclePoints([degrees(-60), degrees(-100)], [degrees(60), degrees(100)], 400);
  const along = [];
  for (let index = 0; index < great.length - 1; index += 1) {
    along.push(inDegrees(greatCircleBearing(great[index], great[index + 1])));
  }
  const spread = Math.max(...along) - Math.min(...along);
  assert.ok(spread > 50, `the great circle's bearing only varied by ${spread} degrees`);
  assert.equal(spread.toFixed(3), "51.696");
});

test("the length is finite and the winding is not", () => {
  const bearing = degrees(75);
  const from = degrees(-80);
  const turns = [89.9, 89.99, 89.9999, 89.999999]
    .map((latitude) => courseTurns(bearing, from, degrees(latitude)));
  assert.deepEqual(
    turns.map((value) => value.toFixed(4)),
    ["5.6310", "6.9987", "9.7340", "12.4694"]
  );
  // Ten times nearer the pole costs the same further turns every time, so there is no
  // number of turns the course does not pass.
  const perDecade = Math.tan(bearing) * Math.log(10) / (2 * Math.PI);
  assert.equal(perDecade.toFixed(4), "1.3677");
  assert.ok(Math.abs((turns[1] - turns[0]) - perDecade) < 1e-6);
  assert.ok(Math.abs((turns[2] - turns[1]) / 2 - perDecade) < 1e-6);
  assert.ok(Math.abs((turns[3] - turns[2]) / 2 - perDecade) < 1e-6);

  // And the length over all of it is a finite number the same stretch converges on.
  const toThePole = courseLength(bearing, from, Math.PI / 2);
  assert.equal(toThePole.toFixed(6), "11.463838");
  assert.ok(courseLength(bearing, from, degrees(89.999999)) < toThePole);
  assert.ok(toThePole - courseLength(bearing, from, degrees(89.999999)) < 1e-6);

  // Measured instead: the chords of a polyline along the course, which approach the
  // length from below and quarter their shortfall each time the polyline is refined.
  for (const value of BEARINGS) {
    const exact = courseLength(degrees(value), from, degrees(89.9));
    const shortfalls = [1000, 2000, 4000].map(
      (steps) => (exact - courseChordLength(degrees(value), from, degrees(89.9), steps)) / exact
    );
    assert.ok(shortfalls[0] > 0 && shortfalls[2] > 0, "the chords overshot the length");
    assert.ok(shortfalls[2] < 1e-4, `${value} degrees was still out by ${shortfalls[2]}`);
    for (const index of [0, 1]) {
      const ratio = shortfalls[index] / shortfalls[index + 1];
      assert.ok(ratio > 3.2 && ratio < 4.3, `${value} degrees converged at ${ratio}`);
    }
  }

  // The control: the meridian itself, which is the same construction at nought bearing
  // and reaches the pole without going round it once.
  assert.equal(courseTurns(0, from, degrees(89.999999)), 0);
  assert.equal(courseLength(0, from, Math.PI / 2).toFixed(6), (Math.PI / 2 - from).toFixed(6));
});

test("the chart straightens the course, and has no room left for the pole", () => {
  const mercator = (phi, lambda) => [lambda, isometricLatitude(phi)];
  const equirectangular = (phi, lambda) => [lambda, phi];

  for (const value of BEARINGS) {
    const straight = strayFromStraight(chartPoints(degrees(value), mercator));
    assert.ok(straight < 1e-14, `${value} degrees strayed by ${straight} on the chart`);
    // The control: the same course on a sheet ruled in latitude rather than in the
    // chart's own coordinate is not straight, by a margin nothing could round away.
    const flat = strayFromStraight(chartPoints(degrees(value), equirectangular));
    assert.ok(flat > 0.12, `${value} degrees strayed by only ${flat} on plain latitude`);
  }
  assert.equal(
    strayFromStraight(chartPoints(degrees(45), equirectangular)).toFixed(6),
    "0.258906"
  );

  // And the other control: the shorter way, which the chart does not straighten.
  const great = greatCirclePoints([degrees(-60), degrees(-100)], [degrees(60), degrees(100)], 400);
  const bent = strayFromStraight(great.map(([phi, lambda]) => [lambda, isometricLatitude(phi)]));
  assert.ok(bent > 1, `the great circle strayed by only ${bent}`);
  assert.equal(bent.toFixed(6), "1.892268");

  // The price. A further decimal place of latitude costs a further ln 10 of paper,
  // always the same amount, so no sheet of any height carries the pole.
  const heights = [89.9, 89.99, 89.999, 89.9999].map((latitude) => isometricLatitude(degrees(latitude)));
  assert.deepEqual(
    heights.map((value) => value.toFixed(6)),
    ["7.043959", "9.346544", "11.649129", "13.951715"]
  );
  const overshoot = [];
  for (let index = 1; index < heights.length; index += 1) {
    const decade = heights[index] - heights[index - 1];
    assert.ok(Math.abs(decade - Math.log(10)) < 1e-6);
    overshoot.push(Math.abs(decade - Math.log(10)));
  }
  // Approached rather than assumed: the cost of a decade settles on ln 10 from above,
  // which is what makes it a constant price rather than a coincidence of three readings.
  for (let index = 1; index < overshoot.length; index += 1) {
    assert.ok(overshoot[index] < overshoot[index - 1] / 10);
  }
  // The edge the grid is drawn to is a finite height; the course is drawn past it.
  const edge = isometricLatitude(CHART_EDGE_LATITUDE);
  assert.equal(edge.toFixed(6), "3.131301");
  assert.ok(COURSE_PSI_END > edge, "the courses stop before the chart's own edge");
});

test("the chart's coordinate answers to two formulas and to its own inverse", () => {
  // ln tan(PI/4 + phi/2) is what the piece is built on; asinh(tan phi) is the same
  // function by an identity that shares none of its arithmetic.
  let worst = 0;
  let worstRound = 0;
  for (let latitude = -89.9; latitude <= 89.9; latitude += 0.05) {
    const phi = degrees(latitude);
    worst = Math.max(worst, Math.abs(isometricLatitude(phi) - Math.asinh(Math.tan(phi))));
    worstRound = Math.max(worstRound, Math.abs(latitudeFromIsometric(isometricLatitude(phi)) - phi));
  }
  assert.ok(worst < 1e-12, `the two formulas differed by ${worst}`);
  assert.ok(worstRound < 1e-12, `the round trip lost ${worstRound}`);
  // The tangent of a quarter of PI is not exactly one in floating point, so the chart's
  // origin is a hair off nought rather than on it.
  assert.ok(Math.abs(isometricLatitude(0)) < 1e-15);
  assert.ok(Math.abs(latitudeFromIsometric(0)) < 1e-15);
  // Strictly increasing, which is why the inverse exists and why the course's longitude
  // can be affine in it.
  let previous = -Infinity;
  for (let latitude = -89; latitude <= 89; latitude += 1) {
    const value = isometricLatitude(degrees(latitude));
    assert.ok(value > previous);
    previous = value;
  }
});

test("the morph is the globe at one end, the chart's cylinder in the middle, and paper at the other", () => {
  assert.deepEqual(morphAt(0), { sphereness: 1, wrap: 1 });
  assert.deepEqual(morphAt(1), { sphereness: 0, wrap: 0 });
  const middle = morphAt(0.5);
  assert.ok(Math.abs(middle.sphereness) < 1e-12);
  assert.ok(Math.abs(middle.wrap - 1) < 1e-12);

  for (const latitude of LATITUDES) {
    for (const longitude of [-150, -60, 0, 45, 170]) {
      const phi = degrees(latitude);
      const lambda = degrees(longitude);
      // The globe.
      const globe = morphPoint(phi, lambda, 1, 1);
      const sphere = spherePoint(phi, lambda);
      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(Math.abs(globe[axis] - sphere[axis]) < 1e-15);
      }
      assert.ok(Math.abs(Math.hypot(...globe) - 1) < 1e-15);
      // The chart's cylinder: a unit circle at the chart's own height.
      const cylinder = morphPoint(phi, lambda, 0, 1);
      assert.ok(Math.abs(Math.hypot(cylinder[0], cylinder[2]) - 1) < 1e-15);
      assert.ok(Math.abs(cylinder[1] - isometricLatitude(phi)) < 1e-15);
      // The sheet: longitude across, the chart's height up, one flat plane.
      const sheet = morphPoint(phi, lambda, 0, 0);
      assert.ok(Math.abs(sheet[0] - lambda) < 1e-15);
      assert.ok(Math.abs(sheet[1] - isometricLatitude(phi)) < 1e-15);
      assert.equal(sheet[2], 1);
    }
  }

  // The bend reaches its own limit rather than being cut off at one: the gap between a
  // sheet bent onto a cylinder of radius 1/w and flat paper falls by ten every time w
  // does, across the radius at which the arithmetic changes hands.
  const flat = morphPoint(degrees(40), degrees(170), 0, 0);
  const gaps = [1e-2, 1e-3, 1e-4, 1e-5].map((wrap) => {
    const bent = morphPoint(degrees(40), degrees(170), 0, wrap);
    return Math.hypot(bent[0] - flat[0], bent[1] - flat[1], bent[2] - flat[2]);
  });
  for (let index = 1; index < gaps.length; index += 1) {
    const ratio = gaps[index - 1] / gaps[index];
    assert.ok(ratio > 9.5 && ratio < 10.5, `the bend closed at ${ratio} rather than ten`);
  }
});

test("the chart cuts the course where it crosses the date line, and the globe does not", () => {
  const origin = courseOrigins()[0];
  const pieces = courseCurve(OPENING_BEARING, origin);
  assert.ok(pieces.length > 1, "a winding course was left in one piece");

  // Every cut is a pair of points that are one place on the globe and two edges on the
  // chart: the same latitude, and the two ends of the same turn.
  const globe = { sphereness: 1, wrap: 1, spin: 0, tilt: 0, centre: [0, 0, 0], scale: 1 };
  const sheet = { sphereness: 0, wrap: 0, spin: 0, tilt: 0, centre: [0, 0, 0], scale: 1 };
  for (let index = 0; index < pieces.length - 1; index += 1) {
    const leaving = pieces[index].at(-1);
    const arriving = pieces[index + 1][0];
    assert.equal(leaving[0], arriving[0]);
    assert.ok(Math.abs(leaving[1] - Math.PI) < 1e-12);
    assert.ok(Math.abs(arriving[1] + Math.PI) < 1e-12);
    const [before] = viewCurve([leaving], globe);
    const [after] = viewCurve([arriving], globe);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(before[axis] - after[axis]) < 1e-12, "the globe shows the cut");
    }
    const [left] = viewCurve([leaving], sheet);
    const [right] = viewCurve([arriving], sheet);
    assert.ok(Math.abs(left[0] - right[0]) > 6, "the chart does not part at the cut");
  }

  // No piece has a jump in it, on the globe or on the chart. The control is the same
  // course wrapped without the crossings put in, which leaps the width of the sheet.
  for (const [scene, limit] of [[globe, 0.2], [sheet, 0.6]]) {
    for (const piece of pieces) {
      const drawn = viewCurve(piece, scene);
      for (let index = 1; index < drawn.length; index += 1) {
        const step = Math.hypot(
          drawn[index][0] - drawn[index - 1][0],
          drawn[index][1] - drawn[index - 1][1],
          drawn[index][2] - drawn[index - 1][2]
        );
        assert.ok(step < limit, `a piece jumps by ${step}`);
      }
    }
  }
  const naive = [];
  const samples = courseSamples(OPENING_BEARING);
  for (let index = 0; index <= samples; index += 1) {
    const psi = -COURSE_PSI_END + 2 * COURSE_PSI_END * index / samples;
    naive.push([latitudeFromIsometric(psi), wrapLongitude(courseLongitude(psi, OPENING_BEARING, origin))]);
  }
  const drawnNaive = viewCurve(naive, sheet);
  let worstNaive = 0;
  for (let index = 1; index < drawnNaive.length; index += 1) {
    worstNaive = Math.max(worstNaive, Math.abs(drawnNaive[index][0] - drawnNaive[index - 1][0]));
  }
  assert.ok(worstNaive > 6, `wrapping without the crossings only jumped ${worstNaive}`);
});

test("the far half is drawn fainter, and stops being a half before the sheet is flat", () => {
  // The defect this floor exists for, frozen: with the cut taken at nought, the turn
  // applied to a flat sheet leaves a depth of a few parts in ten thousand million of a
  // pixel whose sign follows the side of the sheet, and the chart came out bright on one
  // side and faint on the other.
  const chart = sceneAt(300);
  assert.equal(chart.act, "chart");
  const meridians = graticuleCurves().filter((curve) => curve.kind === "meridian");
  const sides = new Set();
  for (const curve of meridians) {
    for (const run of splitByDepth(viewCurve(curve.points, chart), 0)) {
      sides.add(run.near);
    }
  }
  assert.equal(sides.size, 2, "the flat chart did not split on the noise it used to split on");

  const floored = new Set();
  for (const curve of meridians) {
    for (const run of splitByDepth(viewCurve(curve.points, chart), depthFloor(chart.scale))) {
      floored.add(run.near);
    }
  }
  assert.deepEqual([...floored], [true], "the flat chart still has a far half");
  assert.equal(chart.roundness, 0);

  // The globe does have one, and the cut is where the silhouette is.
  const globe = sceneAt(0);
  const both = new Set();
  for (const curve of graticuleCurves()) {
    for (const run of splitByDepth(viewCurve(curve.points, globe), depthFloor(globe.scale))) {
      both.add(run.near);
    }
  }
  assert.deepEqual([...both].sort(), [false, true]);
  assert.equal(globe.roundness, 1);
  assert.ok(FLATNESS_FLOOR > 0 && FLATNESS_FLOOR < 1e-3);

  // And the weight of the difference is gone well before the sheet is.
  assert.equal(figureFrame(0.5).roundness, 1);
  assert.ok(figureFrame(0.9).roundness < 0.01);
  assert.equal(figureFrame(1).roundness, 0);
});

test("the grid fits the frame at every frame of the clip, and the courses run off it", () => {
  const curves = graticuleCurves();
  const half = LOGICAL_SIZE / 2;
  let tightest = 0;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scene = sceneAt(frame);
    let reach = 0;
    for (const curve of curves) {
      for (const point of viewCurve(curve.points, scene)) {
        reach = Math.max(reach, Math.abs(point[0]), Math.abs(point[1]));
      }
    }
    assert.ok(reach <= half, `frame ${frame} reaches ${reach} of ${half}`);
    tightest = Math.max(tightest, reach);
  }
  // Not vacuous: some frame nearly fills the canvas, so the fit is a fit rather than a
  // blanket shrink. Every frame is measured, because the frame that overruns is exactly
  // the one a sampled sweep would step over.
  assert.ok(tightest > half * FRAME_FILL * 0.98, `the figure never got past ${tightest}`);

  // The courses are drawn past the chart's edge and off the sheet: that overflow is the
  // pole leaving the picture, so the frame is fitted to the grid and not to them.
  const chart = sceneAt(300);
  const course = viewCurve(courseCurve(chart.bearing, courseOrigins()[0])[0], chart);
  assert.ok(
    course.some((point) => Math.abs(point[1]) > half),
    "no course leaves the sheet"
  );
});

test("a course stops where its own turns close up, not where the geometry does", () => {
  // One turn carries the course 2 PI / tan(bearing) up the chart while the globe's circle
  // of latitude shrinks; the drawing stops where the two put successive turns one logical
  // pixel apart.
  assert.equal(SPHERE_SCALE, LOGICAL_SIZE * FRAME_FILL / 2);
  const latitude = latitudeFromIsometric(COURSE_PSI_END);
  assert.equal(inDegrees(latitude).toFixed(5), "89.91432");
  assert.ok(
    Math.abs(Math.cos(latitude) - Math.tan(OPENING_BEARING) / (2 * Math.PI * SPHERE_SCALE)) < 1e-15
  );
  // Which is a stopping place well past the chart's edge and well short of the pole.
  assert.ok(latitude < Math.PI / 2);
  assert.ok(latitude > CHART_EDGE_LATITUDE);
  assert.equal(COURSE_PSI_END.toFixed(6), "7.198463");

  // The sampling follows the bearing, because a tighter coil needs more of it.
  assert.ok(courseSamples(UNWOUND_BEARING) < courseSamples(OPENING_BEARING));
  assert.equal(courseSamples(UNWOUND_BEARING), COURSE_MINIMUM_SAMPLES);
  assert.equal(courseSamples(MAXIMUM_BEARING), COURSE_MAXIMUM_SAMPLES);
  assert.equal(courseSamples(OPENING_BEARING), 756);
});

test("six courses, evenly spaced and off the grid's own longitudes", () => {
  const origins = courseOrigins();
  assert.equal(origins.length, COURSES);
  assert.equal(COURSES, 6);
  for (let index = 1; index < origins.length; index += 1) {
    assert.ok(Math.abs(origins[index] - origins[index - 1] - 2 * Math.PI / COURSES) < 1e-12);
  }
  // None of them sets out on a meridian, so no crossing of the two families is one of
  // them starting where the other does.
  const meridians = meridianLongitudes();
  for (const origin of origins) {
    for (const meridian of meridians) {
      assert.ok(Math.abs(wrapLongitude(origin - meridian)) > MERIDIAN_STEP / 4);
    }
  }
  assert.equal(parallelLatitudes().length, 11);
  assert.equal(meridians.length, 12);
  // The grid stops at the chart's edge; only the courses go any nearer the pole.
  for (const curve of graticuleCurves()) {
    for (const [phi] of curve.points) {
      assert.ok(Math.abs(phi) <= CHART_EDGE_LATITUDE + 1e-12);
    }
  }
});

test("the figure is a globe of radius one, and a sheet a turn wide", () => {
  const globe = graticuleBox(0);
  assert.ok(Math.abs(globe.size[0] - 2) < 1e-12);
  assert.ok(Math.abs(globe.size[2] - 2) < 1e-12);
  assert.ok(Math.abs(globe.size[1] - 2 * Math.sin(CHART_EDGE_LATITUDE)) < 1e-12);
  const sheet = graticuleBox(1);
  assert.ok(Math.abs(sheet.size[0] - 2 * Math.PI) < 1e-12);
  assert.ok(Math.abs(sheet.size[1] - 2 * isometricLatitude(CHART_EDGE_LATITUDE)) < 1e-12);
  assert.equal(sheet.size[2], 0);
  // Both fill the same square: the globe's diameter and the chart's width are one length.
  assert.equal(figureFrame(0).scale * 2, LOGICAL_SIZE * FRAME_FILL);
  assert.ok(Math.abs(figureFrame(1).scale * 2 * Math.PI - LOGICAL_SIZE * FRAME_FILL) < 1e-12);

  // The view turns the figure and reads depth off the third component.
  const point = viewPoint([0, 0, 1], 0, 0, [0, 0, 0], 1);
  assert.deepEqual(point.map((part) => Number(part.toFixed(12))), [0, 0, 1]);
  const quarter = viewPoint([0, 0, 1], Math.PI / 2, 0, [0, 0, 0], 1);
  assert.ok(Math.abs(quarter[0] - 1) < 1e-12);
  assert.ok(Math.abs(quarter[2]) < 1e-12);
});

test("the sketch draws the module's points and prints the legend", () => {
  assert.match(SKETCH, /from "\.\/loxodrome\.js"/u);
  // The projection is the module's, so what is left for the sketch is stroking polylines,
  // and the canvas is the plain one. p5's WEBGL renderer builds a stroke's geometry per
  // vertex in JavaScript, which this figure's thirteen thousand points a frame cannot
  // afford; the measurement is in the sketch's own note.
  assert.match(SKETCH, /p\.createCanvas\(OUTPUT_SIZE, OUTPUT_SIZE\)/u);
  assert.doesNotMatch(SKETCH, /p\.WEBGL/u);
  assert.doesNotMatch(SKETCH, /createGraphics/u);
  assert.match(SKETCH, /globalCompositeOperation = "lighter"/u);
  assert.match(SKETCH, /context\.scale\(1, -1\)/u);
  // Added ink accumulates between strokes and not within one, so each run is stroked on
  // its own — which is what leaves the blaze on the poles.
  assert.match(SKETCH, /for \(const run of runs\) \{[\s\S]*?context\.beginPath\(\);[\s\S]*?context\.stroke\(\);\n {4}\}/u);
  assert.match(SKETCH, /splitByDepth\(viewCurve\(points, scene\), floor\)/u);
  assert.match(SKETCH, /depthFloor\(scene\.scale\)/u);
  assert.match(SKETCH, /return Promise\.resolve\(publishState\(/u);
  assert.match(SKETCH, /drawKeyHint\(/u);
  // Three controls, in the order the clip performs them.
  assert.match(SKETCH, /\{ cap: "drag", text: "turn the globe" \}/u);
  assert.match(SKETCH, /\{ cap: "← →", text: "change the bearing" \}/u);
  assert.match(SKETCH, /\{ cap: "space", text: "unroll the chart" \}/u);
  assert.match(SKETCH, /p\.keyIsDown\(p\.LEFT_ARROW\)/u);
  assert.match(SKETCH, /p\.keyIsDown\(p\.RIGHT_ARROW\)/u);
  assert.match(SKETCH, /live\.openTarget = live\.openTarget > 0\.5 \? 0 : 1/u);
  assert.match(SKETCH, /p\.mouseDragged = \(\) =>/u);
  // No lettering, no pointing, no furniture of a textbook figure.
  assert.doesNotMatch(SKETCH, /p\.text\(/u);
  assert.doesNotMatch(SKETCH, /p\.sphere\(|p\.arc\(|p\.triangle\(/u);
  assert.doesNotMatch(SKETCH, /drawPointerIndicator|drawKeyIndicator/u);
  assert.match(INDEX_HTML, /<title>Loxodrome<\/title>/u);
});

test("the catalog keeps the 1841 reading, letter for letter", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "emerson-zigzag-line");
  assert.equal(quote.text, APPROVED_QUOTE);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 158);
  assert.equal(quote.lang, "en");
  assert.equal(quote.author, "Ralph Waldo Emerson");
  assert.equal(quote.source, "Essays: First Series — Self-Reliance");
  assert.equal(quote.year, 1841);
  assert.equal(quote.publicDomain, true);
  assert.equal(
    quote.sourceUrl,
    "https://archive.org/details/emersonralessays00emerrich/page/n60/mode/1up"
  );
  assert.equal(quote.original, undefined, "the registered wording is the printed one");
  // In 1841 the two sentences are not neighbours, and what stands between them is the
  // sentence the later revision drops. An ellipsis says so; a join would not.
  assert.ok(!quote.text.includes(ELIDED_SENTENCE));
  assert.equal(quote.text.split("…").length, 2, "the elision is marked once");
  assert.match(NOTES, new RegExp(ELIDED_SENTENCE.replace(".", "\\."), "u"));
  assert.equal(CATALOG.quotes.filter((entry) => entry.author === "Ralph Waldo Emerson").length, 2);
});

test("the notes give the numbers the tests hold and keep the two straightenings apart", () => {
  const section = NOTES.slice(NOTES.indexOf("Loxodrome starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes have no section for this artwork");
  assert.match(section, /change of sheet/u);
  assert.doesNotMatch(section, /Emerson (?:describes|names|knew) (?:the |a )?(?:rhumb|loxodrome|projection)/u);
  assert.match(section, /4\.2 × 10⁻⁹ degrees/u);
  assert.match(section, /5\.6310/u);
  assert.match(section, /12\.4694/u);
  assert.match(section, /1\.3677/u);
  assert.match(section, /11\.463838/u);
  assert.match(section, /0\.258906/u);
  assert.match(section, /1\.892268/u);
  assert.match(section, /51\.696/u);
  assert.match(section, /7\.043959/u);
  assert.match(section, /2\.302585/u);
  assert.match(section, /89\.91432/u);
  assert.match(section, /The thumbnail is frame 90/u);
  assert.match(section, /137 milliseconds/u);
  assert.match(section, /0\.36 milliseconds/u);
  assert.match(section, /reaches 162 and no pixel is white/u);
  assert.match(section, /six courses/iu);
  assert.match(section, /1841/u);
  assert.match(README, /\| \[Loxodrome\]\(p5js\/artworks\/loxodrome\/\) \|/u);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "loxodrome");
  const quote = CATALOG.quotes.find((entry) => entry.id === "emerson-zigzag-line");
  assert.equal(artwork.title, "Loxodrome");
  assert.equal(artwork.entry, "p5js/artworks/loxodrome/index.html");
  assert.equal(artwork.interactivePath, "loxodrome/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, ["emerson-zigzag-line"]);
  assert.deepEqual(artwork.thumbnail, { frame: 90 });
  assert.equal(actAt(90).name, "pole");
  assert.ok(sceneAt(90).tilt > degrees(80), "the card is not the view down the axis");
  assert.deepEqual(artwork.render, {
    kind: "video",
    artifact: "exports/p5js/Loxodrome.mp4",
    durationSeconds: DURATION_SECONDS,
    scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `loxodrome` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 12 seconds,/u);

  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.ok(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters) <= 280);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Loxodrome</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="en">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
});

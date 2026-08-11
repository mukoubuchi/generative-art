import assert from "node:assert/strict";
import test from "node:test";
import {
  hilbertCurve,
  hilbertPoint,
  morphSchedule,
  sampledCurve
} from "../artworks/hilbert-curve/curve.js";

/**
 * The curve rests on two facts — every cell once, consecutive cells adjacent — and the
 * clip on a third: that a coarse curve and a fine one can be compared point-for-point
 * through their common parameter. Each is pinned directly, the first two across every
 * degree the artwork shows, the classical shapes of the low degrees by coordinate.
 */
test("degree one is the classical staple", () => {
  // Four cells, visited up the left and down the right: the canonical open cup.
  assert.deepEqual(hilbertCurve(1), [
    [0.25, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
    [0.75, 0.25]
  ]);
});

test("every degree visits every cell exactly once", () => {
  for (let degree = 1; degree <= 6; degree += 1) {
    const side = 2 ** degree;
    const seen = new Set();
    for (const [x, y] of hilbertCurve(degree)) {
      const column = Math.floor(x * side);
      const row = Math.floor(y * side);
      // The point sits at its cell's centre, so the cell recovered from it is exact.
      assert.ok(Math.abs(x * side - column - 0.5) < 1e-12);
      seen.add(`${column},${row}`);
    }
    assert.equal(seen.size, side * side, `degree ${degree} misses or repeats a cell`);
  }
});

test("consecutive cells are edge-neighbours, wherever quadrants meet", () => {
  for (let degree = 1; degree <= 6; degree += 1) {
    const side = 2 ** degree;
    const points = hilbertCurve(degree);
    for (let index = 1; index < points.length; index += 1) {
      const stride = Math.hypot(
        (points[index][0] - points[index - 1][0]) * side,
        (points[index][1] - points[index - 1][1]) * side
      );
      assert.ok(Math.abs(stride - 1) < 1e-9,
        `degree ${degree} jumps between cells ${index - 1} and ${index}`);
    }
  }
});

test("the walk enters at the lower left and leaves at the lower right", () => {
  for (let degree = 1; degree <= 6; degree += 1) {
    const points = hilbertCurve(degree);
    const cell = 0.5 / 2 ** degree;
    assert.deepEqual(points[0], [cell, cell]);
    assert.deepEqual(points.at(-1), [1 - cell, cell]);
  }
});

test("the curve fills space: cells within a step bound distance along the line", () => {
  // Locality, measured rather than asserted in prose: on the degree-5 curve, any two
  // indices one apart land a cell apart, and — the space-filling direction — every cell
  // of the quarter containing the start is visited within the first quarter of indices.
  const degree = 5;
  const points = hilbertCurve(degree);
  const quarter = points.length / 4;
  for (let index = 0; index < quarter; index += 1) {
    const [x, y] = points[index];
    assert.ok(x < 0.5 && y < 0.5,
      "the first quarter of the walk must stay inside the first quadrant");
  }
});

test("resampling holds the ends and stays on the curve", () => {
  const samples = 1024;
  for (const degree of [2, 4, 6]) {
    const curve = hilbertCurve(degree);
    const sampled = sampledCurve(degree, samples);
    assert.equal(sampled.length, samples);
    assert.deepEqual(sampled[0], curve[0]);
    assert.deepEqual(sampled.at(-1), curve.at(-1));
    // Each sample lies on some segment of the polyline: within half a cell of a vertex.
    const side = 2 ** degree;
    for (const [x, y] of sampled) {
      const nearColumn = Math.round(x * side - 0.5);
      const nearRow = Math.round(y * side - 0.5);
      const onColumn = Math.abs(x * side - 0.5 - nearColumn) < 1e-9;
      const onRow = Math.abs(y * side - 0.5 - nearRow) < 1e-9;
      assert.ok(onColumn || onRow, "a sample left the grid lines the polyline runs on");
    }
  }
});

test("the schedule holds, morphs, and holds again, ending finished", () => {
  const plan = { first: 1, last: 6, holdFrames: 20, morphFrames: 34 };
  const stage = plan.holdFrames + plan.morphFrames;
  const total = (plan.last - plan.first) * stage + plan.holdFrames;

  const opening = morphSchedule(0, plan);
  assert.deepEqual(
    [opening.from, opening.to, opening.blend, opening.totalFrames],
    [1, 2, 0, total]
  );
  // Just before a morph ends it is nearly arrived; the following hold pins the target.
  const lastMorphFrame = stage - 1;
  assert.ok(morphSchedule(lastMorphFrame, plan).blend > 0.99);
  assert.equal(morphSchedule(stage, plan).from, 2);
  assert.equal(morphSchedule(stage, plan).blend, 0);
  // The closing hold shows the finished degree-6 curve, and overruns clamp into it.
  const closing = morphSchedule(total - 1, plan);
  assert.equal(closing.to, 6);
  assert.ok(closing.blend > 0.99);
  assert.equal(morphSchedule(total + 100, plan).to, 6);
});

test("the ease starts and ends without a kick", () => {
  const plan = { first: 1, last: 2, holdFrames: 0, morphFrames: 1000 };
  // Two frames into a thousand-frame morph, a linear ease would have moved 2/1000. The
  // cubic moves like 3f² near its ends, so it should be under a hundredth of that — the
  // no-kick property stated as a ratio rather than a magic threshold.
  const fraction = 2 / 1000;
  const early = morphSchedule(1, plan).blend;
  const late = morphSchedule(997, plan).blend;
  assert.ok(early < fraction / 100, `the morph jumps off the line at its start (${early})`);
  assert.ok(1 - late < fraction / 100, `the morph slams into the target (${late})`);
});

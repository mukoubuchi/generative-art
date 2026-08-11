import assert from "node:assert/strict";
import test from "node:test";
import { PACKING_PARAMETERS, coverage, packCircles } from "../artworks/circle-packing/packing.js";

/**
 * The packing has no aesthetic parameters to pin, only its two constraints and the
 * hierarchy they produce, so that is what is tested — on the very packing the artwork
 * draws, since the parameters are shared: no circle crosses another or the frame, with
 * the exact margin the packer promises; every radius is flush against whatever stopped
 * it, so no room is left on the table; and the arrival order carries the size structure
 * the artwork colours by.
 */
const { maximumRadius, minimumRadius, margin } = PACKING_PARAMETERS;
const PACKING = packCircles(PACKING_PARAMETERS);

test("the same seed packs the same circles", () => {
  assert.deepEqual(packCircles({ attempts: 500, seed: 3 }), packCircles({ attempts: 500, seed: 3 }));
  assert.notDeepEqual(packCircles({ attempts: 500, seed: 3 }), packCircles({ attempts: 500, seed: 4 }));
});

test("no circle crosses the frame", () => {
  for (const { x, y, radius } of PACKING) {
    assert.ok(radius >= minimumRadius - 1e-12);
    for (const distanceToWall of [x, y, 1 - x, 1 - y]) {
      assert.ok(distanceToWall - radius >= margin - 1e-9, "a circle broke the frame margin");
    }
  }
});

test("no circle crosses another, and the gaps keep the margin", () => {
  for (let first = 0; first < PACKING.length; first += 1) {
    for (let second = first + 1; second < PACKING.length; second += 1) {
      const a = PACKING[first];
      const b = PACKING[second];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
      assert.ok(gap >= margin - 1e-9, `circles ${first} and ${second} touch or overlap`);
    }
  }
});

test("every circle is flush against something", () => {
  // The radius rule is exact: each circle grew until a wall, a neighbour placed before
  // it, or the size cap stopped it. A circle flush against nothing would mean the
  // packer is leaving room on the table.
  for (const circle of PACKING) {
    const cappedBySize = Math.abs(circle.radius - maximumRadius) < 1e-9;
    const flushWithWall = [circle.x, circle.y, 1 - circle.x, 1 - circle.y]
      .some((distanceToWall) => Math.abs(distanceToWall - margin - circle.radius) < 1e-9);
    const flushWithEarlier = PACKING.some((other) =>
      other.index < circle.index
      && Math.abs(
        Math.hypot(circle.x - other.x, circle.y - other.y) - other.radius - margin - circle.radius
      ) < 1e-9);
    assert.ok(cappedBySize || flushWithWall || flushWithEarlier,
      `circle ${circle.index} stopped growing for no reason`);
  }
});

test("the early circles are the large ones", () => {
  // The greedy hierarchy the colours rely on: the first fifth of arrivals, with the
  // open country to themselves, average several times the radius of the last fifth,
  // which only ever saw gaps.
  const fifth = Math.floor(PACKING.length / 5);
  const mean = (circles) => circles.reduce((sum, { radius }) => sum + radius, 0) / circles.length;
  const early = mean(PACKING.slice(0, fifth));
  const late = mean(PACKING.slice(-fifth));
  assert.ok(early > 3 * late, `arrival order does not read as size (early ${early}, late ${late})`);
});

test("the packing is dense enough to read as one", () => {
  // Vacuity guard and density floor together, measured on the artwork's own run; the
  // ceiling would only be approached if the margin rule broke.
  assert.ok(PACKING.length > 500, `only ${PACKING.length} circles landed`);
  const filled = coverage(PACKING);
  assert.ok(filled > 0.65, `the packing covers only ${filled} of the square`);
  assert.ok(filled < 0.91, "a coverage near the packing bound would mean the margin rule broke");
});

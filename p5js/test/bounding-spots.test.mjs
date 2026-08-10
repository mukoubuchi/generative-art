import assert from "node:assert/strict";
import test from "node:test";
import {
  SLOWEST_REVOLUTION_SECONDS,
  SPOT_COUNT,
  STEPS_PER_SECOND,
  advance,
  createSpots,
  position
} from "../artworks/bounding-spots/simulation.js";

const ORBIT_RADIUS = 480 * (300 / 350);
const TOTAL_STEPS = SLOWEST_REVOLUTION_SECONDS * STEPS_PER_SECOND;
const FULL_TURN = Math.PI * 2;

function spotsAfter(steps) {
  const spots = createSpots(ORBIT_RADIUS);
  for (let step = 0; step < steps; step += 1) {
    for (const spot of spots) {
      advance(spot);
    }
  }
  return spots;
}

test("the spot ladder matches the Processing radii", () => {
  const spots = createSpots(ORBIT_RADIUS);

  // Processing used radii 300 down to 15 in steps of 15, which is 20 evenly spaced ratios.
  assert.equal(spots.length, SPOT_COUNT);
  assert.equal(spots[0].radiusRatio, 1);
  assert.ok(Math.abs(spots[SPOT_COUNT - 1].radiusRatio - 1 / SPOT_COUNT) < 1e-12);
  spots.forEach((spot, index) => {
    assert.ok(Math.abs(spot.radius - ORBIT_RADIUS * (SPOT_COUNT - index) / SPOT_COUNT) < 1e-9);
  });
});

test("angular speed rises as the orbital radius shrinks", () => {
  const spots = createSpots(ORBIT_RADIUS);

  for (let index = 1; index < spots.length; index += 1) {
    assert.ok(spots[index].angularStep > spots[index - 1].angularStep);
  }
  // The outermost spot needs the whole clip for one revolution; the innermost needs 1/20.
  assert.ok(Math.abs(spots[0].angularStep * TOTAL_STEPS - FULL_TURN) < 1e-9);
  assert.ok(
    Math.abs(spots[SPOT_COUNT - 1].angularStep * TOTAL_STEPS - FULL_TURN * SPOT_COUNT) < 1e-9
  );
});

test("every spot starts at the left end of its sweep", () => {
  for (const spot of createSpots(ORBIT_RADIUS)) {
    const { x, y } = position(spot);
    assert.ok(Math.abs(x + spot.radius) < 1e-9);
    assert.ok(Math.abs(y) < 1e-9);
  }
});

test("spots stay on the upper half of their circle", () => {
  for (const steps of [1, 7, 60, 151, TOTAL_STEPS]) {
    for (const spot of spotsAfter(steps)) {
      const { x, y } = position(spot);
      assert.ok(y <= 1e-9);
      assert.ok(Math.abs(Math.hypot(x, y) - spot.radius) < 1e-9);
    }
  }
});

test("the clip closes one full revolution of the outermost spot", () => {
  const [slowest] = spotsAfter(TOTAL_STEPS);

  assert.ok(Math.min(slowest.theta, FULL_TURN - slowest.theta) < 1e-9);
});

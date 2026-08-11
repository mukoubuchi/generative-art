import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSIC_PARAMETERS,
  NUDGE,
  RIBBON_STEPS,
  STEP_SIZE,
  lorenzDerivative,
  ribbonPair,
  rk4Step,
  separation,
  trajectory
} from "../artworks/lorenz-ribbon/lorenz.js";

/**
 * The claims the artwork makes are numerical, so they are tested numerically: the
 * stepper really is fourth order, the model's fixed points really are fixed, the orbit
 * stays on the attractor's bounded set, and the two ribbons' parting is measured — close
 * for the first stretch, macroscopic by the end — rather than taken on Lorenz's word.
 */
test("the stepper is fourth order: halving the step cuts the error thirty-two-fold", () => {
  // On dx/dt = -x the exact answer is known, so the local truncation error can be
  // measured directly. RK4's local error is O(dt^5): halve dt and it shrinks by 2^5.
  const decay = (state) => [-state[0]];
  const errorWith = (dt) => Math.abs(rk4Step([1], dt, {}, decay)[0] - Math.exp(-dt));
  const ratio = errorWith(0.1) / errorWith(0.05);
  assert.ok(Math.abs(ratio - 32) < 3, `error ratio ${ratio} is not the 32 of a fourth-order method`);
});

test("the model's equilibria are exactly where Lorenz put them", () => {
  const { rho, beta } = CLASSIC_PARAMETERS;
  const wing = Math.sqrt(beta * (rho - 1));
  for (const point of [[0, 0, 0], [wing, wing, rho - 1], [-wing, -wing, rho - 1]]) {
    for (const component of lorenzDerivative(point, CLASSIC_PARAMETERS)) {
      assert.ok(Math.abs(component) < 1e-12, `${point} is not an equilibrium`);
    }
  }
});

test("the orbit is bounded: chaos is not escape", () => {
  const points = trajectory([1, 1, 20], 20000, STEP_SIZE);
  for (const [x, y, z] of points.slice(500)) {
    assert.ok(Math.abs(x) < 25 && Math.abs(y) < 35 && z > 0 && z < 55,
      `the orbit left the attractor's box at ${x}, ${y}, ${z}`);
  }
});

test("the same start retraces the same orbit", () => {
  assert.deepEqual(trajectory([1, 1, 20], 500, STEP_SIZE), trajectory([1, 1, 20], 500, STEP_SIZE));
});

test("the two ribbons travel together first and part for good later", () => {
  const { leader, follower } = ribbonPair();
  assert.equal(leader.length, RIBBON_STEPS + 1);
  assert.equal(follower.length, RIBBON_STEPS + 1);
  assert.ok(Math.abs(separation(leader[0], follower[0]) - NUDGE) < 1e-12);

  // Two time units in they are still inseparable at drawing scale...
  const early = separation(leader[400], follower[400]);
  assert.ok(early < 0.01, `the orbits separated immediately (${early})`);

  // ...and by the end they are macroscopically apart — not momentarily, which two
  // crossing orbits could fake, but as a sustained gulf over the final stretch.
  const closing = leader.slice(-600).map((point, index) =>
    separation(point, follower[follower.length - 600 + index]));
  const sustained = closing.reduce((sum, gap) => sum + gap, 0) / closing.length;
  assert.ok(sustained > 5, `the parting did not last (mean closing separation ${sustained})`);
  assert.ok(Math.max(...closing) > 15, "the gulf never reached the attractor's own scale");
});

test("the growth divides evenly into the clip", () => {
  // 300 frames of clip growth consume the ribbon in whole samples per frame.
  assert.equal(RIBBON_STEPS % 250, 0, "the ribbon must divide into the growth frames");
});

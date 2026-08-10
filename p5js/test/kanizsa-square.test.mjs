import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLE_STEPS,
  INDUCER_COUNT,
  REVEAL_STATE,
  SPIN_STATE,
  STATE_COUNT,
  STATE_STEPS,
  STEPS_PER_SECOND,
  angleStep,
  inducerCorners,
  isResting,
  rotationsAt,
  stateAfter
} from "../artworks/kanizsa-square/illusion.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const MAX_ANGLE = Math.PI / 2;

test("the cycle is four states, two of them long and two of them brief", () => {
  assert.equal(STATE_STEPS.length, STATE_COUNT);
  assert.deepEqual(STATE_STEPS, [69, 12, 69, 12]);
  assert.equal(CYCLE_STEPS, 162);
  assert.equal(STATE_STEPS.reduce((total, steps) => total + steps, 0), CYCLE_STEPS);
});

test("the states begin where the Processing sketch's did", () => {
  const boundaries = [0, 69, 81, 150].map((step) => stateAfter(step));

  assert.deepEqual(boundaries.map((state) => state.index), [0, 1, 2, 3]);
  for (const state of boundaries) {
    assert.equal(state.angle, 0);
  }
  assert.equal(stateAfter(CYCLE_STEPS).index, SPIN_STATE);
  assert.equal(stateAfter(CYCLE_STEPS).angle, 0);
});

test("the angle eases in and out over each state", () => {
  const midpoint = angleStep(MAX_ANGLE / 2);

  assert.ok(angleStep(0) < midpoint);
  assert.ok(angleStep(MAX_ANGLE) < midpoint);
  assert.ok(Math.abs(angleStep(0) - angleStep(MAX_ANGLE)) < 1e-12);
  // Continuous across the halfway point, where the two branches meet.
  assert.ok(Math.abs(angleStep(MAX_ANGLE / 2 - 1e-9) - midpoint) < 1e-6);
});

test("the resting states hold the figure exactly where it starts", () => {
  assert.ok(isResting(1) && isResting(3));
  assert.ok(!isResting(SPIN_STATE) && !isResting(REVEAL_STATE));
  for (const step of [70, 75, 80, 151, 155, 161]) {
    const rotations = rotationsAt(stateAfter(step));
    assert.equal(rotations.inducers, 0);
    assert.equal(rotations.spin, 0);
    assert.equal(rotations.quadrilateral, null);
  }
});

test("the spinning state turns each inducer four times faster than the group", () => {
  for (const step of [10, 30, 50, 68]) {
    const state = stateAfter(step);
    const rotations = rotationsAt(state);

    assert.equal(state.index, SPIN_STATE);
    assert.equal(rotations.inducers, state.angle);
    assert.ok(Math.abs(rotations.spin + 4 * state.angle) < 1e-12);
    assert.equal(rotations.quadrilateral, null);
  }
});

test("the revealing state pulls the square away at twice either rotation", () => {
  for (const step of [90, 110, 140]) {
    const state = stateAfter(step);
    const rotations = rotationsAt(state);

    assert.equal(state.index, REVEAL_STATE);
    assert.ok(Math.abs(rotations.inducers + state.angle) < 1e-12);
    assert.ok(Math.abs(rotations.quadrilateral - state.angle) < 1e-12);
    assert.ok(Math.abs(rotations.quadrilateral - rotations.inducers - 2 * state.angle) < 1e-12);
  }
});

test("four inducers sit a quarter turn apart, each mouth aimed along its own radius", () => {
  const corners = inducerCorners(170);

  assert.equal(corners.length, INDUCER_COUNT);
  for (const corner of corners) {
    assert.ok(Math.abs(Math.hypot(corner.x, corner.y) - 170) < 1e-9);
    assert.ok(Math.abs(corner.x - 170 * Math.cos(corner.theta)) < 1e-9);
    assert.ok(Math.abs(corner.y - 170 * Math.sin(corner.theta)) < 1e-9);
  }
  for (let index = 1; index < corners.length; index += 1) {
    assert.ok(Math.abs(corners[index].theta - corners[index - 1].theta - MAX_ANGLE) < 1e-12);
  }
});

test("the clip is a whole number of frames and cycles", () => {
  assert.equal(CYCLE_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(CYCLE_STEPS / STEPS_PER_FRAME, 81);
  assert.equal(3 * CYCLE_STEPS / STEPS_PER_FRAME, 243);
});

test("the clip opens and closes on the resting figure", () => {
  const first = stateAfter(0);
  const last = stateAfter((243 - 1) * STEPS_PER_FRAME);

  assert.equal(first.index, SPIN_STATE);
  assert.equal(first.angle, 0);
  // The final frame lands in a resting state, which draws the same figure as step 0.
  assert.ok(isResting(last.index));
});

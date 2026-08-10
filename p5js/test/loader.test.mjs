import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLE_STEPS,
  FULLY_EXTENDED_STEP,
  GROW,
  SHRINK,
  STEPS_PER_SECOND,
  SWEEP_DEGREES,
  advance,
  arcSpan,
  createState,
  stateAfter
} from "../artworks/loader/simulation.js";

const PLAYBACK_FPS = 30;
const CYCLES = 4;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;

function spanWidth(steps) {
  const span = arcSpan(stateAfter(steps));
  return span.end - span.start;
}

test("one cycle is the Processing sketch's fifty growing and sixty-seven closing steps", () => {
  const state = createState();
  let growSteps = 0;
  while (state.phase === GROW) {
    advance(state);
    growSteps += 1;
  }
  let shrinkSteps = 0;
  while (state.phase === SHRINK) {
    advance(state);
    shrinkSteps += 1;
  }

  // Growing adds a fixed 6 degrees per step; closing eases from 12 degrees down to 1.
  assert.equal(growSteps, 50);
  assert.equal(shrinkSteps, 67);
  assert.equal(CYCLE_STEPS, growSteps + shrinkSteps);
});

test("the clip length is a whole number of cycles and of video frames", () => {
  const totalSteps = CYCLES * CYCLE_STEPS;

  assert.equal(totalSteps % STEPS_PER_FRAME, 0);
  assert.equal(totalSteps / STEPS_PER_FRAME, 234);
  // The manifest declares this duration.
  assert.equal(totalSteps / STEPS_PER_SECOND, 7.8);
});

test("the clip opens and closes on a legible arc rather than on the empty state", () => {
  const totalSteps = CYCLES * CYCLE_STEPS;
  const lastFrameStep = FULLY_EXTENDED_STEP + (totalSteps / STEPS_PER_FRAME - 1) * STEPS_PER_FRAME;

  // The state machine itself starts with nothing drawn.
  assert.equal(spanWidth(0), 0);
  assert.ok(Math.abs(spanWidth(FULLY_EXTENDED_STEP) - SWEEP_DEGREES) < 1e-9);
  // One frame short of the next full extension, so the closing frame is nearly as wide.
  assert.ok(spanWidth(lastFrameStep) > SWEEP_DEGREES * 0.9);
});

test("the arc opens to the full sweep and closes again without exceeding it", () => {
  let widest = 0;
  for (let steps = 0; steps <= CYCLE_STEPS; steps += 1) {
    const width = spanWidth(steps);
    assert.ok(width >= -1e-9);
    assert.ok(width <= SWEEP_DEGREES + 1e-9);
    widest = Math.max(widest, width);
  }

  assert.ok(Math.abs(widest - SWEEP_DEGREES) < 1e-9);
});

test("the leading end only advances while the arc grows", () => {
  let previous = arcSpan(createState()).end;
  for (let steps = 1; steps < 50; steps += 1) {
    const { end } = arcSpan(stateAfter(steps));
    assert.ok(end > previous);
    previous = end;
  }
});

test("both ends are folded back into the first turn", () => {
  for (let steps = 0; steps <= CYCLES * CYCLE_STEPS; steps += 1) {
    const { start, end } = arcSpan(stateAfter(steps));
    assert.ok(start >= 0 && start < 360);
    assert.ok(end >= start && end < 360 + SWEEP_DEGREES);
  }
});

test("a whole number of cycles lands back at the start of the growing phase", () => {
  const closing = stateAfter(CYCLES * CYCLE_STEPS);

  assert.equal(closing.phase, GROW);
  assert.equal(closing.theta, 0);
});

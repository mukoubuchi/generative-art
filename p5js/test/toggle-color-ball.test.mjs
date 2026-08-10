import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLE_STEPS,
  DISC_COLORS,
  DISC_COUNT,
  STEPS_PER_SECOND,
  discColor,
  discOffset,
  discState
} from "../artworks/toggle-color-ball/discs.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const SWING_RADIUS = 680 * (200 / 600);

test("one cycle is 360 steps, six seconds, and a whole number of video frames", () => {
  assert.equal(CYCLE_STEPS, 360);
  assert.equal(CYCLE_STEPS / STEPS_PER_SECOND, 6);
  assert.equal(CYCLE_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(CYCLE_STEPS / STEPS_PER_FRAME, 180);
});

test("the front disc hands over four times per cycle, in the sketch's order", () => {
  const handovers = [];
  let previous = discState(0).frontDisc;

  for (let step = 1; step < CYCLE_STEPS; step += 1) {
    const { frontDisc } = discState(step);
    if (frontDisc !== previous) {
      handovers.push(frontDisc);
      previous = frontDisc;
    }
  }

  // Green, red, yellow, blue: the third handover skips to the last colour.
  assert.deepEqual(handovers, [1, 3, 2]);
  assert.equal(discState(0).frontDisc, 0);
  assert.equal(discState(CYCLE_STEPS / 4).frontDisc, 1);
});

test("the cycle closes back onto its own start", () => {
  const start = discState(0);
  const wrapped = discState(CYCLE_STEPS);

  assert.deepEqual(wrapped, start);
  assert.equal(discOffset(start.theta, SWING_RADIUS), SWING_RADIUS);
});

test("the swing reaches both extremes of the radius and nothing beyond", () => {
  let lowest = Infinity;
  let highest = -Infinity;

  for (let step = 0; step < CYCLE_STEPS; step += 1) {
    const offset = discOffset(discState(step).theta, SWING_RADIUS);
    lowest = Math.min(lowest, offset);
    highest = Math.max(highest, offset);
    assert.ok(Math.abs(offset) <= SWING_RADIUS + 1e-9);
  }

  assert.ok(Math.abs(highest - SWING_RADIUS) < 1e-9);
  assert.ok(Math.abs(lowest + SWING_RADIUS) < 1e-9);
});

test("all four colours are on screen at once, whichever disc leads", () => {
  for (let frontDisc = 0; frontDisc < DISC_COUNT; frontDisc += 1) {
    const shown = Array.from(
      { length: DISC_COUNT },
      (unused, index) => discColor(frontDisc, index)
    );
    assert.equal(new Set(shown.map((colour) => colour.join(","))).size, DISC_COUNT);
    assert.ok(shown.every((colour) => DISC_COLORS.includes(colour)));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLE_STEPS,
  IDLE_STEPS,
  PULSE_STEPS,
  STEPS_PER_SECOND,
  alphaAt,
  inkAlpha,
  isInsideButton,
  playTriangle,
  pulseScale,
  scheduledPulseStep
} from "../artworks/pulse-button/pulse.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const CAPTURE_CYCLES = 3;
const BUTTON_RADIUS = 680 * (150 / 600);

test("a pulse runs the sketch's 110 steps and the clip is a whole number of frames", () => {
  const totalSteps = CAPTURE_CYCLES * CYCLE_STEPS;

  assert.equal(PULSE_STEPS, 110);
  assert.equal(CYCLE_STEPS, IDLE_STEPS + PULSE_STEPS);
  assert.equal(totalSteps % STEPS_PER_FRAME, 0);
  assert.equal(totalSteps / STEPS_PER_FRAME, 225);
  assert.equal(totalSteps / STEPS_PER_SECOND, 7.5);
});

test("the button rests, then fades out as it grows", () => {
  assert.equal(alphaAt(null), 200);
  assert.equal(inkAlpha(alphaAt(null)), 55);
  assert.equal(pulseScale(alphaAt(null)), 1);

  const endOfPulse = alphaAt(PULSE_STEPS - 1);
  assert.ok(endOfPulse > 254 && endOfPulse < 255);
  assert.ok(inkAlpha(endOfPulse) < 1);
  assert.ok(pulseScale(endOfPulse) > 1.49 && pulseScale(endOfPulse) < 1.5);
});

test("ink falls and scale rises together, without either reversing", () => {
  let previousInk = inkAlpha(alphaAt(0));
  let previousScale = pulseScale(alphaAt(0));

  for (let step = 1; step < PULSE_STEPS; step += 1) {
    const alpha = alphaAt(step);
    assert.ok(inkAlpha(alpha) < previousInk);
    assert.ok(pulseScale(alpha) > previousScale);
    previousInk = inkAlpha(alpha);
    previousScale = pulseScale(alpha);
  }
});

test("the capture schedule opens and closes on the resting button", () => {
  const totalSteps = CAPTURE_CYCLES * CYCLE_STEPS;

  assert.equal(scheduledPulseStep(0), null);
  assert.equal(scheduledPulseStep(IDLE_STEPS - 1), null);
  assert.equal(scheduledPulseStep(IDLE_STEPS), 0);
  assert.equal(scheduledPulseStep(CYCLE_STEPS - 1), PULSE_STEPS - 1);
  assert.equal(scheduledPulseStep(CYCLE_STEPS), null);

  let pulses = 0;
  for (let step = 0; step < totalSteps; step += 1) {
    if (scheduledPulseStep(step) === 0) {
      pulses += 1;
    }
  }
  assert.equal(pulses, CAPTURE_CYCLES);
});

test("the hit test covers the button and nothing outside it", () => {
  assert.ok(isInsideButton(0, 0, BUTTON_RADIUS));
  assert.ok(isInsideButton(BUTTON_RADIUS - 1, 0, BUTTON_RADIUS));
  assert.ok(!isInsideButton(BUTTON_RADIUS, 0, BUTTON_RADIUS));
  assert.ok(!isInsideButton(BUTTON_RADIUS * 0.8, BUTTON_RADIUS * 0.8, BUTTON_RADIUS));
});

test("the play triangle points right and fits inside a third of the button", () => {
  const triangle = playTriangle(BUTTON_RADIUS);

  assert.equal(triangle.length, 3);
  assert.ok(Math.abs(triangle[0].x - BUTTON_RADIUS / 3) < 1e-9);
  assert.ok(Math.abs(triangle[0].y) < 1e-9);
  for (const vertex of triangle) {
    assert.ok(Math.abs(Math.hypot(vertex.x, vertex.y) - BUTTON_RADIUS / 3) < 1e-9);
  }
});

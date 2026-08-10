import assert from "node:assert/strict";
import test from "node:test";
import {
  ANGULAR_ACCELERATION,
  BLADE_COUNT,
  MAXIMUM_SPEED,
  STEPS_PER_SECOND,
  STEPS_TO_TOP_SPEED,
  advance,
  bladeTriangles,
  createWheel,
  wheelAfter
} from "../artworks/windmill/wheel.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const OUTER_RADIUS = 680 * 0.4;
const TOTAL_STEPS = 2 * STEPS_TO_TOP_SPEED;

test("four blades reach the long and short radii of the Processing sketch", () => {
  const blades = bladeTriangles(OUTER_RADIUS);

  assert.equal(blades.length, BLADE_COUNT);
  blades.forEach((blade, index) => {
    const [hub, long, short] = blade;
    assert.deepEqual(hub, { x: 0, y: 0 });
    assert.ok(Math.abs(Math.hypot(long.x, long.y) - OUTER_RADIUS) < 1e-9);
    // The odd vertices were divided by the square root of two.
    assert.ok(Math.abs(Math.hypot(short.x, short.y) - OUTER_RADIUS / Math.SQRT2) < 1e-9);
    // The long vertex sits a quarter turn on from the previous blade's. atan2 reports
    // angles in (-PI, PI], so compare them wrapped into a single turn.
    const expected = index * Math.PI / 2;
    const measured = (Math.atan2(long.y, long.x) + Math.PI * 2) % (Math.PI * 2);
    assert.ok(Math.abs(measured - expected) < 1e-9);
  });
});

test("the wheel winds up to the cap and holds there", () => {
  const wheel = createWheel();

  for (let step = 0; step < STEPS_TO_TOP_SPEED; step += 1) {
    advance(wheel, true);
  }
  assert.ok(Math.abs(wheel.speed - MAXIMUM_SPEED) < 1e-12);

  advance(wheel, true);
  assert.ok(Math.abs(wheel.speed - MAXIMUM_SPEED) < 1e-12);
});

test("coasting takes as long as winding up and stops exactly at rest", () => {
  const wheel = wheelAfter(STEPS_TO_TOP_SPEED, STEPS_TO_TOP_SPEED);

  for (let step = 0; step < STEPS_TO_TOP_SPEED - 1; step += 1) {
    advance(wheel, false);
    assert.ok(wheel.speed > 0);
  }
  advance(wheel, false);
  assert.equal(wheel.speed, 0);
});

test("the clip is a whole number of frames and ends with the wheel stopped", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  assert.equal(wheelAfter(TOTAL_STEPS, STEPS_TO_TOP_SPEED).speed, 0);
});

test("the angle never runs backwards and never jumps by more than the cap", () => {
  const wheel = createWheel();
  let previousAngle = wheel.angle;

  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    advance(wheel, step < STEPS_TO_TOP_SPEED);
    const delta = wheel.angle - previousAngle;
    assert.ok(delta >= 0);
    assert.ok(delta <= MAXIMUM_SPEED + 1e-12);
    previousAngle = wheel.angle;
  }
});

test("a sampled video frame turns less than the blades' quarter-turn symmetry", () => {
  // Sampling more than an eighth of a turn per frame would make the wheel appear to
  // stall or run backwards, because the four blades repeat every quarter turn.
  assert.ok(MAXIMUM_SPEED * STEPS_PER_FRAME < Math.PI / 4);
  assert.ok(ANGULAR_ACCELERATION > 0);
});

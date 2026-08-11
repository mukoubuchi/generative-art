import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DECAY_STEPS,
  FIRST_STRIKE_STEP,
  HORIZON_STEPS,
  RING_SPEED,
  STEPS_PER_SECOND,
  STRIKE_PERIOD_STEPS,
  VISIBILITY_FLOOR,
  amplitude,
  bellGlow,
  isInsideBell,
  periodicStrikes,
  ringRadius,
  ringsFromStrikes
} from "../artworks/pulse-button/bell.js";

const PLAYBACK_FPS = 30;
const CAPTURE_STRIKES = 3;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const CLIP_STEPS = CAPTURE_STRIKES * STRIKE_PERIOD_STEPS;

test("the sound dies exponentially: equal times take equal fractions of what remains", () => {
  assert.equal(amplitude(0), 1);
  const interval = 25;
  const expected = Math.exp(-interval / DECAY_STEPS);
  for (let age = 0; age <= 500; age += 13) {
    const ratio = amplitude(age + interval) / amplitude(age);
    assert.ok(Math.abs(ratio - expected) < 1e-12);
    assert.ok(amplitude(age + interval) < amplitude(age));
  }
});

test("the front leaves the rim and travels at one speed", () => {
  assert.equal(ringRadius(0), 1);
  for (let age = 0; age <= 400; age += 17) {
    const step = ringRadius(age + 10) - ringRadius(age);
    assert.ok(Math.abs(step - 10 * RING_SPEED) < 1e-12);
  }
});

test("the horizon drops a ring only once nothing of it could be seen", () => {
  assert.ok(amplitude(HORIZON_STEPS) < VISIBILITY_FLOOR);
  assert.ok(amplitude(HORIZON_STEPS - 1) >= VISIBILITY_FLOOR);
});

test("the clip is three tolls, and each is on the schedule at its own moment", () => {
  const tollSteps = [];
  for (let struck = FIRST_STRIKE_STEP; struck < CLIP_STEPS; struck += STRIKE_PERIOD_STEPS) {
    tollSteps.push(struck);
  }

  assert.deepEqual(tollSteps, [30, 230, 430]);
  assert.equal(CLIP_STEPS % STRIKE_PERIOD_STEPS, 0);
  for (const struck of tollSteps) {
    assert.equal(periodicStrikes(struck).at(-1), struck);
  }
});

test("the clip's arithmetic matches the manifest", () => {
  assert.equal(CLIP_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(CLIP_STEPS / STEPS_PER_FRAME, 300);

  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const bell = manifest.artworks.find((artwork) => artwork.id === "pulse-button");
  assert.equal(bell.render.durationSeconds, CLIP_STEPS / STEPS_PER_SECOND);
  assert.equal(bell.title, "Temple Bell");
});

test("the last frame hands back to the first: the schedule is periodic through the clip", () => {
  for (const step of [0, 45, 120, 199]) {
    const now = ringsFromStrikes(step, periodicStrikes(step));
    const cycleLater = ringsFromStrikes(step + STRIKE_PERIOD_STEPS, periodicStrikes(step + STRIKE_PERIOD_STEPS));
    const clipLater = ringsFromStrikes(step + CLIP_STEPS, periodicStrikes(step + CLIP_STEPS));
    assert.deepEqual(now, cycleLater);
    assert.deepEqual(now, clipLater);
  }
});

test("the clip opens on the remnant of a toll it never sounded", () => {
  const rings = ringsFromStrikes(0, periodicStrikes(0));

  assert.ok(rings.length >= 1);
  // A dying echo: unmistakably present, unmistakably going.
  assert.ok(rings[0].amplitude > VISIBILITY_FLOOR);
  assert.ok(rings[0].amplitude < 0.2);
  // And the bell itself has settled: near silence before the first strike the clip shows.
  assert.ok(bellGlow(0, periodicStrikes(0)) < 0.1);
});

test("at the strike the ring is born at the rim at full strength, and the bell with it", () => {
  const strikes = periodicStrikes(FIRST_STRIKE_STEP);
  const rings = ringsFromStrikes(FIRST_STRIKE_STEP, strikes);

  assert.equal(rings[0].age, 0);
  assert.equal(rings[0].radius, 1);
  assert.equal(rings[0].amplitude, 1);
  assert.equal(bellGlow(FIRST_STRIKE_STEP, strikes), 1);
});

test("before each next toll the last has nearly died", () => {
  for (const justBefore of [229, 429, 599]) {
    const glow = bellGlow(justBefore, periodicStrikes(justBefore));
    assert.ok(glow > 0);
    assert.ok(glow < 0.1);
  }
});

test("strikes yet to come contribute nothing", () => {
  assert.deepEqual(ringsFromStrikes(100, [110]), []);
  assert.equal(bellGlow(100, [110]), 0);
});

test("a press lands on the bell within its radius and misses beyond it", () => {
  assert.ok(isInsideBell(0, 0, 122));
  assert.ok(isInsideBell(80, 80, 122));
  assert.ok(!isInsideBell(122, 0, 122));
  assert.ok(!isInsideBell(100, 100, 122));
});

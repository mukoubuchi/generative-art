import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CYCLE_STEPS,
  FULLY_EXTENDED_STEP,
  GROW,
  ROTATION_STEP_DEGREES,
  SHRINK,
  STEPS_PER_SECOND,
  SWEEP_DEGREES,
  advance,
  arcSpan,
  createState,
  spanCovers,
  stateAfter,
  trackAges,
  visualSpan
} from "../artworks/loader/simulation.js";

const PLAYBACK_FPS = 30;
const CYCLES = 5;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
// The sketch opens here: mid-growth, and a whole cycle into the machine's life.
const OPENING_GROWTH_STEPS = 30;
const FIRST_STEP = CYCLE_STEPS + OPENING_GROWTH_STEPS;
const TRACK_CELLS = 720;

function spanWidth(steps) {
  const span = arcSpan(stateAfter(steps));
  return span.end - span.start;
}

test("one cycle is sixty growing steps and sixty closing ones, measured from the machine", () => {
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

  assert.equal(growSteps, 60);
  assert.equal(shrinkSteps, 60);
  assert.equal(CYCLE_STEPS, growSteps + shrinkSteps);
});

test("the arc grows steadily and closes easing off, never snapping shut", () => {
  const state = createState();
  const growIncrements = [];
  let previous = arcSpan(state).end;
  while (state.phase === GROW) {
    advance(state);
    if (state.phase === GROW) {
      growIncrements.push(arcSpan(state).end - previous);
      previous = arcSpan(state).end;
    }
  }
  const shrinkIncrements = [];
  previous = arcSpan(state).start;
  while (state.phase === SHRINK) {
    advance(state);
    if (state.phase === SHRINK) {
      shrinkIncrements.push(arcSpan(state).start - previous);
      previous = arcSpan(state).start;
    }
  }

  for (const increment of growIncrements) {
    assert.ok(Math.abs(increment - growIncrements[0]) < 1e-9);
  }
  for (let index = 1; index < shrinkIncrements.length; index += 1) {
    assert.ok(shrinkIncrements[index] < shrinkIncrements[index - 1]);
  }
  // The close arrives gently: the last measured step is a fraction of the first.
  assert.ok(shrinkIncrements.at(-1) < shrinkIncrements[0] / 3);
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

test("one cycle later the arc stands on exactly the same visual angles: nothing new is drawn", () => {
  // The artwork's whole claim, measured from the machine rather than from the constants
  // that arrange it: a cycle's spin plus the arc's own advance is two whole turns, so
  // the ends return to the same absolute angles at every phase of the cycle.
  for (let offset = 0; offset <= CYCLE_STEPS; offset += 7) {
    const now = visualSpan(stateAfter(FIRST_STEP + offset));
    const cycleLater = visualSpan(stateAfter(FIRST_STEP + offset + CYCLE_STEPS));
    assert.ok(Math.abs(now.start - cycleLater.start) % 360 < 1e-6);
    assert.ok(Math.abs(now.end - cycleLater.end) % 360 < 1e-6);
  }

  // And the retrace is a single lap: a cycle's spin is 60 degrees, the offsets add 300,
  // and one whole turn is what lays the ring exactly once per cycle.
  assert.ok(Math.abs(ROTATION_STEP_DEGREES * CYCLE_STEPS - 60) < 1e-9);
  assert.equal((ROTATION_STEP_DEGREES * CYCLE_STEPS + SWEEP_DEGREES) % 360, 0);
});

test("the visual span is folded into the first turn and keeps the machine's width", () => {
  for (let steps = 0; steps <= 2 * CYCLE_STEPS; steps += 1) {
    const machineSpan = arcSpan(stateAfter(steps));
    const visual = visualSpan(stateAfter(steps));
    assert.ok(visual.start >= 0 && visual.start < 360);
    assert.ok(visual.end >= visual.start);
    assert.ok(
      Math.abs((visual.end - visual.start) - (machineSpan.end - machineSpan.start)) < 1e-9
    );
  }
});

test("spanCovers answers across the wrap", () => {
  const wrapped = { start: 350, end: 390 };

  assert.ok(spanCovers(wrapped, 350));
  assert.ok(spanCovers(wrapped, 10));
  assert.ok(spanCovers(wrapped, 30));
  assert.ok(!spanCovers(wrapped, 180));
  assert.ok(!spanCovers(wrapped, 349));
});

test("every point of the ring is repainted within one cycle, and the track knows its age", () => {
  // Nothing on the ring is ever older than the cycle that relaid it — checked at every
  // phase of the cycle, not only at the photogenic one — and the ages are not all
  // fresh: somewhere in the cycle a stretch of ring waits a long while for the arc to
  // come round again.
  let oldest = 0;
  for (let offset = 0; offset < CYCLE_STEPS; offset += 10) {
    const ages = trackAges(FIRST_STEP + offset, TRACK_CELLS);
    assert.ok(Math.max(...ages) < CYCLE_STEPS);
    assert.ok(Math.max(...ages) > 0);
    oldest = Math.max(oldest, ...ages);
  }
  assert.ok(oldest > CYCLE_STEPS / 3);

  // Age zero is exactly the live arc, no more and no less.
  const ages = trackAges(FIRST_STEP, TRACK_CELLS);
  const live = visualSpan(stateAfter(FIRST_STEP));
  for (let cell = 0; cell < TRACK_CELLS; cell += 1) {
    const angle = ((cell + 0.5) / TRACK_CELLS) * 360;
    assert.equal(ages[cell] === 0, spanCovers(live, angle));
  }
});

test("the clip is five cycles, three hundred frames, ten seconds, and the manifest agrees", () => {
  const totalSteps = CYCLES * CYCLE_STEPS;

  assert.equal(totalSteps % STEPS_PER_FRAME, 0);
  assert.equal(totalSteps / STEPS_PER_FRAME, 300);
  assert.equal(totalSteps / STEPS_PER_SECOND, 10);

  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const loader = manifest.artworks.find((artwork) => artwork.id === "loader");
  assert.equal(loader.render.durationSeconds, totalSteps / STEPS_PER_SECOND);
});

test("the last frame hands back to the first: arc and track alike", () => {
  const finalStep = FIRST_STEP + CYCLES * CYCLE_STEPS;
  const opening = visualSpan(stateAfter(FIRST_STEP));
  const closing = visualSpan(stateAfter(finalStep));

  assert.ok(Math.abs(opening.start - closing.start) < 1e-6);
  assert.ok(Math.abs(opening.end - closing.end) < 1e-6);
  const openingAges = trackAges(FIRST_STEP, TRACK_CELLS);
  const closingAges = trackAges(finalStep, TRACK_CELLS);
  for (let cell = 0; cell < TRACK_CELLS; cell += 1) {
    assert.ok(Math.abs(openingAges[cell] - closingAges[cell]) < 1e-6);
  }
});

test("the clip opens mid-growth with its whole track already laid", () => {
  // Half the sweep is spread at the door, so the first frame shows the whole story:
  // a bright arc, the fading track behind it, the oldest stretch under its leading edge.
  assert.ok(Math.abs(spanWidth(FULLY_EXTENDED_STEP) - SWEEP_DEGREES) < 1e-9);
  assert.ok(Math.abs(spanWidth(FIRST_STEP) - SWEEP_DEGREES / 2) < 1e-9);
  assert.ok(FIRST_STEP >= CYCLE_STEPS);
  // The frame before the clip wraps stands one machine frame short of the opening one.
  const lastFrameStep = FIRST_STEP + (CYCLES * CYCLE_STEPS / STEPS_PER_FRAME - 1) * STEPS_PER_FRAME;
  assert.ok(Math.abs(spanWidth(lastFrameStep) - spanWidth(FIRST_STEP)) <= 10 + 1e-9);
});

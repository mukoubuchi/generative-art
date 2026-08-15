import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_STEPS,
  SLOWEST_CYCLES,
  SPOT_COUNT,
  STEPS_PER_SECOND,
  aligned,
  cyclesFor,
  phaseStepsAt,
  radiusRatio,
  realignmentSteps,
  spotPosition,
  sweepAngle,
  turnsAt
} from "../artworks/the-love-that-moves/wave.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const ORBIT_RADIUS = 480 * (300 / 350);

/**
 * The artwork is one decision — the cadences are an arithmetic ladder — and everything
 * it shows follows from that. So the tests are about the ladder: that it is arithmetic,
 * that the ensemble stands together at the closing step and at no step before it, that
 * the halfway moment is an exact alternation, and that the clip is one whole
 * realignment. The ladder is integers, so all of this is settled with equality rather
 * than with a tolerance, which is the point of holding the phase as a whole number of
 * steps and dividing only to draw.
 */

test("the cadences are an arithmetic ladder, one to twenty", () => {
  const ladder = Array.from({ length: SPOT_COUNT }, (unused, index) => cyclesFor(index));
  assert.equal(ladder[0], SLOWEST_CYCLES);
  assert.equal(ladder.at(-1), SLOWEST_CYCLES + SPOT_COUNT - 1);
  for (let index = 1; index < ladder.length; index += 1) {
    // The whole artwork is this line: each spot beats exactly one more time than the
    // spot outside it, per period. Not approximately one more.
    assert.equal(ladder[index] - ladder[index - 1], 1);
  }
});

test("the widest arc is the slowest, and the arcs nest without touching", () => {
  for (let index = 1; index < SPOT_COUNT; index += 1) {
    assert.ok(radiusRatio(index) < radiusRatio(index - 1), `arc ${index} is not inside ${index - 1}`);
    assert.ok(cyclesFor(index) > cyclesFor(index - 1));
  }
  assert.equal(radiusRatio(0), 1);
  assert.ok(radiusRatio(SPOT_COUNT - 1) > 0);
});

test("the ensemble stands together at the close, and nowhere in between", () => {
  assert.ok(aligned(0), "the spots do not start together");
  assert.ok(aligned(BASE_STEPS), "the spots do not finish together");
  for (let step = 1; step < BASE_STEPS; step += 1) {
    assert.ok(!aligned(step), `the spots realigned early, at step ${step}`);
  }
});

test("every phase closes exactly, as integers rather than as roundings", () => {
  for (let index = 0; index < SPOT_COUNT; index += 1) {
    assert.equal(phaseStepsAt(index, BASE_STEPS), 0);
    assert.equal(phaseStepsAt(index, 0), 0);
    // And each spot's own motion repeats with the period, at every step of it.
    for (let step = 0; step < BASE_STEPS; step += 7) {
      assert.equal(phaseStepsAt(index, step + BASE_STEPS), phaseStepsAt(index, step));
    }
  }
});

test("the realignment period is computed from the ladder, not assumed of it", () => {
  // Spot k returns to phase zero every BASE_STEPS / gcd(cycles, BASE_STEPS) steps; the
  // ensemble returns when all those coincide. The slowest spot beats once per period,
  // so nothing earlier can bring it home, and the answer is the period itself.
  assert.equal(realignmentSteps(), BASE_STEPS);
  assert.equal(realignmentSteps() / STEPS_PER_SECOND, 10);
});

test("the clip is exactly one realignment", () => {
  assert.equal(realignmentSteps() % STEPS_PER_FRAME, 0);
  assert.equal(realignmentSteps() / STEPS_PER_FRAME, 300);
});

test("halfway through, the ladder is an exact alternation", () => {
  // At half a period the spots' phases differ by exactly half a turn from neighbour to
  // neighbour, so the twenty stand alternately at the two ends of their arcs. This is
  // the most ordered thing in the middle of the clip and nobody arranged it.
  const half = BASE_STEPS / 2;
  for (let index = 0; index < SPOT_COUNT; index += 1) {
    assert.equal(phaseStepsAt(index, half), index % 2 === 0 ? half : 0);
  }
  assert.ok(!aligned(half));
});

test("the sweep is a pendulum's: it dwells at the ends and hurries the middle", () => {
  assert.ok(Math.abs(sweepAngle(0) - Math.PI) < 1e-12, "a sweep does not start at its left end");
  assert.ok(Math.abs(sweepAngle(0.5)) < 1e-12, "a sweep does not reach its right end");
  assert.ok(Math.abs(sweepAngle(0.25) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(sweepAngle(0.75) - Math.PI / 2) < 1e-12);

  // Speed in radians per turn: zero at the ends — which is why the trail gathers
  // there — and pi squared at the middle, the cosine's own maximum slope.
  const speedAt = (turns) => Math.abs(sweepAngle(turns + 1e-7) - sweepAngle(turns - 1e-7)) / 2e-7;
  assert.ok(speedAt(0) < 1e-6, `the sweep does not rest at its end (${speedAt(0)})`);
  assert.ok(Math.abs(speedAt(0.25) - Math.PI ** 2) < 1e-4);
});

test("every spot stays on its own arc, above the rail", () => {
  for (let index = 0; index < SPOT_COUNT; index += 1) {
    const radius = ORBIT_RADIUS * radiusRatio(index);
    for (let step = 0; step <= BASE_STEPS; step += 3) {
      const { x, y } = spotPosition(index, step, ORBIT_RADIUS);
      assert.ok(Math.abs(Math.hypot(x, y) - radius) < 1e-9, `spot ${index} left its arc`);
      assert.ok(y <= 1e-9, `spot ${index} dropped below the rail`);
    }
  }
});

test("the spots begin and end the clip on the rail, released together", () => {
  for (const step of [0, BASE_STEPS]) {
    for (let index = 0; index < SPOT_COUNT; index += 1) {
      const { x, y } = spotPosition(index, step, ORBIT_RADIUS);
      assert.ok(Math.abs(y) < 1e-9, "a spot did not start on the rail");
      assert.ok(x < 0, "a spot was not released from the left end");
    }
  }
  // The closing frame is the opening one, spot for spot, so the loop has no seam.
  for (let index = 0; index < SPOT_COUNT; index += 1) {
    assert.deepEqual(
      spotPosition(index, BASE_STEPS, ORBIT_RADIUS),
      spotPosition(index, 0, ORBIT_RADIUS)
    );
  }
});

function greatestCommonDivisor(first, second) {
  return second === 0 ? first : greatestCommonDivisor(second, first % second);
}

function rankCount(step) {
  return new Set(
    Array.from({ length: SPOT_COUNT }, (unused, index) => phaseStepsAt(index, step))
  ).size;
}

test("every moment of order in the clip is a divisor of the period", () => {
  // The ordered moments a pendulum wave is watched for — the twenty falling into two
  // ranks, then three, then four — are not placed anywhere. At step s two spots share
  // a phase exactly when their cadences differ by a multiple of BASE_STEPS over
  // gcd(s, BASE_STEPS), so the ensemble stands in exactly that many ranks, or in
  // twenty when that many would exceed the spots there are. One line accounts for
  // every ordered instant in the clip, and this holds it at all six hundred of them.
  let spread = 0;
  for (let step = 0; step <= BASE_STEPS; step += 1) {
    const ranks = BASE_STEPS / greatestCommonDivisor(step, BASE_STEPS);
    assert.equal(rankCount(step), Math.min(SPOT_COUNT, ranks), `ranks disagree at step ${step}`);
    spread += rankCount(step) === SPOT_COUNT ? 1 : 0;
  }
  // And the ordered instants are the rare ones: most of the clip is twenty separate
  // phases, so the theorem above is not a statement about a degenerate ensemble.
  assert.ok(spread > BASE_STEPS * 0.9, `only ${spread} steps of the period are fully spread`);
  assert.equal(rankCount(BASE_STEPS / 2), 2);
  assert.equal(rankCount(BASE_STEPS / 4), 4);
  assert.equal(rankCount((BASE_STEPS / 3) * 1), 3);
});

test("the wave really opens out across the arcs", () => {
  // A guard against everything above passing while nothing moves.
  const turns = Array.from({ length: SPOT_COUNT }, (unused, index) =>
    turnsAt(index, Math.round(BASE_STEPS * 0.37))
  );
  assert.ok(Math.max(...turns) - Math.min(...turns) > 0.8, "the ensemble never opened out");
});

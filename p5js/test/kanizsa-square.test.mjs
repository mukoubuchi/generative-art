import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLE_STEPS,
  INDUCER_COUNT,
  MAX_ANGLE,
  REVEAL_STATE,
  SPIN_STATE,
  STATE_COUNT,
  STATE_STEPS,
  STEPS_PER_SECOND,
  advance,
  angleStep,
  isResting,
  marksAt,
  quadrilateralPresence,
  rotationsAt,
  squareCornersAt,
  stateAfter
} from "../artworks/kanizsa-square/illusion.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const CYCLES = 3;
const TOTAL_STEPS = CYCLES * CYCLE_STEPS;
const FULL_TURN = Math.PI * 2;

// The figure's own proportions, as the sketch composes them on a 680 canvas.
const BASE_DIMENSION = 680;
const DISTANCE = BASE_DIMENSION / 4;
const DIAMETER = BASE_DIMENSION / 3;

/**
 * Is a point inside a wedge? Written here rather than imported, so that the claim the
 * artwork rests on — that the square's sides are painted by nothing — is checked against
 * an implementation the artwork does not own.
 */
function insideWedge(mark, x, y) {
  const dx = x - mark.x;
  const dy = y - mark.y;
  if (Math.hypot(dx, dy) > mark.radius) {
    return false;
  }
  const swept = (((mark.to - mark.from) % FULL_TURN) + FULL_TURN) % FULL_TURN;
  // A wedge that keeps the whole turn sweeps zero by that arithmetic; it is a plain disc,
  // and every point inside the radius is in it.
  if (mark.to - mark.from >= FULL_TURN) {
    return true;
  }
  const bearing = (((Math.atan2(dy, dx) - mark.from) % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return bearing <= swept;
}

function inkAt(marks, x, y) {
  return marks.some((mark) => mark.kind === "wedge" && insideWedge(mark, x, y));
}

/**
 * Walk the square's sides and ask, at each point, whether there is ink on one side of the
 * line, on both, or on neither. A real contour is where exactly one side is inked; that is
 * what an eye could actually see. Returns the share of the perimeter in each condition.
 */
function surveyPerimeter(step, samples = 1200) {
  const marks = marksAt(step, DISTANCE, DIAMETER);
  const corners = squareCornersAt(step, DISTANCE);
  const offset = 0.6;
  let edge = 0;
  let blank = 0;
  let buried = 0;
  for (let index = 0; index < INDUCER_COUNT; index += 1) {
    const from = corners[index];
    const to = corners[(index + 1) % INDUCER_COUNT];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const normalX = -(to.y - from.y) / length;
    const normalY = (to.x - from.x) / length;
    for (let sample = 0; sample < samples; sample += 1) {
      const along = (sample + 0.5) / samples;
      const x = from.x + (to.x - from.x) * along;
      const y = from.y + (to.y - from.y) * along;
      const oneSide = inkAt(marks, x + offset * normalX, y + offset * normalY);
      const otherSide = inkAt(marks, x - offset * normalX, y - offset * normalY);
      if (oneSide !== otherSide) {
        edge += 1;
      } else if (oneSide) {
        buried += 1;
      } else {
        blank += 1;
      }
    }
  }
  const total = INDUCER_COUNT * samples;
  return { edge: edge / total, blank: blank / total, buried: buried / total };
}

/** The first step of each state in the first cycle, and how long that state runs. */
function stateRuns() {
  const runs = [];
  let state = { angle: 0, index: SPIN_STATE };
  for (let step = 0; step < CYCLE_STEPS; step += 1) {
    if (runs.length === 0 || runs.at(-1).index !== state.index) {
      runs.push({ index: state.index, start: step, steps: 0 });
    }
    runs.at(-1).steps += 1;
    state = advance(state);
  }
  return runs;
}

const RUNS = stateRuns();
const SPIN_RUN = RUNS.find((run) => run.index === SPIN_STATE);
const REVEAL_RUN = RUNS.find((run) => run.index === REVEAL_STATE);
/** The two resting states: the square rises through the first and falls through the second. */
const RISE_RUN = RUNS.find((run) => run.index === REVEAL_STATE - 1);
const FALL_RUN = RUNS.find((run) => run.index === (REVEAL_STATE + 1) % STATE_COUNT);

/**
 * The artwork's claim is not that the square is faint. It is that the square is not there:
 * nothing in the picture draws it, and what a viewer sees along its sides is their own.
 * These tests hold that structurally — the module's whole vocabulary is wedges, so there is
 * nothing an edge could be drawn with — and then measure the picture to show the sides
 * really are blank between the corners.
 *
 * The motion and the proportions are the original's and are not this suite's business. It
 * measures what is on the canvas; it does not get a vote on how the figure moves.
 */

test("the only thing the figure can draw is a wedge, except when it owns up", () => {
  const kinds = new Set();
  let quadrilaterals = 0;
  let bare = 0;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    const marks = marksAt(step, DISTANCE, DIAMETER);
    for (const mark of marks) {
      kinds.add(mark.kind);
    }
    assert.equal(
      marks.filter((mark) => mark.kind === "wedge").length,
      INDUCER_COUNT,
      `step ${step} did not draw exactly four inducers`
    );
    const owning = marks.filter((mark) => mark.kind === "quadrilateral").length;
    quadrilaterals += owning;
    const present = quadrilateralPresence(stateAfter(step)) > 0;
    assert.equal(owning, present ? 1 : 0, `step ${step} drew ${owning} quadrilaterals`);
    if (!present) {
      // While the figure is only implying, there is nothing but the four inducers. No
      // line, no polygon, nothing that has an end and another end.
      assert.equal(marks.length, INDUCER_COUNT, `step ${step} drew something else`);
      bare += 1;
    }
  }
  // The allowlist is pinned by count, so a third kind of mark cannot slip in unnamed.
  assert.deepEqual([...kinds].sort(), ["quadrilateral", "wedge"]);
  assert.ok(quadrilaterals > 0, "the figure never owned up");
  assert.ok(bare > 0, "the figure was never left implying on its own");
});

test("the square is faded in and out, never switched on", () => {
  // Whether the real quadrilateral is there or not is meant to be hard to catch. Two
  // things do that, and both are pinned here: it never appears or vanishes between one
  // frame and the next, and while it is fading it lies exactly on the square the bites
  // imply — so what rises is a brightness on ground the eye had already called brighter.
  const presences = [];
  for (let step = 0; step < CYCLE_STEPS; step += 1) {
    presences.push(quadrilateralPresence(stateAfter(step)));
  }
  assert.ok(Math.max(...presences) === 1, "the square never became fully present");
  assert.ok(Math.min(...presences) === 0, "the square was never fully absent");
  for (let step = 0; step < CYCLE_STEPS; step += 1) {
    const jump = Math.abs(presences[(step + 1) % CYCLE_STEPS] - presences[step]);
    assert.ok(jump < 0.2, `the square jumped by ${jump} at step ${step}`);
  }
  // It rises across the resting state before the reveal and falls across the one after,
  // and the reveal itself holds it fully present from its first step to its last.
  assert.equal(presences[RISE_RUN.start], 0);
  assert.ok(presences[RISE_RUN.start + RISE_RUN.steps - 1] > 0.9);
  assert.equal(presences[REVEAL_RUN.start], 1);
  assert.equal(presences[REVEAL_RUN.start + REVEAL_RUN.steps - 1], 1);
  assert.equal(presences[FALL_RUN.start], 1);
  assert.ok(presences[FALL_RUN.start + FALL_RUN.steps - 1] < 0.1);

  // And through both fades it sits on the illusory square rather than beside it.
  for (const step of [RISE_RUN.start + 4, FALL_RUN.start + 4]) {
    const marks = marksAt(step, DISTANCE, DIAMETER);
    const quadrilateral = marks.find((mark) => mark.kind === "quadrilateral");
    assert.ok(quadrilateral, `nothing was fading at step ${step}`);
    assert.ok(quadrilateral.presence > 0 && quadrilateral.presence < 1);
    const wedges = marks.filter((mark) => mark.kind === "wedge");
    quadrilateral.corners.forEach((corner, index) => {
      assert.ok(
        Math.abs(corner.x - wedges[index].x) < 1e-9 && Math.abs(corner.y - wedges[index].y) < 1e-9,
        `the fading square was off the inducers at step ${step}`
      );
    });
  }
});

test("between the corners the sides are blank on both sides of the line", () => {
  // The heart of it. Away from the corners, where the bites' straight edges end, there is
  // no ink within reach of the square's sides at all — so the contour a viewer reports
  // seeing there is not a faint mark, it is nothing.
  let probes = 0;
  for (let step = 0; step < CYCLE_STEPS; step += 3) {
    if (stateAfter(step).index === REVEAL_STATE) {
      continue;
    }
    const marks = marksAt(step, DISTANCE, DIAMETER);
    const corners = squareCornersAt(step, DISTANCE);
    const radius = DIAMETER / 2;
    for (let index = 0; index < INDUCER_COUNT; index += 1) {
      const from = corners[index];
      const to = corners[(index + 1) % INDUCER_COUNT];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const normalX = -(to.y - from.y) / length;
      const normalY = (to.x - from.x) / length;
      for (let sample = 0; sample <= 40; sample += 1) {
        const along = sample / 40;
        const x = from.x + (to.x - from.x) * along;
        const y = from.y + (to.y - from.y) * along;
        // Only the stretch that no bite edge could reach from either end.
        const clearOfCorners = along * length > radius + 1 && (1 - along) * length > radius + 1;
        if (!clearOfCorners) {
          continue;
        }
        for (const nudge of [-1.5, -0.5, 0, 0.5, 1.5]) {
          probes += 1;
          assert.ok(
            !inkAt(marks, x + nudge * normalX, y + nudge * normalY),
            `there is ink on the square's side at step ${step}`
          );
        }
      }
    }
  }
  // The discs nearly touch, so the blank stretch is narrow; if a change ever closed it
  // entirely this test would pass by never looking at anything.
  assert.ok(probes > 500, `the survey only probed ${probes} points`);
});

test("the share of the perimeter that is real is the one the proportions force", () => {
  // Not a lever any more — a consequence. Each side carries one bite edge from each of its
  // two corners, so the inked share is twice the radius over the side, and the survey of
  // the picture is held to that rather than to a number written down beside it.
  const corners = squareCornersAt(0, DISTANCE);
  const side = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const forced = (2 * (DIAMETER / 2)) / side;
  assert.ok(Math.abs(forced - 0.9428) < 1e-3, `the proportions give ${forced}`);

  const survey = surveyPerimeter(0);
  assert.ok(
    Math.abs(survey.edge - forced) < 2e-3,
    `the picture shows ${survey.edge}, the proportions force ${forced}`
  );
  // And a side never runs through ink: it either bounds a bite or lies in the blank.
  assert.equal(survey.buried, 0, "a side ran through ink at rest");
});

test("the spin turns the mouths off the sides and brings them back exactly", () => {
  // The original's spin is the group turning one way while every mouth turns four times
  // the other. Relative to the square, a mouth therefore travels a whole turn over the
  // state — so alignment is destroyed in the middle and restored, to the bit, at the end.
  const start = surveyPerimeter(SPIN_RUN.start);
  const middle = surveyPerimeter(SPIN_RUN.start + Math.round(SPIN_RUN.steps / 2));
  assert.ok(start.edge > 0.9, `the figure began with only ${start.edge} of real contour`);
  assert.ok(middle.edge < 0.05, `the mouths still held ${middle.edge} of the sides`);

  // The negative control the survey needs: it reports a collapse above, so it must also
  // be able to report a contour. Both readings come from the same walk.
  assert.ok(start.edge - middle.edge > 0.85, "the survey cannot tell the two apart");

  // Nothing was added or taken away — the same four discs, the same size, the same
  // centres relative to the square. Only the mouths point elsewhere.
  const restingMarks = marksAt(SPIN_RUN.start, DISTANCE, DIAMETER);
  const spunMarks = marksAt(SPIN_RUN.start + Math.round(SPIN_RUN.steps / 2), DISTANCE, DIAMETER);
  assert.equal(spunMarks.length, restingMarks.length);
  for (const mark of spunMarks) {
    assert.ok(Math.abs(Math.hypot(mark.x, mark.y) - DISTANCE) < 1e-9);
    assert.equal(mark.radius, DIAMETER / 2);
  }
});

test("the spin puts every mouth back exactly where it started", () => {
  // The group carries the square with it, so what a mouth does relative to the square is
  // the counter-spin alone: minus four quarter-turns as the state's angle runs through
  // one. That is a whole turn, so the figure the spin ends on is the figure it began on —
  // not nearly, but the same numbers. Comparing the marks says it without arithmetic.
  const before = marksAt(SPIN_RUN.start, DISTANCE, DIAMETER);
  const after = marksAt(SPIN_RUN.start + SPIN_RUN.steps, DISTANCE, DIAMETER);
  assert.equal(stateAfter(SPIN_RUN.start + SPIN_RUN.steps).index, REVEAL_STATE - 1);
  assert.deepEqual(after, before);

  // The counter-spin really is four times the group's own turn, all the way through.
  for (let step = SPIN_RUN.start; step < SPIN_RUN.start + SPIN_RUN.steps; step += 1) {
    const rotations = rotationsAt(stateAfter(step));
    assert.ok(Math.abs(rotations.spin + 4 * rotations.inducers) < 1e-12);
  }
  // And the state does run its angle out to the quarter turn it is defined by: it ends
  // because one more step of its own easing would carry it past, not before that.
  const last = stateAfter(SPIN_RUN.start + SPIN_RUN.steps - 1);
  assert.equal(last.index, SPIN_STATE);
  assert.ok(
    MAX_ANGLE - last.angle <= angleStep(last.angle),
    `the state stopped at ${last.angle}, short of the turn`
  );
});

test("the reveal fills the mouths and draws the square that was never there", () => {
  const opening = REVEAL_RUN.start;
  const marks = marksAt(opening, DISTANCE, DIAMETER);
  // Every inducer is now a whole disc: the bite has gone to nothing, so the figure has
  // stopped implying anything at all.
  for (const mark of marks.filter((one) => one.kind === "wedge")) {
    assert.ok(mark.to - mark.from >= FULL_TURN - 1e-12, "a mouth was still open in the reveal");
  }
  const quadrilateral = marks.find((mark) => mark.kind === "quadrilateral");
  assert.ok(quadrilateral, "nothing was drawn in the reveal");
  assert.equal(quadrilateral.corners.length, INDUCER_COUNT);
  // It opens exactly on the four centres — the square the bites had been implying — and
  // then pulls away from them at twice the rate either one moves.
  quadrilateral.corners.forEach((corner, index) => {
    assert.ok(Math.abs(corner.x - marks[index].x) < 1e-9);
    assert.ok(Math.abs(corner.y - marks[index].y) < 1e-9);
  });
  const later = REVEAL_RUN.start + Math.round(REVEAL_RUN.steps / 2);
  const drift = rotationsAt(stateAfter(later));
  assert.ok(
    Math.abs(drift.quadrilateral - drift.inducers - 2 * drift.quadrilateral) < 1e-12,
    "the quadrilateral did not part from the discs at twice the rate"
  );
});

test("the machine's own arithmetic decides the clip, and the clip closes", () => {
  // Measured, not transcribed: the step sizes decide how long a state lasts.
  assert.equal(CYCLE_STEPS, STATE_STEPS.reduce((sum, steps) => sum + steps, 0));
  assert.equal(STATE_STEPS.length, STATE_COUNT);
  assert.deepEqual(STATE_STEPS, [69, 12, 69, 12]);
  // The resting states pass the same quarter turn, and pass it far faster.
  for (let index = 0; index < STATE_COUNT; index += 1) {
    assert.equal(isResting(index), STATE_STEPS[index] < 20);
  }
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 243);
  assert.deepEqual(
    marksAt(TOTAL_STEPS, DISTANCE, DIAMETER),
    marksAt(0, DISTANCE, DIAMETER)
  );
});

test("a frame is a function of its index alone", () => {
  for (const step of [0, 17, 61, 130, 200, 331]) {
    assert.deepEqual(
      marksAt(step, DISTANCE, DIAMETER),
      marksAt(step + CYCLE_STEPS, DISTANCE, DIAMETER)
    );
    assert.deepEqual(stateAfter(step), stateAfter(step + CYCLE_STEPS));
  }
});

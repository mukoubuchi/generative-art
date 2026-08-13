import assert from "node:assert/strict";
import test from "node:test";
import {
  FULL_SPIN,
  FULL_SUPPORT,
  INDUCER_COUNT,
  PLAN,
  SPARSE_SUPPORT,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  inducerRadius,
  leverAt,
  marksAt,
  revealAt,
  sideLength,
  spinAt,
  squareCorners,
  supportRatioAt
} from "../artworks/kanizsa-square/illusion.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const SQUARE_HALF = 170;
const FULL_TURN = Math.PI * 2;

/**
 * Is a point inside a wedge? Written here rather than imported, so that the claim the
 * artwork rests on — that the square's sides are painted by nothing — is checked
 * against an implementation the artwork does not own.
 */
function insideWedge(mark, x, y) {
  const dx = x - mark.x;
  const dy = y - mark.y;
  if (Math.hypot(dx, dy) > mark.radius) {
    return false;
  }
  const swept = ((mark.to - mark.from) % FULL_TURN + FULL_TURN) % FULL_TURN;
  const bearing = ((Math.atan2(dy, dx) - mark.from) % FULL_TURN + FULL_TURN) % FULL_TURN;
  return bearing <= swept;
}

function inkAt(marks, x, y) {
  return marks.some((mark) => mark.kind === "wedge" && insideWedge(mark, x, y));
}

/**
 * Walk the square's sides and ask, at each point, whether there is ink on one side of
 * the line, on both, or on neither. A real contour is where exactly one side is inked;
 * that is what an eye could actually see. Returns the share of the perimeter in each
 * condition.
 */
function surveyPerimeter(step, samples = 1200) {
  const marks = marksAt(step, SQUARE_HALF);
  const corners = squareCorners(SQUARE_HALF);
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

/** Every step of the clip that is not part of the reveal, thinned for speed. */
function implyingSteps(stride = 7) {
  const steps = [];
  for (let step = 0; step < TOTAL_STEPS; step += stride) {
    if (revealAt(step) === 0) {
      steps.push(step);
    }
  }
  return steps;
}

/**
 * The artwork's claim is not that the square is faint. It is that the square is not
 * there: nothing in the picture draws it, and what a viewer sees along its sides is
 * their own. These tests hold that structurally — the module's whole vocabulary is
 * wedges, so there is nothing an edge could be drawn with — and then measure the
 * picture to show the sides really are blank between the corners, with the share that
 * is genuinely inked coming out at exactly the support ratio the artwork names.
 */

test("the only thing the figure can draw is a wedge, except when it owns up", () => {
  const kinds = new Set();
  let plates = 0;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    const marks = marksAt(step, SQUARE_HALF);
    for (const mark of marks) {
      kinds.add(mark.kind);
      plates += mark.kind === "plate" ? 1 : 0;
    }
    // Outside the reveal there is nothing but the four inducers. No line, no polygon,
    // nothing that has an end and another end.
    if (revealAt(step) === 0) {
      assert.equal(marks.length, INDUCER_COUNT);
      assert.ok(marks.every((mark) => mark.kind === "wedge"), `step ${step} drew something else`);
    } else {
      assert.equal(marks.filter((mark) => mark.kind === "plate").length, 1);
    }
  }
  assert.deepEqual([...kinds].sort(), ["plate", "wedge"]);
  assert.ok(plates > 0, "the figure never owned up");
});

test("between the corners the sides are blank on both sides of the line", () => {
  // The heart of it. Away from the corners, where the bites' straight edges end, there
  // is no ink within reach of the square's sides at all — so the contour a viewer
  // reports seeing there is not a faint mark, it is nothing.
  for (const step of implyingSteps()) {
    const marks = marksAt(step, SQUARE_HALF);
    const corners = squareCorners(SQUARE_HALF);
    const radius = inducerRadius(supportRatioAt(step), SQUARE_HALF);
    for (let index = 0; index < INDUCER_COUNT; index += 1) {
      const from = corners[index];
      const to = corners[(index + 1) % INDUCER_COUNT];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      for (let sample = 0; sample <= 40; sample += 1) {
        const along = sample / 40;
        const x = from.x + (to.x - from.x) * along;
        const y = from.y + (to.y - from.y) * along;
        const clearOfCorners = along * length > radius + 1 && (1 - along) * length > radius + 1;
        if (!clearOfCorners) {
          continue;
        }
        for (const nudge of [-1.5, -0.5, 0, 0.5, 1.5]) {
          const normalX = -(to.y - from.y) / length;
          const normalY = (to.x - from.x) / length;
          assert.ok(
            !inkAt(marks, x + nudge * normalX, y + nudge * normalY),
            `there is ink on the square's side at step ${step}`
          );
        }
      }
    }
  }
});

test("the support ratio is what a survey of the picture says it is", () => {
  // The artwork names the share of its perimeter that is really drawn. That name is
  // checked against the picture rather than trusted: walk the sides, count where an
  // eye would find an edge, and the two agree to three decimals. This holds while the
  // bites face the square; what the spin does to it is the next test's business.
  for (const step of [0, 100, 130, 160, 200, 420, 590]) {
    assert.equal(spinAt(step), 0, `step ${step} is not a square-facing moment`);
    const survey = surveyPerimeter(step);
    assert.ok(
      Math.abs(survey.edge - supportRatioAt(step)) < 2e-3,
      `at step ${step} the picture shows ${survey.edge}, the artwork claims ${supportRatioAt(step)}`
    );
    // And a side never runs through ink: it either bounds a bite or lies in the blank.
    assert.equal(survey.buried, 0, `a side ran through ink at step ${step}`);
  }
});

test("the support lever really empties the sides, and fills them again", () => {
  const supports = [];
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    supports.push(supportRatioAt(step));
  }
  assert.ok(Math.abs(Math.max(...supports) - FULL_SUPPORT) < 1e-12);
  assert.ok(Math.abs(Math.min(...supports) - SPARSE_SUPPORT) < 1e-12);
  // At its poorest the picture is mostly blank along the sides, which is the point:
  // the same four inducers, the same square, and no square to be seen.
  const poorest = supports.indexOf(Math.min(...supports));
  const survey = surveyPerimeter(poorest);
  assert.ok(survey.blank > 0.85, `only ${survey.blank} of the perimeter was blank`);
  assert.ok(survey.edge < 0.15);
});

test("the spin lever takes the bites off the sides without moving anything else", () => {
  const spun = [...Array(TOTAL_STEPS).keys()]
    .reduce((best, step) => (spinAt(step) > spinAt(best) ? step : best), 0);
  const restingMarks = marksAt(0, SQUARE_HALF);
  const spunMarks = marksAt(spun, SQUARE_HALF);
  assert.ok(Math.abs(spinAt(spun) - FULL_SPIN) < 1e-9, `the spin only reached ${spinAt(spun)}`);
  // The inducers stand where they stood and are the size they were; only their bites
  // have turned, and the square goes with them.
  spunMarks.forEach((mark, index) => {
    assert.ok(Math.abs(mark.x - restingMarks[index].x) < 1e-12);
    assert.ok(Math.abs(mark.y - restingMarks[index].y) < 1e-12);
    assert.ok(Math.abs(mark.radius - restingMarks[index].radius) < 1e-12);
    assert.ok(Math.abs(mark.from - restingMarks[index].from) > 0.1);
  });
  // Nothing has been added or taken away: the same ink, the same discs, the same
  // square. Only the bites face elsewhere, and the contour along the sides is gone —
  // while the support ratio, which counts ink rather than where it points, has not
  // moved at all. That gap between the two is the illusion's whole dependence on
  // alignment, and it is measured here rather than described.
  assert.equal(supportRatioAt(spun), supportRatioAt(0));
  const survey = surveyPerimeter(spun);
  assert.ok(survey.edge < 0.02, `the sides still carried ${survey.edge} of real contour`);
  assert.ok(surveyPerimeter(0).edge > 0.6, "the resting figure had no contour to lose");
});

test("the levers take turns, and each one is pulled and put back", () => {
  assert.equal(PLAN.reduce((sum, phase) => sum + phase.steps, 0), TOTAL_STEPS);
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    const pulling = [
      supportRatioAt(step) !== FULL_SUPPORT,
      spinAt(step) !== 0,
      revealAt(step) !== 0
    ].filter(Boolean).length;
    assert.ok(pulling <= 1, `two levers moved at once at step ${step}`);
    const lever = leverAt(step);
    assert.ok(lever.amount >= 0 && lever.amount <= 1);
  }
  // Each lever returns to where it started, which is what lets the clip loop.
  for (const reading of [supportRatioAt, spinAt, revealAt]) {
    assert.ok(Math.abs(reading(TOTAL_STEPS) - reading(0)) < 1e-12);
  }
});

test("the plate rises only in the reveal, and reaches exactly the square", () => {
  const peak = [...Array(TOTAL_STEPS).keys()]
    .reduce((best, step) => (revealAt(step) > revealAt(best) ? step : best), 0);
  assert.ok(revealAt(peak) > 0.999, `the plate only reached ${revealAt(peak)}`);
  const plate = marksAt(peak, SQUARE_HALF).find((mark) => mark.kind === "plate");
  assert.ok(plate, "no plate at the peak of the reveal");
  const corners = squareCorners(SQUARE_HALF);
  plate.corners.forEach((corner, index) => {
    assert.ok(Math.abs(corner.x - corners[index].x) < 1e-9);
    assert.ok(Math.abs(corner.y - corners[index].y) < 1e-9);
  });
  // It is the same square the bites imply, so at its full size it covers each bite.
  assert.equal(plate.corners.length, INDUCER_COUNT);
});

test("the clip is a whole number of frames, ten seconds, and closes", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  assert.deepEqual(marksAt(TOTAL_STEPS, SQUARE_HALF), marksAt(0, SQUARE_HALF));
});

test("the square's side is what the support ratio is a share of", () => {
  // The radius the artwork asks for is the one that makes the named share true: each
  // side carries one bite edge from each of its two corners.
  const side = sideLength(SQUARE_HALF);
  assert.ok(Math.abs(side - Math.SQRT2 * SQUARE_HALF) < 1e-12);
  for (const ratio of [0.2, 0.5, FULL_SUPPORT]) {
    assert.ok(Math.abs((2 * inducerRadius(ratio, SQUARE_HALF)) / side - ratio) < 1e-12);
  }
});

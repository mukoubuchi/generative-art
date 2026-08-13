/**
 * A pendulum wave. Twenty spots sweep nested half circles, and the whole artwork is
 * one decision: their cadences are an arithmetic ladder — the outermost completes one
 * oscillation while the clip runs, the next two, the next three, down to twenty for
 * the innermost. Nothing else is arranged. The travelling wave, the twist into many
 * arms, the moment of pure disorder and the snap back into a single line are not
 * choreographed anywhere in this file; they are what an arithmetic ladder does, and
 * the sketch upstairs only draws where each spot is.
 *
 * Because the ladder is integers, the phases are integers too. A spot's position is
 * read from `(cycles * step) mod BASE_STEPS`, which is exact in floating point for
 * every step of the clip, so the realignment can be stated with equality rather than
 * with a tolerance: at the closing step every spot is at phase zero, exactly, and at
 * no earlier step are they all together.
 */

export const SPOT_COUNT = 20;
/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
/**
 * The ladder's own period, in steps: the time the slowest spot needs for its single
 * oscillation, and therefore the time in which spot k completes exactly k + 1 of its
 * own. Ten seconds, which the clip inherits rather than chooses.
 */
export const BASE_STEPS = 600;
/** How many oscillations the outermost, slowest spot makes in one base period. */
export const SLOWEST_CYCLES = 1;

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;

/** Spot k makes this many oscillations per base period: the ladder itself. */
export function cyclesFor(index) {
  return SLOWEST_CYCLES + index;
}

/**
 * How wide the innermost arc is, as a share of the widest. The Processing sketch ran
 * its radii all the way down to a twentieth, which puts the last several spots inside
 * a coin: their arcs overlap, and the quickest quarter of the ladder — the part whose
 * cadence is doing the most — reads as one bright smudge. Stopping the nest at a
 * third keeps all twenty arcs separable, so the wave can be followed across the whole
 * ladder rather than across the outer half of it.
 */
export const INNERMOST_RATIO = 1 / 3;

/** Nested half circles, largest outside; the slowest spot gets the widest arc. */
export function radiusRatio(index) {
  return 1 - (1 - INNERMOST_RATIO) * (index / (SPOT_COUNT - 1));
}

/**
 * Where spot `index` stands in its own oscillation at `step`, as a whole number of
 * steps into that oscillation: an integer on [0, BASE_STEPS). This is the artwork's
 * state, and it is deliberately an integer — comparing phases is then exact, and the
 * claims about when the ensemble stands together are arithmetic rather than
 * measurements with a tolerance. Dividing by BASE_STEPS to get turns is a last step
 * taken only for the drawing, because a ratio of integers is not always its own
 * quotient in floating point.
 */
export function phaseStepsAt(index, step) {
  const cycles = cyclesFor(index);
  return (((cycles * step) % BASE_STEPS) + BASE_STEPS) % BASE_STEPS;
}

/** The same phase, in turns on [0, 1), which is what the sweep is written in. */
export function turnsAt(index, step) {
  return phaseStepsAt(index, step) / BASE_STEPS;
}

/**
 * The sweep a pendulum actually makes: cosine in the phase, so the spot is quickest
 * through the top of its arc and dwells at the two ends, where the trail therefore
 * gathers. Turns zero puts every spot at the left end of its own arc — all twenty
 * released together, which is where the wave starts and where it returns.
 */
export function sweepAngle(turns) {
  return (HALF_TURN / 2) * (1 + Math.cos(FULL_TURN * turns));
}

/** Spot `index` at `step`, in canvas units about the baseline's centre. */
export function spotPosition(index, step, maximumRadius) {
  const radius = maximumRadius * radiusRatio(index);
  const angle = sweepAngle(turnsAt(index, step));
  return { x: radius * Math.cos(angle), y: -radius * Math.sin(angle) };
}

function greatestCommonDivisor(first, second) {
  return second === 0 ? first : greatestCommonDivisor(second, first % second);
}

function leastCommonMultiple(first, second) {
  return first / greatestCommonDivisor(first, second) * second;
}

/**
 * How long the ensemble takes to stand together again, computed from the ladder
 * rather than assumed of it. Spot k returns to phase zero every
 * BASE_STEPS / gcd(cycles, BASE_STEPS) steps, and the ensemble returns when all of
 * those coincide. With the slowest spot completing a single oscillation the answer
 * is the base period itself, which is why the clip can be exactly one of these and
 * close without a seam. The sketch takes its length from here.
 */
export function realignmentSteps() {
  let period = 1;
  for (let index = 0; index < SPOT_COUNT; index += 1) {
    const cycles = cyclesFor(index);
    period = leastCommonMultiple(period, BASE_STEPS / greatestCommonDivisor(cycles, BASE_STEPS));
  }
  return period;
}

/**
 * Are all twenty spots at the same point of their own oscillations at `step`? Asked
 * of the integer phases, so the answer is yes or no rather than yes to within
 * something.
 */
export function aligned(step) {
  const first = phaseStepsAt(0, step);
  for (let index = 1; index < SPOT_COUNT; index += 1) {
    if (phaseStepsAt(index, step) !== first) {
      return false;
    }
  }
  return true;
}

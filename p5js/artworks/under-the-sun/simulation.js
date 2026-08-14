/**
 * An arc that grows, closes, and spins — and never draws anything new.
 *
 * The machine is the classic loading indicator: the leading end runs 300 degrees ahead,
 * then the trailing end closes the gap, easing off as it arrives, while the whole figure
 * turns at a constant rate. What the recreation adds is one exact relationship between
 * those motions. Over one grow-and-close cycle the arc's own offsets advance 300 degrees
 * and the spin contributes 60 more: 360 in all, one whole turn. So each cycle lays the
 * ring exactly once, and lays it exactly on the ring the previous cycle laid — the ends
 * sweep the same absolute angles, and however long the machine labours, the picture
 * never changes. The clip keeps the past visible as a fading track, so what stands just
 * ahead of the bright arc is always its own last pass, one cycle old, about to be
 * painted again.
 */

/** Steps per second of the simulation; the video samples every second step. */
export const STEPS_PER_SECOND = 60;
/** Degrees the leading end runs ahead of the trailing end before the roles swap. */
export const SWEEP_DEGREES = 300;
export const GROW = 0;
export const SHRINK = 1;

/** The leading end advances steadily; 60 steps take it the full sweep. */
const GROW_STEP = 5;
/**
 * The trailing end starts at 10 degrees a step and eases to 2 as it arrives, so the arc
 * closes up rather than snapping shut. These two rates land the close on exactly 60
 * steps, which is what makes the cycle a round 120 — but the cycle length is measured
 * from the machine below, never assumed.
 */
const SHRINK_FIRST_STEP = 10;
const SHRINK_LAST_STEP = 2;
/**
 * Degrees of spin per step. Chosen with the sweep: a cycle's spin is 60 degrees, the
 * arc's own offsets add 300, and 360 is one whole turn — the exact-retrace identity the
 * artwork rests on, and a single lap, so the ring is relaid in one clean pass with no
 * second-lap slivers folded into the seam. A test derives the identity from the machine
 * rather than from these numbers.
 */
export const ROTATION_STEP_DEGREES = 0.5;

const DEGREES_PER_TURN = 360;

export function createState() {
  return { theta: 0, phi: 0, delta: 0, startAngle: 0, angle: 0, phase: GROW };
}

/**
 * Arc endpoints in degrees before the spin is added. The running offsets grow by 300
 * degrees every cycle, so both ends are folded back into the first turn rather than
 * handed on as ever-larger numbers.
 */
export function arcSpan(state) {
  const { start, end } = state.phase === GROW
    ? { start: state.startAngle, end: state.phi + state.theta }
    : { start: state.phi + state.theta, end: state.delta };
  const turns = Math.floor(start / DEGREES_PER_TURN) * DEGREES_PER_TURN;
  return { start: start - turns, end: end - turns };
}

/**
 * Arc endpoints as the viewer sees them: the machine's span plus the spin, folded into
 * the first turn. This is the coordinate system the retrace happens in — visualSpan one
 * cycle apart is the same pair of angles.
 */
export function visualSpan(state) {
  const span = arcSpan(state);
  const start = span.start + state.angle;
  const turns = Math.floor(start / DEGREES_PER_TURN) * DEGREES_PER_TURN;
  return { start: start - turns, end: span.end + state.angle - turns };
}

export function advance(state) {
  if (state.phase === GROW) {
    state.theta += GROW_STEP;
    if (state.theta >= SWEEP_DEGREES) {
      state.delta = state.phi + SWEEP_DEGREES;
      state.theta = 0;
      state.phase = SHRINK;
    }
  } else {
    // Fast at first, easing off linearly in the distance already closed.
    state.theta += SHRINK_FIRST_STEP
      + (SHRINK_LAST_STEP - SHRINK_FIRST_STEP) * (state.theta / SWEEP_DEGREES);
    if (state.theta >= SWEEP_DEGREES) {
      // Restart from the leading end's actual position, so the arc never spans a
      // negative angle at the handover.
      state.startAngle = state.delta;
      state.phi = state.delta;
      state.theta = 0;
      state.phase = GROW;
    }
  }
  // The spin is accumulated in degrees and folded, never reset, so it stays continuous.
  state.angle = (state.angle + ROTATION_STEP_DEGREES) % DEGREES_PER_TURN;
}

export function stateAfter(steps) {
  const state = createState();
  for (let step = 0; step < steps; step += 1) {
    advance(state);
  }
  return state;
}

function measureFullyExtended() {
  const state = createState();
  let steps = 0;
  while (state.phase === GROW) {
    advance(state);
    steps += 1;
  }
  return steps;
}

/** Step at which the leading end first reaches the full sweep ahead of the trailing end. */
export const FULLY_EXTENDED_STEP = measureFullyExtended();

function measureCycle() {
  const state = createState();
  let steps = 0;
  do {
    advance(state);
    steps += 1;
  } while (!(state.phase === GROW && state.theta === 0));
  return steps;
}

/** Steps for one grow-and-close cycle, measured from the state machine itself. */
export const CYCLE_STEPS = measureCycle();

/** Whether an absolute angle in degrees lies on the arc, wrap included. */
export function spanCovers(span, angleDegrees) {
  const sweep = span.end - span.start;
  const offset = ((angleDegrees - span.start) % DEGREES_PER_TURN + DEGREES_PER_TURN)
    % DEGREES_PER_TURN;
  return offset <= sweep;
}

/**
 * How long ago each point of the ring was last painted, in steps.
 *
 * The ring is read at `cellCount` evenly spaced angles. A point is being painted while
 * it lies under the arc, and stops the moment the trailing end passes it — the leading
 * end lays paint down, the trailing end is what leaves it behind. So the age of a point
 * outside the live arc is simply the time since the trailing end last crossed it, and
 * the crossing is found from the end's motion between steps rather than by sampling
 * coverage: a sweep can enter and leave a narrow stretch within a single step near the
 * moment the arc closes, and a crossing cannot be missed the way a sample can.
 *
 * Ages are fractional — the crossing is placed by interpolating the trailing end's
 * travel across its step, so the fade is as continuous as the motion that made it. And
 * no age ever reaches a full cycle, because each cycle repaints the whole ring: the
 * fact the artwork is about, and a fact the tests assert rather than assume.
 */
export function trackAges(step, cellCount) {
  const lookback = Math.min(step, CYCLE_STEPS);
  // One walk forward from the oldest state collects every span the lookback needs.
  const spans = [];
  const state = stateAfter(step - lookback);
  spans[lookback] = visualSpan(state);
  for (let age = lookback - 1; age >= 0; age -= 1) {
    advance(state);
    spans[age] = visualSpan(state);
  }

  const ages = new Array(cellCount).fill(CYCLE_STEPS);
  for (let cell = 0; cell < cellCount; cell += 1) {
    const angle = ((cell + 0.5) / cellCount) * DEGREES_PER_TURN;
    if (spanCovers(spans[0], angle)) {
      ages[cell] = 0;
      continue;
    }
    for (let age = 1; age <= lookback; age += 1) {
      // Did the trailing end cross this angle between `age` steps ago and one step
      // later? Its travel per step is small, so the forward distance from where it
      // stood to the cell tells, and places, the crossing.
      const departed = spans[age].start;
      const arrived = spans[age - 1].start;
      const travel = ((arrived - departed) % DEGREES_PER_TURN + DEGREES_PER_TURN)
        % DEGREES_PER_TURN;
      const reach = ((angle - departed) % DEGREES_PER_TURN + DEGREES_PER_TURN)
        % DEGREES_PER_TURN;
      if (travel > 0 && reach <= travel) {
        ages[cell] = age - reach / travel;
        break;
      }
    }
  }
  return ages;
}

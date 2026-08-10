/** Processing's default frame rate, which sets how fast the indicator sweeps. */
export const STEPS_PER_SECOND = 60;
/** Degrees the leading end runs ahead of the trailing end before the roles swap. */
export const SWEEP_DEGREES = 300;
export const GROW = 0;
export const SHRINK = 1;

const GROW_STEP = 6;
const SHRINK_FIRST_STEP = 12;
const SHRINK_LAST_STEP = 1;
const ROTATION_STEP = 0.06;
const FULL_TURN = Math.PI * 2;

export function createState() {
  return { theta: 0, phi: 0, delta: 0, startAngle: 0, angle: 0, phase: GROW };
}

const DEGREES_PER_TURN = 360;

/**
 * Arc endpoints in degrees, before the whole shape is rotated by `angle`. The running
 * offsets grow by 300 degrees every cycle, so both ends are folded back into the first
 * turn rather than handed to the renderer as ever-larger numbers.
 */
export function arcSpan(state) {
  const { start, end } = state.phase === GROW
    ? { start: state.startAngle, end: state.phi + state.theta }
    : { start: state.phi + state.theta, end: state.delta };
  const turns = Math.floor(start / DEGREES_PER_TURN) * DEGREES_PER_TURN;
  return { start: start - turns, end: end - turns };
}

export function advance(state) {
  if (state.phase === GROW) {
    // The Processing sketch wrote this as lerp(6, 6, ...), which is a constant step.
    state.theta += GROW_STEP;
    if (state.theta >= SWEEP_DEGREES) {
      state.delta = state.phi + SWEEP_DEGREES;
      state.theta = 0;
      state.phase = SHRINK;
    }
  } else {
    // The trailing end starts fast and eases off, so the arc closes up rather than
    // snapping shut.
    state.theta += SHRINK_FIRST_STEP
      + (SHRINK_LAST_STEP - SHRINK_FIRST_STEP) * (state.theta / SWEEP_DEGREES);
    if (state.theta >= SWEEP_DEGREES) {
      // Processing restarted from `phi + theta`, but theta has just overshot the sweep,
      // so the trailing end was placed a fraction of a degree past the leading end and
      // the arc spanned a negative angle for a step. The leading end is at delta.
      state.startAngle = state.delta;
      state.phi = state.delta;
      state.theta = 0;
      state.phase = GROW;
    }
  }
  // Processing reset the rotation to zero once it passed a full turn, which snapped the
  // arc back by about a degree; taking the remainder keeps the spin continuous.
  state.angle = (state.angle + ROTATION_STEP) % FULL_TURN;
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

/** Steps for one grow-and-shrink cycle, measured from the state machine itself. */
export const CYCLE_STEPS = measureCycle();

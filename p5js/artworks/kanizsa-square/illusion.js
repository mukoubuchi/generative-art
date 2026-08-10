export const STATE_COUNT = 4;
/** Processing's default frame rate, which is what the original's step sizes were tuned to. */
export const STEPS_PER_SECOND = 60;
export const INDUCER_COUNT = 4;

const MAX_ANGLE = Math.PI / 2;
const SLOWEST_STEP = 0.005;
const FASTEST_STEP = 0.12;
/** The two resting states add this on top of the eased step, so they pass four times faster. */
const REST_BOOST = 0.1;
/** The states that hold the figure still: 1 and 3, either side of each moving state. */
const RESTING_STATES = [1, 3];

export const SPIN_STATE = 0;
export const REVEAL_STATE = 2;

/**
 * How far the angle moves this step. It eases in to FASTEST_STEP at the halfway point and
 * back out to SLOWEST_STEP at the end, so each state starts and finishes gently.
 */
export function angleStep(angle) {
  const progress = angle / MAX_ANGLE;
  return angle < MAX_ANGLE / 2
    ? SLOWEST_STEP + (FASTEST_STEP - SLOWEST_STEP) * progress
    : FASTEST_STEP + (SLOWEST_STEP - FASTEST_STEP) * progress;
}

export function isResting(stateIndex) {
  return RESTING_STATES.includes(stateIndex);
}

/** The state one step on. A state ends when its angle passes a quarter turn. */
export function advance(state) {
  let angle = state.angle;
  if (isResting(state.index)) {
    angle += REST_BOOST;
  }
  angle += angleStep(angle);
  return angle > MAX_ANGLE
    ? { angle: 0, index: (state.index + 1) % STATE_COUNT }
    : { angle, index: state.index };
}

/**
 * The state a given step draws. The original drew first and advanced afterwards, so step 0
 * is the initial state. Recomputing from the start keeps every frame a function of its
 * index alone; a whole clip is a few hundred iterations of arithmetic.
 */
export function stateAfter(step) {
  let state = { angle: 0, index: SPIN_STATE };
  for (let count = 0; count < step; count += 1) {
    state = advance(state);
  }
  return state;
}

function measure() {
  const perState = new Array(STATE_COUNT).fill(0);
  let state = { angle: 0, index: SPIN_STATE };
  let steps = 0;
  do {
    perState[state.index] += 1;
    state = advance(state);
    steps += 1;
  } while (state.index !== SPIN_STATE || state.angle !== 0);
  return { steps, perState };
}

const measured = measure();
/** Measured from the state machine rather than transcribed, as the step sizes decide it. */
export const CYCLE_STEPS = measured.steps;
export const STATE_STEPS = measured.perState;

/**
 * The four inducer centres, at the corners of a square. Their angles double as the
 * direction each mouth opens, which is what aims all four at the middle.
 */
export function inducerCorners(distance) {
  return Array.from({ length: INDUCER_COUNT }, (unused, index) => {
    const theta = index * MAX_ANGLE;
    return {
      theta,
      x: distance * Math.cos(theta),
      y: distance * Math.sin(theta)
    };
  });
}

/**
 * The rotations a step draws at: the group of inducers, and the quadrilateral through
 * their centres. In the revealing state the original turned the coordinate system back by
 * the angle for the discs and then forward by twice it before closing the shape, so the
 * quadrilateral pulls away from the discs at twice the rate either one moves.
 */
export function rotationsAt(state) {
  if (state.index === SPIN_STATE) {
    return { inducers: state.angle, quadrilateral: null, spin: -4 * state.angle };
  }
  if (state.index === REVEAL_STATE) {
    return { inducers: -state.angle, quadrilateral: state.angle, spin: 0 };
  }
  return { inducers: 0, quadrilateral: null, spin: 0 };
}

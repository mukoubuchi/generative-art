/**
 * A Kanizsa square, built so that the square cannot be drawn.
 *
 * Everything this module emits is a wedge — a disc with a bite taken out of it. There is
 * no line in its vocabulary and no polygon, so the sketch upstairs has nothing it could
 * stroke an edge with, and the square a viewer sees along the sides is guaranteed to be
 * the viewer's own. What is genuinely on the canvas can be stated exactly: each bite's
 * two straight edges lie along the two sides of the square that meet at that corner, so
 * every side carries a real segment at each end and nothing at all in between.
 *
 * The one exception is announced, and it is the original's ending. In the revealing state
 * the mouths are filled in — the inducers become plain discs, and the square they were
 * implying is gone unless something draws it — and a real quadrilateral is drawn through
 * the same four centres, turning away from the discs as it goes. It arrives in its own
 * kind, so a reader of this module can see that it is the only thing here that is not a
 * wedge.
 *
 * The motion is the original's four-state machine and is not parameterised: a state ends
 * when its angle passes a quarter turn, the two moving states ease in and out, and the
 * two resting states pass the same quarter turn four times faster. The clip's length is
 * therefore measured from the machine rather than chosen.
 */

export const STATE_COUNT = 4;
/** Processing's default frame rate, which is what the original's step sizes were tuned to. */
export const STEPS_PER_SECOND = 60;
export const INDUCER_COUNT = 4;

export const MAX_ANGLE = Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const SLOWEST_STEP = 0.005;
const FASTEST_STEP = 0.12;
/** The two resting states add this on top of the eased step, so they pass four times faster. */
const REST_BOOST = 0.1;
/** The states that hold the figure still: 1 and 3, either side of each moving state. */
const RESTING_STATES = [1, 3];

export const SPIN_STATE = 0;
export const REVEAL_STATE = 2;

/** A mouth is a quarter turn wide, so the drawn wedge is the remaining three quarters. */
export const WEDGE_SPAN = (Math.PI * 3) / 2;
/**
 * The whole figure is turned an eighth of a turn, which puts the four inducers on the
 * canvas diagonals and leaves the square's own sides running level and upright.
 */
export const BASE_ROTATION = Math.PI / 4;
/** The mouths are cut on the far side of each disc, which is what points them inwards. */
export const MOUTH_ROTATION = Math.PI / 4 + Math.PI;

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
  const wrapped = ((step % CYCLE_STEPS) + CYCLE_STEPS) % CYCLE_STEPS;
  let state = { angle: 0, index: SPIN_STATE };
  for (let count = 0; count < wrapped; count += 1) {
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

/**
 * The corners of the square at `step`, in the same absolute frame the marks come back in:
 * the inducer centres, carried round by whatever the group rotation is doing. These are
 * the corners a viewer's square would have, which is why the survey in the tests walks
 * between them.
 */
export function squareCornersAt(step, distance) {
  const turn = BASE_ROTATION + rotationsAt(stateAfter(step)).inducers;
  return inducerCorners(distance).map((corner) => ({
    x: distance * Math.cos(corner.theta + turn),
    y: distance * Math.sin(corner.theta + turn)
  }));
}

function smoothstep(value) {
  const held = Math.min(1, Math.max(0, value));
  return held * held * (3 - 2 * held);
}

/**
 * How present the real quadrilateral is, on [0, 1]. It is raised through the whole of the
 * resting state before the reveal and lowered through the whole of the one after, so it is
 * never switched on: there is no frame at which it was absent and the next at which it is
 * there. Both of those resting states hold the figure at the same rotation the reveal
 * opens and closes at, so it rises and falls exactly on the square the bites imply.
 */
export function quadrilateralPresence(state) {
  if (state.index === REVEAL_STATE) {
    return 1;
  }
  if (state.index === REVEAL_STATE - 1) {
    return smoothstep(state.angle / MAX_ANGLE);
  }
  if (state.index === (REVEAL_STATE + 1) % STATE_COUNT) {
    return smoothstep(1 - state.angle / MAX_ANGLE);
  }
  return 0;
}

/**
 * Everything the sketch is allowed to paint at `step`, as data, in absolute coordinates —
 * the group's rotation is already folded into both the positions and the arcs, so the
 * sketch has no geometry left to do. Wedges only, except for the quadrilateral the bites
 * had been implying, which arrives in its own kind and carries how present it is.
 *
 * The quadrilateral turns only while the reveal runs. Through the resting states either
 * side of it there is no rotation to apply, which is what puts it exactly on the illusory
 * square as it fades up and again as it fades away.
 */
export function marksAt(step, distance, diameter) {
  const state = stateAfter(step);
  const rotations = rotationsAt(state);
  const spread = BASE_ROTATION + rotations.inducers;
  // Filling the mouths in is the same statement as keeping the whole turn, so the reveal
  // needs no second kind of mark for it: the bite simply goes to nothing.
  const kept = state.index === REVEAL_STATE ? FULL_TURN : WEDGE_SPAN;
  const marks = inducerCorners(distance).map((corner) => {
    const from = spread + MOUTH_ROTATION + rotations.spin + corner.theta;
    return {
      kind: "wedge",
      x: distance * Math.cos(corner.theta + spread),
      y: distance * Math.sin(corner.theta + spread),
      radius: diameter / 2,
      from,
      to: from + kept
    };
  });
  const presence = quadrilateralPresence(state);
  if (presence > 0) {
    const turn = BASE_ROTATION + (rotations.quadrilateral ?? 0);
    marks.push({
      kind: "quadrilateral",
      presence,
      corners: inducerCorners(distance).map((corner) => ({
        x: distance * Math.cos(corner.theta + turn),
        y: distance * Math.sin(corner.theta + turn)
      }))
    });
  }
  return marks;
}

/**
 * A rotor with a motor behind it, which is the whole of the difference from the mill.
 *
 * Nothing here is weather. While the key is down the drive adds the same amount of speed
 * every step and stops adding it at a ceiling; while the key is up it takes the same
 * amount away and stops at nothing. So the speed is a trapezoid — a straight ramp, a
 * governed run, a straight ramp back — and the fan comes to rest exactly, at a step that
 * can be named, rather than approaching rest for ever.
 *
 * The Processing sketch this comes from had that law already: it added a constant to the
 * velocity while K was held, limited it, subtracted the same constant when the key came
 * up, and set the velocity to zero once it fell under a thousandth. That is a motor's
 * character rather than a wind's, and it is what the mill beside this one does not have.
 *
 * One identity falls out of the trapezoid and is what the clip is built on: the two ramps
 * together turn the fan exactly as far as the ceiling would have turned it in one ramp's
 * time. Whatever is lost getting up to speed is given back coming down from it. So the
 * whole clip's travel is the ceiling times the time the key was down -- and the ceiling is
 * chosen from that, so the travel is a whole number of quarter turns and the four blades
 * close the loop on themselves.
 */

/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
/** The whole clip: ten seconds. */
export const TOTAL_STEPS = 600;

export const BLADE_COUNT = 4;
const EIGHTH_TURN = Math.PI / 4;
const QUARTER_TURN = Math.PI / 2;
const INNER_RADIUS_RATIO = 1 / Math.SQRT2;

/** The clip's scenario, in steps: still, the key down, the key held, released, still. */
export const CALM_STEPS = 60;
export const SPIN_UP_STEPS = 150;
export const HOLD_STEPS = 180;
/** How long the key is down altogether, which is the only thing the travel depends on. */
export const DRIVEN_STEPS = SPIN_UP_STEPS + HOLD_STEPS;

/**
 * How far the clip turns the fan, in quarter turns. The blades repeat every quarter, so a
 * whole number of them is what lets the last frame hand back to the first.
 *
 * Sixty-three is the number nearest to what the Processing sketch's own ceiling of 0.3
 * radians a frame would have travelled in this time. Choosing the travel and deriving the
 * ceiling, rather than the other way about, makes the closure exact instead of searched.
 */
export const QUARTER_TURNS = 63;

/**
 * The governed ceiling, and the step the drive adds and takes away.
 *
 * The ceiling comes to 0.29988 radians a step against the original's 0.3 -- four
 * hundredths of one per cent under it, which is the whole price of closing the loop
 * exactly. At sixty steps a second that is a little under three turns a second, as it was.
 *
 * The ramp is half the original's, which reached the ceiling in five seconds. A clip of
 * ten seconds has to show the fan run up, run, and run down, and five seconds of ramp at
 * each end would fill it twice over. The law is unchanged; only its scale is.
 */
export const TOP_SPEED = (QUARTER_TURNS * QUARTER_TURN) / DRIVEN_STEPS;
export const ACCELERATION = TOP_SPEED / SPIN_UP_STEPS;

/**
 * Four blades, each a triangle from the hub out to a long vertex and back to the short
 * vertex an eighth of a turn later. The Processing sketch built this as a triangle fan
 * over eight alternating vertices — four at the full radius, four at the radius over root
 * two — and toggled the fill between them, which left the filled triangles implicit;
 * naming the four blades directly says the same thing.
 *
 * The long and short vertices are what make a blade read as pitched, and pitch is what
 * makes a fan throw air rather than merely turn. Each blade is the one before it turned a
 * quarter, so the figure carries the four-fold symmetry the loop closes on.
 */
export function bladeTriangles(outerRadius) {
  const innerRadius = outerRadius * INNER_RADIUS_RATIO;
  return Array.from({ length: BLADE_COUNT }, (unused, index) => {
    const longAngle = 2 * index * EIGHTH_TURN;
    const shortAngle = longAngle + EIGHTH_TURN;
    return [
      { x: 0, y: 0 },
      { x: outerRadius * Math.cos(longAngle), y: outerRadius * Math.sin(longAngle) },
      { x: innerRadius * Math.cos(shortAngle), y: innerRadius * Math.sin(shortAngle) }
    ];
  });
}

/** Whether the key is down over the step that begins at `step`. */
export function heldAt(step) {
  return step >= CALM_STEPS && step < CALM_STEPS + DRIVEN_STEPS;
}

/**
 * One step of the drive. This is the law itself, and the page runs it directly: the
 * closed forms below are the same thing solved, and the tests hold them to this.
 */
export function advanceSpeed(speed, held) {
  return held
    ? Math.min(speed + ACCELERATION, TOP_SPEED)
    : Math.max(speed - ACCELERATION, 0);
}

/** The clip's speed after `step` steps, without walking there. */
export function speedAt(step) {
  const driven = step - CALM_STEPS;
  if (driven <= 0) {
    return 0;
  }
  if (driven <= SPIN_UP_STEPS) {
    return ACCELERATION * driven;
  }
  if (driven <= DRIVEN_STEPS) {
    return TOP_SPEED;
  }
  return Math.max(TOP_SPEED - ACCELERATION * (driven - DRIVEN_STEPS), 0);
}

/** What a ramp of `steps` steps adds up to, at one step of speed apiece. */
function rampTravel(steps) {
  return (ACCELERATION * steps * (steps + 1)) / 2;
}

/**
 * How far the clip has turned the fan after `step` steps. A closed form, so any frame can
 * be rebuilt on its own and the last one is exact rather than the end of a walk.
 */
export function angleAt(step) {
  const driven = step - CALM_STEPS;
  if (driven <= 0) {
    return 0;
  }
  if (driven <= SPIN_UP_STEPS) {
    return rampTravel(driven);
  }
  const upTravel = rampTravel(SPIN_UP_STEPS);
  if (driven <= DRIVEN_STEPS) {
    return upTravel + TOP_SPEED * (driven - SPIN_UP_STEPS);
  }
  const falling = Math.min(driven - DRIVEN_STEPS, SPIN_UP_STEPS);
  return upTravel + TOP_SPEED * HOLD_STEPS + TOP_SPEED * falling - rampTravel(falling);
}

/** The step the fan comes to rest at, and does not move again. */
export const REST_STEP = CALM_STEPS + DRIVEN_STEPS + SPIN_UP_STEPS;

/** A fan on the page, which answers to the key rather than to the scenario. */
export function createFan() {
  return { angle: 0, speed: 0 };
}

/** One step of a fan the reader is driving. Same law, no scenario. */
export function advanceFan(fan, held) {
  fan.speed = advanceSpeed(fan.speed, held);
  fan.angle += fan.speed;
  return fan;
}

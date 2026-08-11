/**
 * A bell struck in the dark, and the sound already passing.
 *
 * One strike makes one wavefront. The front leaves the bell's rim and travels outward
 * at a constant speed, and its strength at any moment is the one law the artwork rests
 * on: exponential decay, amplitude(t) = exp(-t / DECAY_STEPS). Equal intervals of time
 * take equal fractions of what remains — the ratio between any two moments the same
 * time apart is constant, which is what it means for a sound to die away rather than
 * to be cut off. The bell's own afterglow follows the same law, so the body and its
 * voice fade together, and between strikes the picture settles back toward the silent
 * ground it began as.
 *
 * All positions are measured in bell radii: the sketch decides how large a bell radius
 * is on its canvas, and everything here stays a pure statement about time and distance.
 */

/** Steps per second of the simulation; the video samples every second step. */
export const STEPS_PER_SECOND = 60;
/** The capture strikes the bell on this schedule: every 200 steps, first at 30. */
export const FIRST_STRIKE_STEP = 30;
export const STRIKE_PERIOD_STEPS = 200;
/**
 * The time constant of the dying sound, in steps. At 60 steps a second this puts the
 * half-life just under a second: slow enough to be an echo, fast enough that by the
 * next toll the last one is nearly gone.
 */
export const DECAY_STEPS = 72;
/** How far the front travels per step, in bell radii. */
export const RING_SPEED = 0.018;
/** Below this amplitude nothing could be seen at 8 bits; such rings are done. */
export const VISIBILITY_FLOOR = 1 / 255;
/**
 * Steps after which a ring's amplitude has fallen below the floor. Rings older than
 * this are dropped, and a test asserts the drop loses nothing visible.
 */
export const HORIZON_STEPS = Math.ceil(DECAY_STEPS * Math.log(255));

/** The one law: what remains of a sound this many steps after its strike. */
export function amplitude(age) {
  return Math.exp(-age / DECAY_STEPS);
}

/** Where a front born at the rim stands after this many steps, in bell radii. */
export function ringRadius(age) {
  return 1 + age * RING_SPEED;
}

/**
 * The rings alive at `step`, given the steps at which the bell was struck. Each ring is
 * an age, a radius and an amplitude; strikes yet to happen and strikes faded past the
 * horizon contribute nothing.
 */
export function ringsFromStrikes(step, strikeSteps) {
  const rings = [];
  for (const struck of strikeSteps) {
    const age = step - struck;
    if (age < 0 || age > HORIZON_STEPS) {
      continue;
    }
    rings.push({ age, radius: ringRadius(age), amplitude: amplitude(age) });
  }
  return rings.sort((a, b) => a.age - b.age);
}

/**
 * The capture's strike schedule: every strike, past and future, is on the one periodic
 * clock, so any step's picture — including the remnant of a toll sounded before the
 * clip began — is a function of the step alone, and the clip closes onto its opening
 * frame after a whole number of periods.
 */
export function periodicStrikes(step) {
  const strikes = [];
  const newest = Math.floor((step - FIRST_STRIKE_STEP) / STRIKE_PERIOD_STEPS);
  const oldest = Math.ceil((step - FIRST_STRIKE_STEP - HORIZON_STEPS) / STRIKE_PERIOD_STEPS);
  for (let k = oldest; k <= newest; k += 1) {
    strikes.push(FIRST_STRIKE_STEP + k * STRIKE_PERIOD_STEPS);
  }
  return strikes;
}

/**
 * How brightly the bell's own body still rings: the amplitude of the most recent
 * strike, or silence if none has happened yet.
 */
export function bellGlow(step, strikeSteps) {
  let glow = 0;
  for (const struck of strikeSteps) {
    const age = step - struck;
    if (age >= 0) {
      glow = Math.max(glow, amplitude(age));
    }
  }
  return glow;
}

/** A press lands on the bell when it falls within the bell's own radius. */
export function isInsideBell(offsetX, offsetY, radius) {
  return Math.hypot(offsetX, offsetY) < radius;
}

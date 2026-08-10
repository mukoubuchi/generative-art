export const DISC_COUNT = 4;
/** Processing's default frame rate, which sets how long one full cycle takes. */
export const STEPS_PER_SECOND = 60;
/** The Processing sketch advanced its counter by two per frame over a 720 period. */
export const DEGREES_PER_STEP = 2;
export const CYCLE_DEGREES = 720;
export const CYCLE_STEPS = CYCLE_DEGREES / DEGREES_PER_STEP;
/** Degrees between handovers, a quarter of the cycle. */
const DEGREES_PER_HANDOVER = CYCLE_DEGREES / DISC_COUNT;
/** Which disc comes to the front in each quarter. Not in order: the third is yellow. */
const FRONT_ORDER = [0, 1, 3, 2];

export const DISC_COLORS = [
  [0, 255, 0],
  [255, 0, 0],
  [0, 0, 255],
  [255, 255, 0]
];

/**
 * The whole artwork is a function of the step: the counter, which disc is in front, and
 * how far along their shared sine the discs are. Nothing accumulates between frames.
 */
export function discState(step) {
  const counterDegrees = DEGREES_PER_STEP * step % CYCLE_DEGREES;
  return {
    counterDegrees,
    frontDisc: FRONT_ORDER[Math.floor(counterDegrees / DEGREES_PER_HANDOVER)],
    theta: counterDegrees * Math.PI / 180
  };
}

/** Offset along each disc's own axis, swinging between the two extremes of the radius. */
export function discOffset(theta, radius) {
  return Math.cos(theta) * radius;
}

/** The Processing sketch indexed backwards from the last colour as the front rotated. */
export function discColor(frontDisc, index) {
  return DISC_COLORS[DISC_COUNT - 1 - (frontDisc + index) % DISC_COUNT];
}

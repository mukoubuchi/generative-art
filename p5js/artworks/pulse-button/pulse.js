/** Processing's default frame rate, which sets how long one pulse lasts. */
export const STEPS_PER_SECOND = 60;
/** Steps the button rests before the capture clicks it again. */
export const IDLE_STEPS = 40;
/** The Processing sketch stepped alpha from 200 to 255 by half a unit each frame. */
export const PULSE_STEPS = 110;
export const CYCLE_STEPS = IDLE_STEPS + PULSE_STEPS;

const RESTING_ALPHA = 200;
const SPENT_ALPHA = 255;
const PEAK_SCALE = 1.5;

/** Progress of the pulse as an alpha, or the resting value when nothing is running. */
export function alphaAt(pulseStep) {
  if (pulseStep === null) {
    return RESTING_ALPHA;
  }
  return RESTING_ALPHA + (SPENT_ALPHA - RESTING_ALPHA) * pulseStep / PULSE_STEPS;
}

/** How much ink is left: the button fades out as it grows. */
export function inkAlpha(alpha) {
  return SPENT_ALPHA - alpha;
}

export function pulseScale(alpha) {
  return 1 + (PEAK_SCALE - 1) * (alpha - RESTING_ALPHA) / (SPENT_ALPHA - RESTING_ALPHA);
}

/** The capture clicks the button once per cycle instead of waiting for a pointer. */
export function scheduledPulseStep(step) {
  const cycleStep = step % CYCLE_STEPS;
  return cycleStep < IDLE_STEPS ? null : cycleStep - IDLE_STEPS;
}

/** The Processing hit test: anywhere within the button's own radius counts. */
export function isInsideButton(offsetX, offsetY, radius) {
  return Math.hypot(offsetX, offsetY) < radius;
}

/** Play triangle inscribed in a third of the button radius, pointing right. */
export function playTriangle(radius) {
  const third = radius / 3;
  return Array.from({ length: 3 }, (unused, index) => {
    const angle = index * Math.PI * 2 / 3;
    return { x: third * Math.cos(angle), y: third * Math.sin(angle) };
  });
}

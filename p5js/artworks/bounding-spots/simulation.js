export const SPOT_COUNT = 20;
/**
 * The Processing sketch advanced each spot by PI / orbitalRadius per frame at Processing's
 * default 60 fps, with radii 300 down to 15 in steps of 15. Expressed as a duration that
 * is 10 seconds per revolution for the outermost spot, scaling down with the radius, which
 * keeps the motion identical at any canvas size or frame rate.
 */
export const SLOWEST_REVOLUTION_SECONDS = 10;
/**
 * Processing ran this sketch at its default 60 fps, and the trail is drawn one dot per
 * step, so the step rate sets both the spacing of the beads and how fast the wash fades.
 * Stepping at 60 per second keeps that look no matter what frame rate the video uses.
 */
export const STEPS_PER_SECOND = 60;
const HALF_TURN = Math.PI;
const FULL_TURN = Math.PI * 2;

export function createSpots(maximumRadius) {
  return Array.from({ length: SPOT_COUNT }, (unused, index) => {
    const radiusRatio = (SPOT_COUNT - index) / SPOT_COUNT;
    return {
      radiusRatio,
      radius: maximumRadius * radiusRatio,
      angularStep: FULL_TURN
        / (SLOWEST_REVOLUTION_SECONDS * radiusRatio * STEPS_PER_SECOND),
      theta: 0
    };
  });
}

export function advance(spot) {
  spot.theta = (spot.theta + spot.angularStep) % FULL_TURN;
}

/**
 * Folding theta around PI turns a full rotation into a there-and-back sweep of the upper
 * semicircle, so every spot stays above the baseline.
 */
export function position(spot) {
  const sigma = Math.abs(spot.theta - HALF_TURN);
  return {
    x: spot.radius * Math.cos(sigma),
    y: -spot.radius * Math.sin(sigma)
  };
}

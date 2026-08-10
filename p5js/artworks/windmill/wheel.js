export const BLADE_COUNT = 4;
/** Processing's default frame rate, which sets how long the wheel takes to wind up. */
export const STEPS_PER_SECOND = 60;
/** Radians per step, added to the speed on every held step. */
export const ANGULAR_ACCELERATION = 0.001;
/** Radians per step the wheel will not exceed. */
export const MAXIMUM_SPEED = 0.3;
/** Steps from rest to the cap, and equally from the cap back to rest. */
export const STEPS_TO_TOP_SPEED = Math.round(MAXIMUM_SPEED / ANGULAR_ACCELERATION);

const EIGHTH_TURN = Math.PI / 4;
const INNER_RADIUS_RATIO = 1 / Math.SQRT2;

/**
 * Four blades, each a triangle from the hub out to a long vertex and back to the short
 * vertex an eighth of a turn later. The Processing sketch built this as a TRIANGLE_FAN
 * over eight alternating vertices and toggled the fill between them, which left the
 * filled triangles implicit; naming the four blades directly says the same thing.
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

export function createWheel() {
  return { speed: 0, angle: 0 };
}

/**
 * The Processing sketch held speed and angle as PVectors with only a z component and read
 * them back through mag(), so both behaved as non-negative scalars. Coasting clamps at
 * zero, which is what its `mag() > acceleration` guard was there to do.
 */
export function advance(wheel, accelerating) {
  wheel.speed = accelerating
    ? Math.min(MAXIMUM_SPEED, wheel.speed + ANGULAR_ACCELERATION)
    : Math.max(0, wheel.speed - ANGULAR_ACCELERATION);
  wheel.angle += wheel.speed;
}

/** Hold for the wind-up, then let go: the clip is one full accelerate-and-coast cycle. */
export function wheelAfter(steps, holdSteps) {
  const wheel = createWheel();
  for (let step = 0; step < steps; step += 1) {
    advance(wheel, step < holdSteps);
  }
  return wheel;
}

/**
 * The Lorenz system, integrated properly. Three coupled equations — Lorenz's 1963
 * convection model — and a fourth-order Runge-Kutta stepper, which is the whole
 * numerical apparatus: no noise, no randomness, nothing hidden. That is the point the
 * artwork leans on. Two orbits started a breath apart follow the same deterministic
 * rules through the same code, travel together for a while, and then part company for
 * good — sensitive dependence on initial conditions, measured here by tests rather than
 * asserted by reputation.
 */

/** Lorenz's own parameters: sigma 10, rho 28, beta 8/3. */
export const CLASSIC_PARAMETERS = { sigma: 10, rho: 28, beta: 8 / 3 };

export function lorenzDerivative([x, y, z], { sigma, rho, beta }) {
  return [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z
  ];
}

/** One RK4 step: four slope samples, weighted 1-2-2-1. Fifth-order local error. */
export function rk4Step(state, dt, parameters, derivative = lorenzDerivative) {
  const k1 = derivative(state, parameters);
  const k2 = derivative(state.map((value, i) => value + (dt / 2) * k1[i]), parameters);
  const k3 = derivative(state.map((value, i) => value + (dt / 2) * k2[i]), parameters);
  const k4 = derivative(state.map((value, i) => value + dt * k3[i]), parameters);
  return state.map((value, i) => value + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** The orbit from `start`, sampled after every step: steps + 1 points, start included. */
export function trajectory(start, steps, dt, parameters = CLASSIC_PARAMETERS) {
  const points = [start];
  let state = start;
  for (let step = 0; step < steps; step += 1) {
    state = rk4Step(state, dt, parameters);
    points.push(state);
  }
  return points;
}

export function separation(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * The two orbits the clip draws. Both are led onto the attractor by a shared warmup —
 * the model pulls any start onto it — and then split by a nudge of one part in ten
 * thousand along x. Everything else about them is identical.
 */
export const STEP_SIZE = 0.005;
export const RIBBON_STEPS = 5000;
export const NUDGE = 1e-4;

export function ribbonPair() {
  const warmup = trajectory([1, 1, 20], 600, STEP_SIZE);
  const settled = warmup[warmup.length - 1];
  return {
    leader: trajectory(settled, RIBBON_STEPS, STEP_SIZE),
    follower: trajectory([settled[0] + NUDGE, settled[1], settled[2]], RIBBON_STEPS, STEP_SIZE)
  };
}

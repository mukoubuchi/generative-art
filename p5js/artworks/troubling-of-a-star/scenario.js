import { createNetwork, grab, release, step, totalEnergy } from "./network.js";

export const REST_STEPS = 60;
export const DRAG_STEPS = 90;
export const RELEASE_STEP = REST_STEPS + DRAG_STEPS;
export const TOTAL_STEPS = 600;

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Where the pointer is on a given step of the capture: resting on the top bob, then
 * easing it straight up along the figure's own axis of symmetry, then gone. The pull
 * is over in a quarter of the clip; what the clip is for is the seven and a half
 * seconds afterwards, when the energy the hand left behind travels the ring.
 */
export function scenarioPointer(stepIndex, start, target) {
  if (stepIndex <= REST_STEPS) {
    return { ...start };
  }
  if (stepIndex <= RELEASE_STEP) {
    const progress = smoothstep((stepIndex - REST_STEPS) / DRAG_STEPS);
    return {
      x: start.x + (target.x - start.x) * progress,
      y: start.y + (target.y - start.y) * progress
    };
  }
  return undefined;
}

/** The whole capture is a fold over the scenario, so any frame can be rebuilt alone. */
export function networkAfter(steps, options) {
  const network = createNetwork(options);
  const start = { x: network.bobs[0].x, y: network.bobs[0].y };
  for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
    if (stepIndex === REST_STEPS) {
      grab(network, start);
    }
    if (stepIndex === RELEASE_STEP + 1) {
      release(network);
    }
    step(network, scenarioPointer(stepIndex, start, options.dragTarget));
  }
  return network;
}

/**
 * The scenario's own highest energy — reached at the moment of release, when the
 * hand's whole gift is stored in stretched springs — which the sketch uses as the
 * top of its glow scale, so the drawing is normalised by the physics it depicts.
 */
export function scenarioEnergyPeak(options) {
  const network = createNetwork(options);
  const start = { x: network.bobs[0].x, y: network.bobs[0].y };
  let peak = 0;
  for (let stepIndex = 0; stepIndex < TOTAL_STEPS; stepIndex += 1) {
    if (stepIndex === REST_STEPS) {
      grab(network, start);
    }
    if (stepIndex === RELEASE_STEP + 1) {
      release(network);
    }
    step(network, scenarioPointer(stepIndex, start, options.dragTarget));
    peak = Math.max(peak, totalEnergy(network));
  }
  return peak;
}

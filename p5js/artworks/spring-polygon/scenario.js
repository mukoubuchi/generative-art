import { createNetwork, grab, release, step } from "./network.js";

export const REST_STEPS = 40;
export const DRAG_STEPS = 50;
export const TOTAL_STEPS = 420;

/**
 * Where the pointer is on a given step of the capture: still on the first bob, then
 * dragging it out towards a corner, then gone. The pull is the artwork's whole subject,
 * so the clip spends most of its length on the network settling afterwards.
 */
export function scenarioPointer(stepIndex, start, target) {
  if (stepIndex <= REST_STEPS) {
    return { ...start };
  }
  if (stepIndex <= REST_STEPS + DRAG_STEPS) {
    const progress = (stepIndex - REST_STEPS) / DRAG_STEPS;
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
    if (stepIndex === REST_STEPS + DRAG_STEPS + 1) {
      release(network);
    }
    step(network, scenarioPointer(stepIndex, start, options.dragTarget));
  }
  return network;
}

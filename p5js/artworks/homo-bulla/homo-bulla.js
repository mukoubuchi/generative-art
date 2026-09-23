import { createFoam, snapshot, step } from "./foam.js";

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 12;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Steps before the first frame: the Voronoi start relaxed into a foam, then let coarsen a while. */
export const RELAX_STEPS = 400;
export const LEAD_STEPS = 600;
/** Steps between one frame and the next. */
export const STEPS_PER_FRAME = 10;

/**
 * The run of the clip, computed a frame at a time and kept: the foam is a history, and
 * frame k can only be had by living through frames 0 to k − 1. Asking for a frame computes
 * whatever has not been computed yet, so a capture that asks in order and a page that asks
 * by the clock see the same frames.
 */
export function createRun(overrides = {}) {
  const foam = createFoam(overrides);
  const permeability = foam.options.permeability;
  foam.options = { ...foam.options, permeability: 0 };
  for (let k = 0; k < RELAX_STEPS; k += 1) step(foam);
  foam.options = { ...foam.options, permeability };
  for (let k = 0; k < LEAD_STEPS; k += 1) step(foam);
  const frames = [snapshot(foam)];
  return {
    foam,
    frames,
    frame(index) {
      while (frames.length <= index) {
        for (let k = 0; k < STEPS_PER_FRAME; k += 1) step(foam);
        frames.push(snapshot(foam));
      }
      return frames[index];
    }
  };
}

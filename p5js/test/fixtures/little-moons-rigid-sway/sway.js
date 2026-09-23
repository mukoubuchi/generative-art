/**
 * The wind of the first Little Moons, kept as a specimen of the motion it was taken out for.
 *
 * Each of the canopy's three layers slid as one rigid sheet, along a sine of its own: a pixel
 * and a half across, two, three and one times a clip, and up and down at twice that. Every
 * hole of a layer moved in step with every other, and each layer's path came round again at
 * its own fixed period. Nothing in a tree moves like that, and the wind that replaced it is a
 * field the leaves move in.
 *
 * The function is the one v1.28.0 published, with its constants.
 */

export const TOTAL_FRAMES = 360;
export const SWAY_AMPLITUDE = 1.5;
export const SWAY_TURNS = [2, 3, 1];

export function swayAt(frameIndex, layerIndex) {
  const phase = 2 * Math.PI * SWAY_TURNS[layerIndex] * frameIndex / TOTAL_FRAMES + 1.7 * layerIndex;
  return {
    x: SWAY_AMPLITUDE * Math.sin(phase),
    y: 0.6 * SWAY_AMPLITUDE * Math.sin(2 * phase + 0.9)
  };
}

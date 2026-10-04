import { FLOOR_HEIGHTS, STAGE_SCALE, rimAt, verticals } from "./the-same-tower.js";

/**
 * Recursive Pentagram's night and its starlight: the colours the reader first chose for this
 * tower, and chose again for it after it had been drawn in black on warm white.
 */
export const GROUND = [10, 12, 18];
export const STARLIGHT = [202, 192, 232];
// Match Platonic Duals' screen-space edges while keeping overlapping floors distinct.
export const CORE_WEIGHT = 1.7;
export const CORE_ALPHA = 255;
/**
 * Every line is drawn three times and added: two wider, fainter passes for the glow, then the
 * line itself. Added, so where floors cross in the picture the light is brighter.
 */
export const PASSES = Object.freeze([
  Object.freeze({ role: "glow-wide", alpha: 14, weight: 9 }),
  Object.freeze({ role: "glow-near", alpha: 40, weight: 4 }),
  Object.freeze({ role: "tower-lines", alpha: CORE_ALPHA, weight: CORE_WEIGHT })
]);

export function onStage([x, y, z]) {
  return [x * STAGE_SCALE, z === 0 ? 0 : -z * STAGE_SCALE, y === 0 ? 0 : -y * STAGE_SCALE];
}

/** Each mathematical floor and corner axis, once per pass, without offset strands. */
export function towerEtching() {
  const segments = FLOOR_HEIGHTS.flatMap((height) => {
    const rim = rimAt(height).map(onStage);
    return rim.slice(1).map((to, index) => [rim[index], to]);
  });
  segments.push(...verticals().map((ends) => ends.map(onStage)));
  return PASSES.map(({ role, alpha, weight }) => ({ role, colour: STARLIGHT, alpha, weight, segments }));
}

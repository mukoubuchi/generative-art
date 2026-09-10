import { FLOOR_HEIGHTS, STAGE_SCALE, rimAt, verticals } from "./the-same-tower.js";

/** The warm white ground shared by The Hat, Herringbone and Pinwheel. */
export const GROUND = [230, 224, 208];
export const INK = [0, 0, 0];
export const CORE_WEIGHT = 0.65;
export const CORE_ALPHA = 255;

export function onStage([x, y, z]) {
  return [x * STAGE_SCALE, z === 0 ? 0 : -z * STAGE_SCALE, y === 0 ? 0 : -y * STAGE_SCALE];
}

/** Each mathematical floor and corner axis is drawn once, without offset strands. */
export function towerEtching() {
  const segments = FLOOR_HEIGHTS.flatMap((height) => {
    const rim = rimAt(height).map(onStage);
    return rim.slice(1).map((to, index) => [rim[index], to]);
  });
  segments.push(...verticals().map((ends) => ends.map(onStage)));
  return [{ role: "tower-lines", colour: INK, alpha: CORE_ALPHA, weight: CORE_WEIGHT, segments }];
}

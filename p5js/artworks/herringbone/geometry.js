// The Processing sketch worked in pixels on a 500 px canvas with a 50 px grid. Every
// length here is in grid units instead, so the same weave fits any canvas: ten units
// across, tiles three units long, and runs starting four units apart.
export const GRID_SIZE = 10;
export const TILE_LENGTH = 3;
export const RUN_STEP = 4;
/** One unit of horizontal drift per row is what turns a stack of tiles into a diagonal run. */
export const ROW_DRIFT = 1;
export const COLUMN_DRIFT = 1;

/**
 * Horizontal tiles. Each run starts at `start` on the top row and slides one unit right
 * per row, so a run reads as a staircase and neighbouring runs interlock.
 */
export function horizontalSegments() {
  const segments = [];
  for (let start = -GRID_SIZE; start < 2 * GRID_SIZE; start += RUN_STEP) {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const x = start + row * ROW_DRIFT;
      segments.push({ x1: x, y1: row, x2: x + TILE_LENGTH, y2: row });
    }
  }
  return segments;
}

/**
 * Vertical tiles. The same construction turned a quarter turn; its runs start one unit
 * higher than the horizontal ones so the two families fill each other's gaps.
 */
export function verticalSegments() {
  const segments = [];
  for (let start = -GRID_SIZE - 1; start < 2 * GRID_SIZE; start += RUN_STEP) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const y = start + column * COLUMN_DRIFT;
      segments.push({ x1: column, y1: y, x2: column, y2: y + TILE_LENGTH });
    }
  }
  return segments;
}

export function allSegments() {
  return [...horizontalSegments(), ...verticalSegments()];
}

/**
 * Segments that paint something inside the canvas. A tile has no thickness across its own
 * axis, so it counts as visible when it overlaps the canvas along its length and merely
 * touches it across — a tile lying exactly on the top edge is drawn, one starting at the
 * right edge and running further right is not.
 */
export function visibleSegments(segments) {
  return segments.filter((segment) => {
    const horizontal = segment.y1 === segment.y2;
    const [low, high] = horizontal
      ? [Math.min(segment.x1, segment.x2), Math.max(segment.x1, segment.x2)]
      : [Math.min(segment.y1, segment.y2), Math.max(segment.y1, segment.y2)];
    const across = horizontal ? segment.y1 : segment.x1;
    return high > 0 && low < GRID_SIZE && across >= 0 && across <= GRID_SIZE;
  });
}

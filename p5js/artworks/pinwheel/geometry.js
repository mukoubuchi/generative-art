// Same construction as the plain herringbone, in grid units rather than pixels, but with
// a wider run spacing and a different drift for each family. The horizontal runs step two
// units sideways per row and the vertical runs three per column, which is what turns the
// weave from a diagonal braid into a pinwheel of large and small squares.
export const GRID_SIZE = 10;
export const TILE_LENGTH = 3;
export const RUN_STEP = 5;
export const ROW_DRIFT = 2;
export const COLUMN_DRIFT = 3;

export function horizontalSegments() {
  const segments = [];
  for (let start = -2 * GRID_SIZE; start < GRID_SIZE; start += RUN_STEP) {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const x = start + row * ROW_DRIFT;
      segments.push({ x1: x, y1: row, x2: x + TILE_LENGTH, y2: row });
    }
  }
  return segments;
}

export function verticalSegments() {
  const segments = [];
  for (let start = -3 * GRID_SIZE - 1; start < GRID_SIZE; start += RUN_STEP) {
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
 * touches it across.
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

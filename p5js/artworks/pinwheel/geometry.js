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

/**
 * The squares the weave makes, found rather than placed.
 *
 * Nothing in the construction mentions a square: two families of three-unit tiles
 * drift at their two rates, and the paving of large and small squares is what the
 * plane is left divided into. So the squares are discovered the way the eye discovers
 * them — the tiles are laid as walls on a wide window of rows, and the enclosed
 * regions are flooded and measured. Every region comes out a square of side two or a
 * square of side one, one of each per five units of area, which the tests assert
 * rather than assume. Returned are the squares that show inside the canvas, each with
 * its true size, so a square clipped by the edge still knows which family it is.
 */
export function emergentSquares() {
  const margin = 6;
  const low = -margin;
  const high = GRID_SIZE + margin;
  const verticalWalls = new Set();
  const horizontalWalls = new Set();
  // Starts extend the construction's own anchors by whole run-steps, so the extended
  // walls sit on exactly the lattice the canvas rows use.
  for (let start = -2 * GRID_SIZE - 6 * RUN_STEP; start < GRID_SIZE + 6 * RUN_STEP; start += RUN_STEP) {
    for (let row = low; row < high; row += 1) {
      const x = start + row * ROW_DRIFT;
      for (let step = 0; step < TILE_LENGTH; step += 1) {
        horizontalWalls.add(`${x + step},${row}`);
      }
    }
  }
  for (let start = -3 * GRID_SIZE - 1 - 6 * RUN_STEP; start < GRID_SIZE + 6 * RUN_STEP; start += RUN_STEP) {
    for (let column = low; column < high; column += 1) {
      const y = start + column * COLUMN_DRIFT;
      for (let step = 0; step < TILE_LENGTH; step += 1) {
        verticalWalls.add(`${column},${y + step}`);
      }
    }
  }

  const seen = new Set();
  const squares = [];
  for (let cellX = low; cellX < high; cellX += 1) {
    for (let cellY = low; cellY < high; cellY += 1) {
      if (seen.has(`${cellX},${cellY}`)) {
        continue;
      }
      const cells = [];
      const stack = [[cellX, cellY]];
      seen.add(`${cellX},${cellY}`);
      while (stack.length > 0) {
        const [x, y] = stack.pop();
        cells.push([x, y]);
        const moves = [
          [x + 1, y, !verticalWalls.has(`${x + 1},${y}`)],
          [x - 1, y, !verticalWalls.has(`${x},${y}`)],
          [x, y + 1, !horizontalWalls.has(`${x},${y + 1}`)],
          [x, y - 1, !horizontalWalls.has(`${x},${y}`)]
        ];
        for (const [nextX, nextY, open] of moves) {
          if (!open || nextX < low || nextX >= high || nextY < low || nextY >= high) {
            continue;
          }
          if (!seen.has(`${nextX},${nextY}`)) {
            seen.add(`${nextX},${nextY}`);
            stack.push([nextX, nextY]);
          }
        }
      }
      if (cells.some(([x, y]) => x === low || x === high - 1 || y === low || y === high - 1)) {
        continue;
      }
      const xs = cells.map(([x]) => x);
      const ys = cells.map(([, y]) => y);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      const size = Math.max(...xs) - left + 1;
      squares.push({ x: left, y: top, size, cells: cells.length });
    }
  }
  return squares
    .filter((square) =>
      square.x + square.size > 0 && square.x < GRID_SIZE
      && square.y + square.size > 0 && square.y < GRID_SIZE)
    .sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x || a.y - b.y);
}

/**
 * The laying order for the tiles themselves: the same diagonal sweep the herringbone
 * uses, both families interleaved as they fall, ties broken deterministically.
 */
export function layingOrder() {
  const measure = (segment) => (segment.x1 + segment.x2 + segment.y1 + segment.y2) / 2;
  return visibleSegments(allSegments())
    .map((segment) => ({ ...segment, horizontal: segment.y1 === segment.y2 }))
    .sort((a, b) =>
      measure(a) - measure(b)
      || Number(b.horizontal) - Number(a.horizontal)
      || a.x1 - b.x1
      || a.y1 - b.y1
    );
}

/**
 * The clip's plan, in frames at thirty a second: the tile walls laid quickly, the
 * squares each given their place, the whole held, then let go for the loop.
 */
export const LATTICE_FRAMES = 60;
export const FILL_FRAMES = 170;
export const HOLD_FRAMES = 55;
export const DISSOLVE_FRAMES = 15;
export const TOTAL_FRAMES = LATTICE_FRAMES + FILL_FRAMES + HOLD_FRAMES + DISSOLVE_FRAMES;

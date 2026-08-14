/**
 * Truchet tiles in a current.
 *
 * Each cell of the grid holds the same two quarter arcs, turned one way or the other, and
 * whichever way a cell is turned its arcs meet its neighbours' at the midpoints of the
 * shared edges. So the curves always join up, and what the picture is depends entirely on
 * which way each cell has been turned.
 *
 * Here that is not a throw of the dice. A field of three long waves runs across the grid,
 * and a cell turns whichever way the field leans where it stands. The waves drift, so the
 * channels the arcs make are continually cut and rejoined — the same cells, and never the
 * same water. The artwork's line from the Hōjōki says as much of a river.
 *
 * The drift is a whole number of cycles over the clip, so the field at the end is the
 * field at the beginning to the last bit, and the loop closes exactly rather than nearly.
 */

export const COLUMN_COUNT = 14;
export const ROW_COUNT = 9;

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

/**
 * The three waves the current is made of, in cycles per cell across and down, and in
 * whole cycles over the clip. Whole, so the loop closes; different, so the three never
 * come back into step with each other in between and the pattern never repeats inside a
 * single run of it.
 */
export const WAVES = [
  { across: 0.085, down: 0.055, turns: 1, phase: 0.00, weight: 1.00 },
  { across: -0.048, down: 0.101, turns: 2, phase: 0.37, weight: 0.72 },
  { across: 0.132, down: -0.037, turns: 3, phase: 0.68, weight: 0.55 }
];

/** How far the field leans at a cell, at `turns` of the clip. In [-1, 1] by construction. */
export function fieldAt(column, row, turns) {
  let total = 0;
  let scale = 0;
  for (const wave of WAVES) {
    total += wave.weight * Math.sin(
      FULL_TURN * (wave.across * column + wave.down * row + wave.turns * turns + wave.phase)
    );
    scale += wave.weight;
  }
  return total / scale;
}

/**
 * How firmly the field leans before a cell counts as part of a channel rather than as a
 * place the current is about to change its mind about. The one number in the drawing that
 * is a matter of taste; everything else follows from the waves.
 */
export const CHANNEL_LEAN = 0.24;

/** Every cell of the grid at `turns`: which way it is turned, and how firmly. */
export function tilesAt(turns) {
  const tiles = [];
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let column = 0; column < COLUMN_COUNT; column += 1) {
      const lean = fieldAt(column, row, turns);
      tiles.push({ column, row, direction: lean > 0, lean, channel: Math.abs(lean) > CHANNEL_LEAN });
    }
  }
  return tiles;
}

/**
 * The two quarter arcs a tile draws, centred on opposite corners so their ends meet the
 * midpoints of the tile's edges. Whichever way a tile is turned, its arcs meet its
 * neighbours' at the same four points, which is what lets the curves join up across the
 * grid however the orientations fall.
 */
export function tileArcs(tile, tileSize, margin) {
  const x = margin + tile.column * tileSize;
  const y = margin + tile.row * tileSize;
  if (tile.direction) {
    return [
      { x, y, diameter: tileSize, start: 0, stop: QUARTER_TURN },
      {
        x: x + tileSize,
        y: y + tileSize,
        diameter: tileSize,
        start: HALF_TURN,
        stop: HALF_TURN + QUARTER_TURN
      }
    ];
  }
  return [
    { x: x + tileSize, y, diameter: tileSize, start: QUARTER_TURN, stop: HALF_TURN },
    {
      x,
      y: y + tileSize,
      diameter: tileSize,
      start: HALF_TURN + QUARTER_TURN,
      stop: FULL_TURN
    }
  ];
}

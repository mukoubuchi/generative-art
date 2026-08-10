export const COLUMN_COUNT = 28;
export const ROW_COUNT = 18;
/** Hue runs from cyan to a deep blue across the grid. */
export const HUE_LOW = 178;
export const HUE_HIGH = 224;

const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

/**
 * One tile's orientation, hue and strength. `noise` is injected so the grid can be built
 * without a p5 instance.
 *
 * Orientation is a noise field pushed one way or the other by a travelling sine wave. The
 * noise alone would scatter the tiles; the wave biases whole diagonal bands towards the
 * same orientation, and that bias is what makes the arcs read as currents rather than as
 * a random weave.
 */
export function buildTiles(noise) {
  const tiles = [];
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let column = 0; column < COLUMN_COUNT; column += 1) {
      const orientation = noise(column * 0.115, row * 0.115);
      const tide = Math.sin(
        column * 0.41 + row * 0.16 + noise(row * 0.07 + 40) * FULL_TURN
      ) * 0.085;
      tiles.push({
        column,
        row,
        direction: orientation + tide > 0.5,
        hue: mix(HUE_LOW, HUE_HIGH, noise(column * 0.082 + 90, row * 0.082 + 90)),
        strength: noise(column * 0.15 + 180, row * 0.15 + 180)
      });
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

/**
 * The four passes the sketch drew, thickest and faintest first. Stacking them turns a
 * plain arc into a current with a glow around a bright core.
 */
export const TIDE_LAYERS = [
  { weight: 13.0, alpha: 5.5, saturation: 76, brightness: 48, hueOffset: -7 },
  { weight: 7.0, alpha: 8.0, saturation: 78, brightness: 55, hueOffset: -4 },
  { weight: 2.7, alpha: 74.0, saturation: 72, brightness: 52, hueOffset: 0 },
  { weight: 0.75, alpha: 50.0, saturation: 16, brightness: 98, hueOffset: 9 }
];

/** A layer's stroke for one tile: stronger tiles are brighter and more opaque. */
export function layerStroke(layer, tile) {
  return {
    hue: tile.hue + layer.hueOffset,
    saturation: layer.saturation,
    brightness: layer.brightness * mix(0.84, 1.0, tile.strength),
    alpha: layer.alpha * mix(0.68, 1.0, tile.strength)
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  COLUMN_COUNT,
  HUE_HIGH,
  HUE_LOW,
  ROW_COUNT,
  TIDE_LAYERS,
  buildTiles,
  layerStroke,
  tileArcs
} from "../artworks/truchet-tides/tiles.js";

const TILE_SIZE = (960 - 64) / COLUMN_COUNT;
const MARGIN = 32;
const noise = (x, y = 0) => 0.5 + 0.5 * Math.sin(x * 1.7 + y * 2.3);
const tiles = buildTiles(noise);

/** Where a tile's arc ends up, as a point on the circle it is drawn from. */
function endpoints(arc) {
  const radius = arc.diameter / 2;
  return [arc.start, arc.stop].map((angle) => ({
    x: arc.x + radius * Math.cos(angle),
    y: arc.y + radius * Math.sin(angle)
  }));
}

test("the grid divides the framed area exactly", () => {
  assert.equal(TILE_SIZE, 32);
  assert.equal(COLUMN_COUNT * TILE_SIZE, 960 - 2 * MARGIN);
  assert.equal(ROW_COUNT * TILE_SIZE, 640 - 2 * MARGIN);
  assert.equal(tiles.length, COLUMN_COUNT * ROW_COUNT);
});

test("every tile draws two quarter arcs on opposite corners", () => {
  for (const tile of tiles) {
    const arcs = tileArcs(tile, TILE_SIZE, MARGIN);
    assert.equal(arcs.length, 2);
    for (const arc of arcs) {
      assert.ok(Math.abs(arc.stop - arc.start - Math.PI / 2) < 1e-12);
      assert.equal(arc.diameter, TILE_SIZE);
    }
    const separation = Math.hypot(arcs[0].x - arcs[1].x, arcs[0].y - arcs[1].y);
    assert.ok(Math.abs(separation - TILE_SIZE * Math.SQRT2) < 1e-9, "corners are diagonal");
  }
});

test("both orientations meet the same four points on the tile's edges", () => {
  const key = (point) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
  const midpoints = (tile) => new Set(
    tileArcs(tile, TILE_SIZE, MARGIN).flatMap(endpoints).map(key)
  );
  const base = { column: 3, row: 4 };
  const turned = midpoints({ ...base, direction: true });
  const other = midpoints({ ...base, direction: false });

  assert.equal(turned.size, 4);
  assert.deepEqual([...turned].sort(), [...other].sort());

  // And those four points are the midpoints of the tile's edges, which is why the curves
  // join up across the grid however the orientations fall.
  const x = MARGIN + base.column * TILE_SIZE;
  const y = MARGIN + base.row * TILE_SIZE;
  const half = TILE_SIZE / 2;
  const expected = [
    { x: x + half, y },
    { x: x + TILE_SIZE, y: y + half },
    { x: x + half, y: y + TILE_SIZE },
    { x, y: y + half }
  ].map(key).sort();
  assert.deepEqual([...turned].sort(), expected);
});

test("hue stays inside the palette and strength inside the noise range", () => {
  for (const tile of tiles) {
    assert.ok(tile.hue >= HUE_LOW - 1e-9 && tile.hue <= HUE_HIGH + 1e-9);
    assert.ok(tile.strength >= 0 && tile.strength <= 1);
    assert.equal(typeof tile.direction, "boolean");
  }
});

test("the tide bias turns whole bands of tiles the same way", () => {
  // Without the sine term the orientation field is the noise alone; with it, neighbouring
  // tiles along a band agree more often than they would by chance.
  let agreements = 0;
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let column = 1; column < COLUMN_COUNT; column += 1) {
      const here = tiles[column + row * COLUMN_COUNT];
      const before = tiles[column - 1 + row * COLUMN_COUNT];
      if (here.direction === before.direction) {
        agreements += 1;
      }
    }
  }
  const pairs = ROW_COUNT * (COLUMN_COUNT - 1);
  assert.ok(agreements / pairs > 0.5, "runs of like-turned tiles, not a coin toss");
});

test("four layers stack from thick and faint to thin and bright", () => {
  assert.equal(TIDE_LAYERS.length, 4);
  for (let index = 1; index < TIDE_LAYERS.length; index += 1) {
    assert.ok(TIDE_LAYERS[index].weight < TIDE_LAYERS[index - 1].weight);
  }
  assert.ok(TIDE_LAYERS[3].brightness > TIDE_LAYERS[0].brightness);
});

test("a stronger tile is drawn brighter and more opaque", () => {
  const weak = layerStroke(TIDE_LAYERS[2], { hue: 200, strength: 0 });
  const strong = layerStroke(TIDE_LAYERS[2], { hue: 200, strength: 1 });

  assert.ok(strong.brightness > weak.brightness);
  assert.ok(strong.alpha > weak.alpha);
  assert.equal(strong.hue, 200 + TIDE_LAYERS[2].hueOffset);
});

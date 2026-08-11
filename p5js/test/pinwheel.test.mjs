import assert from "node:assert/strict";
import test from "node:test";
import {
  COLUMN_DRIFT,
  GRID_SIZE,
  ROW_DRIFT,
  RUN_STEP,
  TILE_LENGTH,
  allSegments,
  horizontalSegments,
  verticalSegments,
  visibleSegments
,
  DISSOLVE_FRAMES,
  FILL_FRAMES,
  HOLD_FRAMES,
  LATTICE_FRAMES,
  TOTAL_FRAMES,
  emergentSquares,
  layingOrder
} from "../artworks/pinwheel/geometry.js";

const horizontals = horizontalSegments();
const verticals = verticalSegments();

test("both families have one tile per row of every run", () => {
  // The horizontal runs start over [-2 * GRID_SIZE, GRID_SIZE) and the vertical ones over
  // [-3 * GRID_SIZE - 1, GRID_SIZE); the extra unit is what offsets the two families.
  assert.equal(horizontals.length, Math.ceil(3 * GRID_SIZE / RUN_STEP) * GRID_SIZE);
  assert.equal(verticals.length, Math.ceil((4 * GRID_SIZE + 1) / RUN_STEP) * GRID_SIZE);
  assert.equal(allSegments().length, horizontals.length + verticals.length);
});

test("every tile is three units long and axis-aligned", () => {
  for (const segment of horizontals) {
    assert.equal(segment.y1, segment.y2);
    assert.equal(segment.x2 - segment.x1, TILE_LENGTH);
  }
  for (const segment of verticals) {
    assert.equal(segment.x1, segment.x2);
    assert.equal(segment.y2 - segment.y1, TILE_LENGTH);
  }
});

test("the two families drift by different amounts, which is what squares the weave", () => {
  assert.equal(ROW_DRIFT, 2);
  assert.equal(COLUMN_DRIFT, 3);
  for (let index = 1; index < GRID_SIZE; index += 1) {
    assert.equal(horizontals[index].x1 - horizontals[index - 1].x1, ROW_DRIFT);
    assert.equal(horizontals[index].y1 - horizontals[index - 1].y1, 1);
    assert.equal(verticals[index].y1 - verticals[index - 1].y1, COLUMN_DRIFT);
    assert.equal(verticals[index].x1 - verticals[index - 1].x1, 1);
  }
});

test("a tile's length plus the leftover of its drift accounts for the run spacing", () => {
  // Along a row the tiles repeat every RUN_STEP units, and each is TILE_LENGTH long, so
  // the gap between neighbours is what the crossing family has to fill.
  assert.equal(RUN_STEP - TILE_LENGTH, 2);
});

test("every row carries the same rhythm of tiles, edge to edge", () => {
  const gap = RUN_STEP - TILE_LENGTH;
  const visible = visibleSegments(allSegments());

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const starts = visible
      .filter((segment) => segment.y1 === row && segment.y2 === row)
      .map((segment) => segment.x1)
      .sort((left, right) => left - right);

    assert.ok(starts.length >= 2, `row ${row} has too few tiles`);
    for (let index = 1; index < starts.length; index += 1) {
      assert.equal(starts[index] - starts[index - 1], RUN_STEP);
    }
    assert.ok(starts[0] <= gap, `row ${row} starts too far in`);
    assert.ok(starts[starts.length - 1] + TILE_LENGTH >= GRID_SIZE - gap, `row ${row} stops short`);
  }
});

test("every column carries the same rhythm, a quarter turn round", () => {
  const gap = RUN_STEP - TILE_LENGTH;
  const visible = visibleSegments(allSegments());

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const starts = visible
      .filter((segment) => segment.x1 === column && segment.x2 === column)
      .map((segment) => segment.y1)
      .sort((left, right) => left - right);

    assert.ok(starts.length >= 2, `column ${column} has too few tiles`);
    for (let index = 1; index < starts.length; index += 1) {
      assert.equal(starts[index] - starts[index - 1], RUN_STEP);
    }
    assert.ok(starts[0] <= gap, `column ${column} starts too far in`);
    assert.ok(
      starts[starts.length - 1] + TILE_LENGTH >= GRID_SIZE - gap,
      `column ${column} stops short`
    );
  }
});

test("the squares emerge from the walls: two sizes only, large and small, each in its place", () => {
  const squares = emergentSquares();

  assert.ok(squares.length >= 40);
  const sizes = new Set(squares.map((square) => square.size));
  assert.deepEqual([...sizes].sort(), [1, 2]);
  // Every found region is a full square, not a clipped or merged shape.
  for (const square of squares) {
    assert.equal(square.cells, square.size * square.size);
  }
  // Both families are well represented and no two squares overlap.
  assert.ok(squares.filter((square) => square.size === 2).length >= 20);
  assert.ok(squares.filter((square) => square.size === 1).length >= 16);
  const claimed = new Set();
  for (const square of squares) {
    for (let dx = 0; dx < square.size; dx += 1) {
      for (let dy = 0; dy < square.size; dy += 1) {
        const cell = `${square.x + dx},${square.y + dy}`;
        assert.ok(!claimed.has(cell));
        claimed.add(cell);
      }
    }
  }
});

test("the laying order covers every visible tile once and the clip plan lands on three hundred", async () => {
  const order = layingOrder();
  const visible = visibleSegments(allSegments());
  assert.equal(order.length, visible.length);
  const measure = (tile) => (tile.x1 + tile.x2 + tile.y1 + tile.y2) / 2;
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(measure(order[index]) >= measure(order[index - 1]) - 1e-9);
  }

  assert.equal(LATTICE_FRAMES + FILL_FRAMES + HOLD_FRAMES + DISSOLVE_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, 300);
  const { readFileSync } = await import("node:fs");
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "pinwheel");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});

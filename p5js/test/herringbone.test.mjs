import assert from "node:assert/strict";
import test from "node:test";
import {
  GRID_SIZE,
  RUN_STEP,
  TILE_LENGTH,
  allSegments,
  horizontalSegments,
  verticalSegments,
  visibleSegments
,
  DISSOLVE_FRAMES,
  HOLD_FRAMES,
  LAY_FRAMES,
  TOTAL_FRAMES,
  layingOrder
} from "../artworks/herringbone/geometry.js";

const GAP = RUN_STEP - TILE_LENGTH;
const horizontals = horizontalSegments();
const verticals = verticalSegments();

test("both families have one tile per row of every run", () => {
  const runs = Math.ceil(3 * GRID_SIZE / RUN_STEP);

  assert.equal(horizontals.length, runs * GRID_SIZE);
  assert.equal(verticals.length, runs * GRID_SIZE);
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

test("a run drifts one unit per row, which is what makes it diagonal", () => {
  for (let index = 1; index < GRID_SIZE; index += 1) {
    assert.equal(horizontals[index].x1 - horizontals[index - 1].x1, 1);
    assert.equal(horizontals[index].y1 - horizontals[index - 1].y1, 1);
    assert.equal(verticals[index].y1 - verticals[index - 1].y1, 1);
    assert.equal(verticals[index].x1 - verticals[index - 1].x1, 1);
  }
});

test("the vertical family is offset from the horizontal one by a single unit", () => {
  // Both families start their runs on the same four-unit lattice; the verticals are
  // shifted by one so their tiles land in the gaps the horizontals leave.
  const firstHorizontalRun = horizontals[0].x1;
  const firstVerticalRun = verticals[0].y1;

  assert.equal(firstHorizontalRun, -GRID_SIZE);
  assert.equal(firstVerticalRun, -GRID_SIZE - 1);
  assert.equal(Math.abs(firstHorizontalRun - firstVerticalRun) % RUN_STEP, 1);
});

test("every row carries the same rhythm of tiles, edge to edge", () => {
  const visible = visibleSegments(allSegments());

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const starts = visible
      .filter((segment) => segment.y1 === row && segment.y2 === row)
      .map((segment) => segment.x1)
      .sort((left, right) => left - right);

    assert.ok(starts.length >= 2, `row ${row} has too few tiles`);
    // Consecutive tiles are one run step apart, so each leaves a gap of exactly
    // RUN_STEP - TILE_LENGTH units — the gap the crossing family fills.
    for (let index = 1; index < starts.length; index += 1) {
      assert.equal(starts[index] - starts[index - 1], RUN_STEP);
    }
    // The weave has a phase, so the canvas edge falls wherever it falls; what has to hold
    // is that no more than one gap's worth of the row is left without a tile at each end.
    assert.ok(starts[0] <= GAP, `row ${row} starts too far in`);
    assert.ok(starts[starts.length - 1] + TILE_LENGTH >= GRID_SIZE - GAP, `row ${row} stops short`);
  }
});

test("every column carries the same rhythm, a quarter turn round", () => {
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
    assert.ok(starts[0] <= GAP, `column ${column} starts too far in`);
    assert.ok(starts[starts.length - 1] + TILE_LENGTH >= GRID_SIZE - GAP, `column ${column} stops short`);
  }
});

test("the laying order covers every visible tile once, both families arriving together", () => {
  const order = layingOrder();
  const visible = visibleSegments(allSegments());

  assert.equal(order.length, visible.length);
  assert.equal(order.length, 60);
  const key = (tile) => `${tile.x1},${tile.y1},${tile.x2},${tile.y2}`;
  assert.deepEqual(new Set(order.map(key)), new Set(visible.map(key)));

  // The sweep never retreats.
  const measure = (tile) => (tile.x1 + tile.x2 + tile.y1 + tile.y2) / 2;
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(measure(order[index]) >= measure(order[index - 1]) - 1e-9);
  }
  // The harmony is of opposites arriving together: every quarter of the laying holds
  // both directions, and the whole is thirty of each.
  assert.equal(order.filter((tile) => tile.horizontal).length, 30);
  for (let quarter = 0; quarter < 4; quarter += 1) {
    const slice = order.slice(quarter * 15, (quarter + 1) * 15);
    assert.ok(slice.some((tile) => tile.horizontal));
    assert.ok(slice.some((tile) => !tile.horizontal));
  }
});

test("the clip's plan lands on three hundred frames and the manifest agrees", async () => {
  const { readFileSync } = await import("node:fs");
  assert.equal(LAY_FRAMES + HOLD_FRAMES + DISSOLVE_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, 300);
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "herringbone");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});

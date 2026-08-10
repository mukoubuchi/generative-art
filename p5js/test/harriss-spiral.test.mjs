import assert from "node:assert/strict";
import test from "node:test";
import {
  PLASTIC_RATIO,
  arcPoints,
  buildCells,
  partitionLines,
  rectangleCorners,
  rootRectangle
} from "../artworks/harriss-spiral/spiral.js";

const WIDTH = 795;
const HEIGHT = 600;
const MARGIN = 20;
const MINIMUM_SQUARE_SIDE = 5;
const root = rootRectangle(WIDTH, HEIGHT, MARGIN);
const cells = buildCells(root, MINIMUM_SQUARE_SIDE);

test("the plastic ratio really solves its own equation", () => {
  assert.ok(Math.abs(PLASTIC_RATIO ** 3 - PLASTIC_RATIO - 1) < 1e-12);
  assert.ok(Math.abs(PLASTIC_RATIO - 1.324717957244746) < 1e-15);
});

test("the root rectangle is exactly plastic and centred inside the margins", () => {
  assert.ok(Math.abs(root.longSide / root.shortSide - PLASTIC_RATIO) < 1e-12);
  assert.ok(Math.abs(root.origin.x - (WIDTH - root.longSide) / 2) < 1e-12);
  assert.ok(Math.abs(root.origin.y - (HEIGHT - root.shortSide) / 2) < 1e-12);
  // The short side is what the margins limit here, so it fills them exactly.
  assert.ok(Math.abs(root.shortSide - (HEIGHT - 2 * MARGIN)) < 1e-12);
  assert.ok(root.longSide <= WIDTH - 2 * MARGIN + 1e-12);
});

test("every subdivision tiles its parent without a remainder", () => {
  for (const cell of cells) {
    const parentShort = cell.rectangle.shortSide;
    const largeChildShortSide = parentShort / PLASTIC_RATIO;
    const smallChildShortSide = cell.squareSide / PLASTIC_RATIO;

    // The square and the large child's short side lie end to end along the long side.
    assert.ok(Math.abs(largeChildShortSide + cell.squareSide - cell.rectangle.longSide) < 1e-9);
    // The square and the small child stack up the short side.
    assert.ok(Math.abs(cell.squareSide + smallChildShortSide - parentShort) < 1e-9);
  }
});

test("every rectangle in the tree keeps the plastic proportion", () => {
  for (const cell of cells) {
    assert.ok(Math.abs(cell.rectangle.longSide / cell.rectangle.shortSide - PLASTIC_RATIO) < 1e-9);
  }
});

test("recursion stops at the cutoff and produces the same count as the original", () => {
  assert.equal(cells.length, 405);
  for (const cell of cells) {
    assert.ok(cell.squareSide >= MINIMUM_SQUARE_SIDE);
  }
  // A coarser cutoff has to give strictly fewer cells, and a finer one strictly more.
  assert.ok(buildCells(root, 2 * MINIMUM_SQUARE_SIDE).length < cells.length);
  assert.ok(buildCells(root, MINIMUM_SQUARE_SIDE / 2).length > cells.length);
});

test("both arcs of a cell are quarter turns on the square they spring from", () => {
  for (const cell of cells) {
    for (const arc of [cell.largeBranchArc, cell.smallBranchArc]) {
      assert.ok(Math.abs(Math.abs(arc.endAngle - arc.startAngle) - Math.PI / 2) < 1e-12);
      // Radius times root two is the side of the square the arc's ends sit on.
      assert.ok(arc.radius > 0);
    }
    assert.ok(Math.abs(cell.largeBranchArc.radius * Math.SQRT2 - cell.squareSide) < 1e-9);
    const smallChord = cell.squareSide / (PLASTIC_RATIO * PLASTIC_RATIO);
    assert.ok(Math.abs(cell.smallBranchArc.radius * Math.SQRT2 - smallChord) < 1e-9);
  }
});

test("an arc is sampled finely enough to read as a curve at any size", () => {
  const spacing = 4;
  for (const cell of [cells[0], cells[cells.length - 1]]) {
    const points = arcPoints(cell.largeBranchArc, spacing);

    assert.ok(points.length >= 5, "four segments is the floor");
    for (const point of points) {
      const radius = Math.hypot(
        point.x - cell.largeBranchArc.center.x,
        point.y - cell.largeBranchArc.center.y
      );
      assert.ok(Math.abs(radius - cell.largeBranchArc.radius) < 1e-9);
    }
  }
});

test("each cell contributes one rectangle outline's worth of cuts", () => {
  assert.equal(rectangleCorners(root).length, 4);
  for (const cell of cells) {
    const lines = partitionLines(cell);
    assert.equal(lines.length, 2);
    for (const [start, end] of lines) {
      assert.ok(Math.hypot(end.x - start.x, end.y - start.y) > 0);
    }
  }
});

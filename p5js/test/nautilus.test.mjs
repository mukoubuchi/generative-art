import assert from "node:assert/strict";
import test from "node:test";
import {
  ROTATION_STEP,
  boundingBox,
  buildSquares,
  fitToCanvas,
  shrinkStep,
  squareAt
} from "../artworks/nautilus/geometry.js";

const squares = buildSquares();

test("the shell is built from a fixed number of four-cornered squares", () => {
  // The eased step lands on 158 squares whether the loop is run in the original's 32-bit
  // floats at radius 200 or in doubles at radius 1, so the count is not a precision artefact.
  assert.equal(squares.length, 158);
  for (const square of squares) {
    assert.equal(square.length, 4);
  }
});

test("the step eases from coarse at the rim to fine at the centre", () => {
  assert.ok(Math.abs(shrinkStep(1) - 5 / 200) < 1e-12);
  assert.ok(Math.abs(shrinkStep(0) - 0.1 / 200) < 1e-12);
  // Monotone in radius, so the turns crowd together towards the centre and never reverse.
  for (let radius = 1; radius > 0; radius -= 0.05) {
    assert.ok(shrinkStep(radius) > shrinkStep(radius - 0.05));
  }
});

test("each square keeps its corner on the anchor and stays a square", () => {
  const square = squareAt(0.5, ROTATION_STEP * 3);

  assert.ok(Math.hypot(square[0].x, square[0].y) < 1e-12);
  const sides = square.map((corner, index) => {
    const next = square[(index + 1) % square.length];
    return Math.hypot(next.x - corner.x, next.y - corner.y);
  });
  for (const side of sides) {
    assert.ok(Math.abs(side - 0.5) < 1e-12);
  }
});

test("the squares turn ten degrees each and wind more than four full turns", () => {
  const first = squareAt(1, 0);
  const second = squares[1];
  const angleOf = (square) => Math.atan2(square[1].y, square[1].x);

  assert.ok(Math.abs(angleOf(first)) < 1e-12);
  assert.ok(Math.abs(angleOf(second) - ROTATION_STEP) < 1e-12);
  const totalTurn = Math.abs(ROTATION_STEP) * (squares.length - 1);
  assert.ok(totalTurn > 4 * Math.PI * 2);
  assert.ok(totalTurn < 5 * Math.PI * 2);
});

test("the fitted figure is centred and stays inside the canvas", () => {
  const width = 680;
  const height = 680;
  const fillRatio = 0.88;
  const placement = fitToCanvas(squares, width, height, fillRatio);
  const box = boundingBox(squares);
  const placed = {
    left: placement.offsetX + placement.scale * box.left,
    right: placement.offsetX + placement.scale * box.right,
    top: placement.offsetY + placement.scale * box.top,
    bottom: placement.offsetY + placement.scale * box.bottom
  };

  assert.ok(Math.abs((placed.left + placed.right) / 2 - width / 2) < 1e-9);
  assert.ok(Math.abs((placed.top + placed.bottom) / 2 - height / 2) < 1e-9);
  assert.ok(placed.left >= 0 && placed.right <= width);
  assert.ok(placed.top >= 0 && placed.bottom <= height);
  // The longer side of the figure fills the requested share of the canvas exactly.
  const longest = Math.max(placed.right - placed.left, placed.bottom - placed.top);
  assert.ok(Math.abs(longest - fillRatio * Math.min(width, height)) < 1e-9);
});

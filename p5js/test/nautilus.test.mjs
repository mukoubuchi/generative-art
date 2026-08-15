import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ROTATION_STEP,
  boundingBox,
  buildChambers,
  buildSquares,
  fitToCanvas,
  shrinkStep,
  squareAt
} from "../artworks/nautilus/geometry.js";

const squares = buildSquares();

test("growth order: each chamber outgrows the last, from the low-vaulted first room out", () => {
  const chambers = buildChambers();

  assert.equal(chambers.length, 158);
  for (let index = 1; index < chambers.length; index += 1) {
    assert.ok(chambers[index].radius > chambers[index - 1].radius);
  }
  // The first room is tiny and the last is the whole start radius: the shell's life
  // runs from under a hundredth to one.
  assert.ok(chambers[0].radius < 0.01);
  assert.equal(chambers.at(-1).radius, 1);
  // Growth order and construction order are one list read two ways.
  assert.deepEqual(
    chambers.map((chamber) => chamber.corners).reverse(),
    squares
  );
});

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

/** Every p5 lifecycle hook the sketch installs, in the order it installs them. */
function lifecycleHooks(source) {
  return [...source.matchAll(/^ {2}p\.(\w+) = \(\) =>/gmu)].map(([, hook]) => hook);
}

/**
 * Every request the sketch makes to draw the shell, with the count asked for. The
 * declaration is not a request, so it is stepped over rather than counted as one.
 */
function shellDrawings(source) {
  return [...source.matchAll(/(?<!function )\bdrawShell\(([^)]*)\)/gu)].map(([, count]) => count);
}

test("the one drawing the page makes is of the whole shell", async () => {
  // Not where the loop is stopped -- the capture contract asks that of every still, and
  // asks it of this one now that nothing is excused from it. This asks what the drawing
  // draws. There is one request to draw the shell in the whole sketch and it names every
  // chamber there is, so the first picture the page puts up is the last one it would have
  // reached: a reader arrives at a finished shell rather than watching one assemble.
  const sketch = await readFile(
    new URL("../artworks/nautilus/sketch.js", import.meta.url), "utf8");
  assert.deepEqual(shellDrawings(sketch), ["CHAMBERS.length"]);
  assert.deepEqual(lifecycleHooks(sketch), ["setup", "draw"]);
  // And the count it names is the shell rather than a number that reads like one.
  assert.equal(buildChambers().length, squares.length);
});

test("the scan finds the partial shell in the sketch that assembled one", async () => {
  // The negative control, and the real thing rather than one invented for the occasion:
  // the sketch as it stood through v1.8.0, when the page drew the shell a chamber at a
  // time while the manifest registered a still. The capture already took it finished, so
  // the two requests below are exactly the divergence -- one for the picture that was
  // published, one for the picture a reader got.
  const specimen = await readFile(
    new URL("./fixtures/nautilus-building/sketch.js", import.meta.url), "utf8");
  assert.deepEqual(shellDrawings(specimen), ["CHAMBERS.length", "built"]);
  assert.deepEqual(lifecycleHooks(specimen), ["setup", "draw"]);
  assert.ok(specimen.includes("let built = 0"), "the specimen carries no build-up counter");
  // And the specimen is otherwise this artwork, on the same geometry and the same palette,
  // so what the scan above rejects it for is the partial drawing and nothing else about it.
  assert.ok(specimen.includes("buildChambers"), "the specimen is not this artwork");
  assert.ok(specimen.includes("const FILL_RATIO = 0.88;"), "the specimen is fitted differently");
});

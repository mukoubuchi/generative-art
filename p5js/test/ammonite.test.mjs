import assert from "node:assert/strict";
import test from "node:test";
import {
  ANGLE_STEP_DEGREES,
  BAND_COUNT,
  FIRST_BAND_RADIUS,
  boundingBox,
  fitToCanvas,
  stripTriangles,
  stripVertices
} from "../artworks/ammonite/geometry.js";

const SAMPLES_PER_BAND = 360 / ANGLE_STEP_DEGREES + 1;
const vertices = stripVertices();
const triangles = stripTriangles(vertices);
const radiusOf = (vertex) => Math.hypot(vertex.x, vertex.y);

test("five bands contribute an inner and an outer vertex per sampled angle", () => {
  assert.equal(vertices.length, BAND_COUNT * SAMPLES_PER_BAND * 2);
  // A triangle strip makes one triangle from every three consecutive vertices.
  assert.equal(triangles.length, vertices.length - 2);
});

test("every outer vertex sits at twice the radius of its inner partner", () => {
  for (let index = 0; index < vertices.length; index += 2) {
    const inner = vertices[index];
    const outer = vertices[index + 1];
    assert.ok(Math.abs(radiusOf(outer) - 2 * radiusOf(inner)) < 1e-9);
    // Both lie on the same ray, so the strip's rungs are radial.
    assert.ok(Math.abs(inner.x * outer.y - inner.y * outer.x) < 1e-9);
  }
});

test("each band doubles its radius over one turn and hands it to the next", () => {
  for (let band = 0; band < BAND_COUNT; band += 1) {
    const first = vertices[band * SAMPLES_PER_BAND * 2];
    const last = vertices[(band + 1) * SAMPLES_PER_BAND * 2 - 2];
    const expected = FIRST_BAND_RADIUS * 2 ** band;

    assert.ok(Math.abs(radiusOf(first) - expected) < 1e-9);
    assert.ok(Math.abs(radiusOf(last) - 2 * expected) < 1e-9);
    if (band + 1 < BAND_COUNT) {
      const nextFirst = vertices[(band + 1) * SAMPLES_PER_BAND * 2];
      assert.ok(Math.abs(radiusOf(nextFirst) - radiusOf(last)) < 1e-9);
    }
  }
});

test("the shell reaches four times the last band radius and no further", () => {
  const outermost = FIRST_BAND_RADIUS * 2 ** (BAND_COUNT - 1) * 4;

  assert.equal(outermost, 192);
  assert.ok(Math.max(...vertices.map(radiusOf)) - outermost < 1e-9);
});

test("the fitted figure is centred and stays inside the canvas", () => {
  const width = 680;
  const height = 680;
  const fillRatio = 0.9;
  const placement = fitToCanvas(vertices, width, height, fillRatio);
  const box = boundingBox(vertices);
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
  const longest = Math.max(placed.right - placed.left, placed.bottom - placed.top);
  assert.ok(Math.abs(longest - fillRatio * Math.min(width, height)) < 1e-9);
});

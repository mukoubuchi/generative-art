import assert from "node:assert/strict";
import test from "node:test";
import {
  CORNER_ANGLE,
  FACE_COUNT,
  PAIR_COUNT,
  X_RATIO,
  Y_RATIO,
  angleAt,
  envelope,
  stripQuads,
  stripVertices
} from "../artworks/necker-cube/cube.js";

const RADIUS = 680 / 3;
const WIDTH = 680;
const QUARTER_TURN = Math.PI / 2;

test("the strip closes into four faces", () => {
  const vertices = stripVertices(0, RADIUS);
  const quads = stripQuads(vertices);

  assert.equal(vertices.length, 2 * PAIR_COUNT);
  assert.equal(quads.length, FACE_COUNT);
  for (const quad of quads) {
    assert.equal(quad.length, 4);
  }
  // The fifth pair repeats the first, which is what closes the ring.
  assert.ok(Math.abs(vertices[8].x - vertices[0].x) < 1e-9);
  assert.ok(Math.abs(vertices[9].y - vertices[1].y) < 1e-9);
});

test("the projection is the isometric one the corner angle sets", () => {
  assert.ok(Math.abs(CORNER_ANGLE - Math.PI / 3) < 1e-12);
  assert.ok(Math.abs(X_RATIO - 0.5) < 1e-12);
  assert.ok(Math.abs(Y_RATIO - Math.sqrt(3) / 2) < 1e-12);
});

test("each pair is one radius long and level with itself", () => {
  for (const angle of [0, 0.4, 1.9, -2.6]) {
    const vertices = stripVertices(angle, RADIUS);
    for (let index = 0; index < vertices.length; index += 2) {
      assert.ok(Math.abs(vertices[index + 1].y - vertices[index].y) < 1e-9);
      assert.ok(Math.abs(vertices[index].x - vertices[index + 1].x - RADIUS) < 1e-9);
    }
  }
});

test("the near corners ride an ellipse a quarter turn apart", () => {
  const angle = 0.7;
  const vertices = stripVertices(angle, RADIUS);

  for (let pair = 0; pair < PAIR_COUNT; pair += 1) {
    const near = vertices[pair * 2];
    const theta = angle + pair * QUARTER_TURN;
    assert.ok(Math.abs(near.x - RADIUS * X_RATIO * Math.cos(theta)) < 1e-9);
    assert.ok(Math.abs(near.y - RADIUS * Y_RATIO * Math.sin(theta)) < 1e-9);
  }
});

test("crossing the canvas turns the cube exactly once", () => {
  assert.ok(Math.abs(angleAt(0, WIDTH) - Math.PI) < 1e-12);
  assert.ok(Math.abs(angleAt(WIDTH / 2, WIDTH)) < 1e-12);
  assert.ok(Math.abs(angleAt(WIDTH, WIDTH) + Math.PI) < 1e-12);
});

test("the figure repeats every quarter turn, which is the cube's own symmetry", () => {
  // Compare the distinct corners: the strip repeats one pair to close itself, and a
  // quarter turn changes which pair that is without moving any corner.
  const key = (vertices) => [
    ...new Set(vertices.map((vertex) => `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)}`))
  ].sort().join("|");

  assert.equal(key(stripVertices(0.3 + QUARTER_TURN, RADIUS)), key(stripVertices(0.3, RADIUS)));
  assert.equal(key(stripVertices(0.3 + Math.PI, RADIUS)), key(stripVertices(0.3, RADIUS)));
});

test("the envelope reaches a radius further one way than the other", () => {
  const bounds = envelope(RADIUS);

  assert.ok(Math.abs(bounds.right - bounds.left - RADIUS * (1 + 2 * X_RATIO)) < 1e-9);
  assert.ok(Math.abs(bounds.bottom - bounds.top - 2 * RADIUS * Y_RATIO) < 1e-9);
  // The anchor sits half a radius off the middle of that envelope.
  assert.ok(Math.abs((bounds.left + bounds.right) / 2 + RADIUS / 2) < 1e-9);
});

test("every vertex of every frame stays inside the envelope", () => {
  const bounds = envelope(RADIUS);

  for (let frame = 0; frame < 180; frame += 1) {
    const angle = angleAt(frame * WIDTH / 180, WIDTH);
    for (const vertex of stripVertices(angle, RADIUS)) {
      assert.ok(vertex.x >= bounds.left - 1e-9 && vertex.x <= bounds.right + 1e-9);
      assert.ok(vertex.y >= bounds.top - 1e-9 && vertex.y <= bounds.bottom + 1e-9);
    }
  }
});

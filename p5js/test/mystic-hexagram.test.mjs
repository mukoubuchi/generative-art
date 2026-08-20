import assert from "node:assert/strict";
import test from "node:test";
import {
  CONIC_RADIUS_X,
  CONIC_RADIUS_Y,
  PARAMETER_SLOTS,
  TOTAL_FRAMES,
  VERTEX_LABELS,
  constructionAt,
  incidence,
  intersection,
  phaseAt
} from "../artworks/mystic-hexagram/pascal.js";

test("the six names preserve Pascal's 1640 hexagon order", () => {
  assert.deepEqual(VERTEX_LABELS, ["K", "P", "Q", "V", "O", "N"]);
  assert.deepEqual(PARAMETER_SLOTS, [0, 2, 4, 1, 5, 3]);
});

test("every moving vertex remains on one ellipse", () => {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const { vertices } = constructionAt(frame);
    for (const point of Object.values(vertices)) {
      const equation = (point.x / CONIC_RADIUS_X) ** 2 + (point.y / CONIC_RADIUS_Y) ** 2;
      assert.ok(Math.abs(equation - 1) < 1e-12, `frame ${frame} misses by ${equation - 1}`);
    }
  }
});

test("the six vertices never collide while they travel", () => {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const points = Object.values(constructionAt(frame).vertices);
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        assert.ok(Math.hypot(
          points[first].x - points[second].x,
          points[first].y - points[second].y
        ) > 175);
      }
    }
  }
});

test("all six named sides pass through the vertices that name them", () => {
  const { vertices, sides } = constructionAt(73);
  for (const [name, line] of Object.entries(sides)) {
    assert.ok(Math.abs(incidence(line, vertices[name[0]])) < 1e-10);
    assert.ok(Math.abs(incidence(line, vertices[name[1]])) < 1e-10);
  }
});

test("M, T and S are the three intersections of opposite sides", () => {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 3) {
    const { sides, intersections } = constructionAt(frame);
    const expected = {
      M: intersection(sides.KP, sides.VO),
      T: intersection(sides.PQ, sides.ON),
      S: intersection(sides.QV, sides.NK)
    };
    for (const label of ["M", "T", "S"]) {
      assert.ok(Math.hypot(
        intersections[label].x - expected[label].x,
        intersections[label].y - expected[label].y
      ) < 1e-10);
    }
  }
});

test("Pascal's three opposite-side intersections stay collinear", () => {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const { intersections, pascalLine } = constructionAt(frame);
    for (const point of Object.values(intersections)) {
      assert.ok(Math.abs(incidence(pascalLine, point)) < 1e-9,
        `frame ${frame} leaves the Pascal line`);
    }
  }
});

test("the Essay's own three lines MS, NO and PQ are de mesme ordre", () => {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const { sides, intersections, pascalLine } = constructionAt(frame);
    const T = intersections.T;
    assert.ok(Math.abs(incidence(pascalLine, T)) < 1e-9);
    assert.ok(Math.abs(incidence(sides.ON, T)) < 1e-9);
    assert.ok(Math.abs(incidence(sides.PQ, T)) < 1e-9);
  }
});

test("the Pascal line and all three witnesses remain inside the drawing", () => {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const points = Object.values(constructionAt(frame).intersections);
    for (const point of points) {
      assert.ok(Math.abs(point.x) < 210);
      assert.ok(Math.abs(point.y) < 150);
    }
  }
});

test("the construction moves rather than rotating a finished bitmap", () => {
  const opening = constructionAt(0);
  const later = constructionAt(61);
  assert.ok(Math.hypot(
    opening.vertices.K.x - later.vertices.K.x,
    opening.vertices.K.y - later.vertices.K.y
  ) > 200);
  assert.ok(Math.hypot(
    opening.intersections.M.x - later.intersections.M.x,
    opening.intersections.M.y - later.intersections.M.y
  ) > 80);
});

test("ten seconds is one exact closed journey around the conic", () => {
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(phaseAt(TOTAL_FRAMES), 0);
  const { frameIndex: closingFrame, ...closing } = constructionAt(TOTAL_FRAMES);
  const { frameIndex: openingFrame, ...opening } = constructionAt(0);
  assert.equal(closingFrame, TOTAL_FRAMES);
  assert.equal(openingFrame, 0);
  assert.deepEqual(closing, opening);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  PHI,
  buildSections,
  goldenRectangle,
  sectionCorners
} from "../artworks/fibonacci-spiral/geometry.js";

const LOGICAL_WIDTH = 1010;
const LOGICAL_HEIGHT = 640;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const MARGIN = BASE_DIMENSION * 0.03125;
const MINIMUM_SIDE = BASE_DIMENSION * 0.001;
const ROOT = goldenRectangle(LOGICAL_WIDTH - 2 * MARGIN, LOGICAL_HEIGHT - 2 * MARGIN);
const ORIGIN = {
  x: (LOGICAL_WIDTH - ROOT.width) / 2,
  y: (LOGICAL_HEIGHT - ROOT.height) / 2
};

function sections() {
  return buildSections(ORIGIN, ROOT.width, ROOT.height, MINIMUM_SIDE);
}

test("the root rectangle is exactly golden and fits inside the margins", () => {
  assert.ok(Math.abs(ROOT.width / ROOT.height - PHI) < 1e-12);
  assert.ok(ROOT.width <= LOGICAL_WIDTH - 2 * MARGIN + 1e-9);
  assert.ok(ROOT.height <= LOGICAL_HEIGHT - 2 * MARGIN + 1e-9);
  // The Processing canvas was 806x500, which is 1.612 rather than phi.
  assert.ok(Math.abs(806 / 500 - PHI) > 1e-3);
});

test("each section turns a quarter and hands its short side to the next long side", () => {
  const built = sections();

  assert.ok(built.length > 10);
  built.forEach((section, index) => {
    assert.ok(Math.abs(section.width / section.height - PHI) < 1e-9);
    assert.ok(Math.abs(section.rotation - index * Math.PI / 2) < 1e-9);
    assert.equal(section.hue, index * 60 % 360);
    if (index > 0) {
      assert.ok(Math.abs(section.width - built[index - 1].height) < 1e-9);
    }
  });
});

test("the sections stop just below half an output pixel", () => {
  const built = sections();
  const smallest = built[built.length - 1];

  assert.ok(smallest.height >= MINIMUM_SIDE);
  assert.ok(smallest.height / PHI < MINIMUM_SIDE);
});

test("every section stays inside the root rectangle", () => {
  const right = ORIGIN.x + ROOT.width;
  const bottom = ORIGIN.y + ROOT.height;

  for (const section of sections()) {
    for (const corner of sectionCorners(section)) {
      assert.ok(corner.x >= ORIGIN.x - 1e-9 && corner.x <= right + 1e-9);
      assert.ok(corner.y >= ORIGIN.y - 1e-9 && corner.y <= bottom + 1e-9);
    }
  }
});

test("the second section occupies the gnomon the first one leaves behind", () => {
  const [first, second] = sections();
  const xs = sectionCorners(second).map((corner) => corner.x);

  // An exact golden root makes the split land on first.height, so the arc radii fall on
  // section boundaries instead of cutting across a rectangle.
  assert.ok(Math.abs(Math.min(...xs) - (first.x + first.height)) < 1e-9);
  assert.ok(Math.abs(Math.max(...xs) - (first.x + first.width)) < 1e-9);
});

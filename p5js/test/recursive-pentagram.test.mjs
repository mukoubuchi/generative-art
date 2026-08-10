import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArtwork,
  countSegments
} from "../artworks/recursive-pentagram/geometry.js";

test("recursive geometry matches the Processing artwork", () => {
  const drawSteps = buildArtwork({ x: 640, y: 360 }, 270, 6.75);

  assert.equal(drawSteps.length, 60);
  assert.equal(countSegments(drawSteps), 200);
  assert.ok(drawSteps.slice(0, 25).every((step) => step.length === 1));
  assert.ok(drawSteps.slice(25).every((step) => step.length === 5));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ANGLE_STEP_DEGREES,
  DOUBLING,
  bandVertices,
  fadeAlpha,
  generationRange,
  spiralRadius,
  stripTriangles,
  zoomScale
} from "../artworks/ammonite/geometry.js";

const PLAYBACK_FPS = 30;
const CLIP_SECONDS = 10;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;
const BASE_RADIUS = 30;
const CORNER_RADIUS = Math.hypot(680, 680) / 2 + 40;

test("every turn doubles the radius, and the bands hand over without a seam", () => {
  for (const theta of [0, 1, 2.5, 4 * Math.PI]) {
    assert.ok(
      Math.abs(spiralRadius(theta + 2 * Math.PI) - DOUBLING * spiralRadius(theta)) < 1e-12
    );
  }
  // A band's inner edge ends exactly where the next band's begins.
  for (const generation of [-3, 0, 2]) {
    const band = bandVertices(generation);
    const next = bandVertices(generation + 1);
    const lastInner = band.at(-2);
    const firstInner = next[0];
    assert.ok(Math.abs(Math.hypot(lastInner.x, lastInner.y)
      - Math.hypot(firstInner.x, firstInner.y)) < 1e-12);
  }
});

test("scaling is rotation on the smooth spiral: s times r(theta) is r(theta plus its log)", () => {
  for (const scale of [1.3, 2, 3.7]) {
    for (const theta of [0, 0.7, 3.1, 9]) {
      const rotated = spiralRadius(theta + 2 * Math.PI * Math.log2(scale));
      assert.ok(Math.abs(scale * spiralRadius(theta) - rotated) < 1e-12);
    }
  }
});

test("doubling a band gives the next band exactly, to the last bit", () => {
  // Multiplying by two only moves the exponent, so the discrete self-similarity the
  // loop rests on is not approximate: it survives floating point untouched.
  for (const generation of [-4, -1, 0, 3]) {
    const doubled = bandVertices(generation).map((vertex) => ({
      x: 2 * vertex.x,
      y: 2 * vertex.y
    }));
    assert.deepEqual(doubled, bandVertices(generation + 1));
  }
});

test("a band samples one turn at twelve degrees: sixty-two vertices, sixty triangles", () => {
  const band = bandVertices(0);

  assert.equal(360 % ANGLE_STEP_DEGREES, 0);
  assert.equal(band.length, 2 * (360 / ANGLE_STEP_DEGREES + 1));
  assert.equal(stripTriangles(band).length, band.length - 2);
});

test("the camera pulls back by exactly one doubling, so the loop closes shifted by one generation", () => {
  assert.equal(zoomScale(0, TOTAL_FRAMES), 1);
  assert.equal(zoomScale(TOTAL_FRAMES, TOTAL_FRAMES), 1 / DOUBLING);

  const opening = generationRange(zoomScale(0, TOTAL_FRAMES), BASE_RADIUS, 1, CORNER_RADIUS);
  const closing = generationRange(zoomScale(TOTAL_FRAMES, TOTAL_FRAMES), BASE_RADIUS, 1, CORNER_RADIUS);
  assert.deepEqual(closing.map((generation) => generation - 1), opening);
  // And each generation lands on its elder's screen radius exactly.
  for (const generation of closing) {
    const landed = BASE_RADIUS * zoomScale(TOTAL_FRAMES, TOTAL_FRAMES) * DOUBLING ** generation;
    const elder = BASE_RADIUS * DOUBLING ** (generation - 1);
    assert.equal(landed, elder);
  }
});

test("at every moment the drawn generations reach below sight and past the corner", () => {
  for (const frameIndex of [0, 77, 150, 299]) {
    const zoom = zoomScale(frameIndex, TOTAL_FRAMES);
    const generations = generationRange(zoom, BASE_RADIUS, 1, CORNER_RADIUS);
    const innermost = BASE_RADIUS * zoom * DOUBLING ** generations[0];
    const outermost = 4 * BASE_RADIUS * zoom * DOUBLING ** generations.at(-1);

    assert.ok(generations.length >= 8);
    assert.ok(innermost <= 1);
    assert.ok(outermost >= CORNER_RADIUS);
    // Consecutive generations, no gaps.
    for (let index = 1; index < generations.length; index += 1) {
      assert.equal(generations[index], generations[index - 1] + 1);
    }
  }
});

test("the centre fades in rather than pretending the regress has a floor", () => {
  assert.equal(fadeAlpha(0, 3, 26), 0);
  assert.equal(fadeAlpha(3, 3, 26), 0);
  assert.equal(fadeAlpha(26, 3, 26), 1);
  assert.equal(fadeAlpha(400, 3, 26), 1);
  let previous = 0;
  for (let radius = 3; radius <= 26; radius += 1) {
    const alpha = fadeAlpha(radius, 3, 26);
    assert.ok(alpha >= previous);
    previous = alpha;
  }
});

test("the clip's arithmetic matches the manifest, which now declares a video", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "ammonite");

  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds, CLIP_SECONDS);
  assert.ok(artwork.render.artifact.endsWith(".mp4"));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GOLDEN_RATIO,
  NESTING_TURN,
  POINTS,
  TOTAL_FRAMES,
  fadeAlpha,
  generationRange,
  innerPentagonVertices,
  measuredShrink,
  pentagramSegments,
  stageRotation,
  zoomScale
} from "../artworks/recursive-pentagram/nesting.js";

const BASE_RADIUS = 300;
const FADE_FROM = 1.2;
const CORNER_RADIUS = Math.hypot(680, 680) / 2 + 40;

test("the star is five equal chords, each to the second next vertex", () => {
  const chords = pentagramSegments(1, 0.3);

  assert.equal(chords.length, POINTS);
  const lengths = chords.map((chord) =>
    Math.hypot(chord.end.x - chord.start.x, chord.end.y - chord.start.y));
  for (const length of lengths) {
    assert.ok(Math.abs(length - lengths[0]) < 1e-12);
  }
});

test("the child pentagon is found, and what is found is one over phi squared", () => {
  const shrink = measuredShrink();

  assert.ok(Math.abs(shrink - 1 / GOLDEN_RATIO ** 2) < 1e-12);
  // And it stands turned half a step from its parent, modulo the star's own symmetry.
  const child = innerPentagonVertices(1, 0);
  const bearing = Math.atan2(child[0].y, child[0].x) + Math.PI / 2;
  const step = (2 * Math.PI) / POINTS;
  const remainder = ((bearing - NESTING_TURN) % step + step) % step;
  assert.ok(Math.min(remainder, step - remainder) < 1e-9);
  for (const vertex of child) {
    assert.ok(Math.abs(Math.hypot(vertex.x, vertex.y) - shrink) < 1e-12);
  }
});

test("one loop of the dive returns the picture exactly: generations shift by one", () => {
  const shrink = measuredShrink();
  assert.equal(zoomScale(0, TOTAL_FRAMES), 1);
  assert.ok(Math.abs(zoomScale(TOTAL_FRAMES, TOTAL_FRAMES) - 1 / shrink) < 1e-12);
  assert.ok(Math.abs(stageRotation(TOTAL_FRAMES, TOTAL_FRAMES) + NESTING_TURN) < 1e-12);

  const opening = generationRange(1, BASE_RADIUS, FADE_FROM, CORNER_RADIUS);
  const closing = generationRange(
    zoomScale(TOTAL_FRAMES, TOTAL_FRAMES),
    BASE_RADIUS,
    FADE_FROM,
    CORNER_RADIUS
  );
  assert.deepEqual(closing.map((generation) => generation - 1), opening);
  for (const generation of closing) {
    const landed = BASE_RADIUS * zoomScale(TOTAL_FRAMES, TOTAL_FRAMES) * shrink ** generation;
    const elder = BASE_RADIUS * shrink ** (generation - 1);
    assert.ok(Math.abs(landed - elder) < 1e-9);
  }
  // And the half-step of rotation lands each star on its elder's bearing exactly.
  for (const generation of closing) {
    const landedBearing = stageRotation(TOTAL_FRAMES, TOTAL_FRAMES) + generation * NESTING_TURN;
    const elderBearing = (generation - 1) * NESTING_TURN;
    assert.ok(Math.abs(landedBearing - elderBearing) < 1e-12);
  }
});

test("at every moment the dive reaches below sight, and the regress never gaps", () => {
  const shrink = measuredShrink();
  for (const frameIndex of [0, 90, 180, 299]) {
    const zoom = zoomScale(frameIndex, TOTAL_FRAMES);
    const generations = generationRange(zoom, BASE_RADIUS, FADE_FROM, CORNER_RADIUS);
    assert.ok(generations.length >= 5);
    for (let index = 1; index < generations.length; index += 1) {
      assert.equal(generations[index], generations[index - 1] - 1);
    }
    // One level deeper than the deepest drawn would already be beneath the whisper.
    const deepest = generations[0];
    assert.ok(BASE_RADIUS * zoom * shrink ** (deepest + 1) < FADE_FROM);
  }
});

test("the centre fades in rather than pretending the regress has a floor", () => {
  assert.equal(fadeAlpha(0, 1.2, 20), 0);
  assert.equal(fadeAlpha(20, 1.2, 20), 1);
  assert.ok(fadeAlpha(10, 1.2, 20) > fadeAlpha(5, 1.2, 20));
});

test("the clip's arithmetic matches the manifest", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "recursive-pentagram");

  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});

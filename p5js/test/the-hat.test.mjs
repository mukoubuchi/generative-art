import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HAT_OUTLINE,
  SQRT_THREE,
  boundsOf,
  createHatPatch,
  determinant,
  nestingRounds,
  placementInside,
  polygonArea,
  transformedOutline
} from "../artworks/the-hat/hat.js";

const TILES = createHatPatch(2);

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test("the Hat is the paper's thirteen-vertex polykite", () => {
  assert.equal(HAT_OUTLINE.length, 13);
  near(Math.abs(polygonArea(HAT_OUTLINE)), 8 * SQRT_THREE);
  const lengths = HAT_OUTLINE.map((vertex, index) => {
    const next = HAT_OUTLINE[(index + 1) % HAT_OUTLINE.length];
    return Math.hypot(next.x - vertex.x, next.y - vertex.y);
  });
  assert.equal(lengths.filter((length) => Math.abs(length - 1) < 1e-9).length, 6);
  assert.equal(lengths.filter((length) => Math.abs(length - SQRT_THREE) < 1e-9).length, 6);
  assert.equal(lengths.filter((length) => Math.abs(length - 2) < 1e-9).length, 1);
});

test("two H-supertile substitutions produce the complete 169-hat patch", () => {
  assert.equal(TILES.length, 169);
  assert.deepEqual(
    Object.fromEntries(["H", "H1", "T", "P", "F"].map((label) => [
      label,
      TILES.filter((tile) => tile.label === label).length
    ])),
    { H: 66, H1: 22, T: 3, P: 30, F: 48 }
  );
});

test("every copy is congruent, including the twenty-two reflected hats", () => {
  assert.equal(TILES.filter((tile) => tile.reflected).length, 22);
  for (const tile of TILES) {
    near(Math.abs(determinant(tile.matrix)), 0.25);
    near(Math.abs(polygonArea(transformedOutline(tile))), 2 * SQRT_THREE);
    assert.equal(tile.reflected, determinant(tile.matrix) < 0);
  }
});

test("the reflected label and reflected orientation agree exactly", () => {
  assert.ok(TILES.every((tile) => (tile.label === "H1") === tile.reflected));
});

test("the substitution places every Hat once", () => {
  const keys = TILES.map((tile) => tile.matrix.map((value) => value.toFixed(9)).join(","));
  assert.equal(new Set(keys).size, TILES.length);
});

test("the finite patch has the expected H-supertile bounds", () => {
  const bounds = boundsOf(TILES);
  near(bounds.minX, -18.5);
  near(bounds.maxX, 14.5);
  near(bounds.minY, -18.5 * SQRT_THREE / 2);
  near(bounds.maxY, 19.5 * SQRT_THREE / 2);
});

test("the substitution is deterministic", () => {
  assert.deepEqual(createHatPatch(2), TILES);
});

test("invalid substitution depths are rejected", () => {
  assert.throws(() => createHatPatch(-1), /non-negative integer/);
  assert.throws(() => createHatPatch(1.5), /non-negative integer/);
});

test("The Hat is registered as the clip its substitution makes", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "the-hat");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.artifact, "exports/p5js/TheHat.mp4");
  assert.equal(artwork.render.durationSeconds, 10);
  assert.equal(artwork.render.scale, 2);
  // The card shows the finished patch, from a frame inside the clip's closing hold.
  assert.deepEqual(artwork.thumbnail, { frame: 290 });

  const sketch = readFileSync(
    new URL("../artworks/the-hat/sketch.js", import.meta.url),
    "utf8"
  );
  // A clip, and held to it: the loop is stopped for the renderer and nobody else, so the
  // page lays the patch to the same plan the export follows.
  assert.match(sketch, /if \(CAPTURE_MODE\) \{\n {6}p\.noLoop\(\);/u);
  assert.equal(sketch.match(/p\.noLoop\(\);/gu).length, 2);
  assert.match(sketch, /p\.draw = \(\) =>/u);
  // The plan's three stages are the three rounds, and they fill ten seconds at thirty
  // frames a second -- the duration the manifest registers, not a number chosen twice.
  const plan = [...sketch.matchAll(/\{ laying: (\d+), holding: (\d+) \}/gu)]
    .map(([, laying, holding]) => Number(laying) + Number(holding));
  assert.equal(plan.length, 3);
  assert.equal(plan.reduce((total, stage) => total + stage, 0),
    artwork.render.durationSeconds * 30);
});

test("the patch holds its own earlier rounds, which is the order the clip lays it in", () => {
  // The clip's stages are not a retelling of the substitution: they are sub-patches of the
  // finished one. The four hats of the bare H metatile sit inside the twenty-five of the
  // round-one patch, which sits inside these hundred and sixty-nine, each as a copy that
  // has been moved but not resized. So every brick is at its final place from the moment
  // it is laid, and nothing in the picture ever moves.
  const rounds = nestingRounds(2);
  assert.equal(rounds.length, TILES.length);
  assert.deepEqual(
    [0, 1, 2].map((round) => rounds.filter((entry) => entry === round).length),
    [4, 21, 144]
  );
  assert.deepEqual(
    [0, 1, 2].map((round) => rounds.filter((entry) => entry <= round).length),
    [4, 25, 169]
  );
  // The three counts are the patches themselves, rather than three numbers that add up.
  assert.equal(createHatPatch(0).length, 4);
  assert.equal(createHatPatch(1).length, 25);
  assert.equal(createHatPatch(2).length, 169);
  // Read twice, the labelling is the same labelling: the placement is found by a search,
  // and a search that returned a different answer each time would reorder the clip.
  assert.deepEqual(nestingRounds(2), rounds);

  // The scan is not vacuous: a patch cannot hold a copy of the round above it.
  assert.equal(placementInside(createHatPatch(2), createHatPatch(1)), undefined);
  // And the placement it does find is a rigid motion -- the hats keep their size, which is
  // what makes the stages nested rather than rescaled.
  const motion = placementInside(createHatPatch(1), createHatPatch(2));
  assert.ok(motion, "the round-one patch is not inside the round-two patch");
  assert.ok(Math.abs(Math.abs(determinant(motion)) - 1) < 1e-9,
    "the placement changes the size of the tiles");
});

test("the catalog preserves the verified WLC wording of Psalm 118:22", () => {
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
  const quote = catalog.quotes.find((entry) => entry.id === "psalm-stone-builders");
  assert.equal(
    quote.text,
    "אֶ֭בֶן מָאֲס֣וּ הַבּוֹנִ֑ים הָ֝יְתָ֗ה לְרֹ֣אשׁ פִּנָּֽה׃"
  );
  assert.equal(quote.lang, "he");
  assert.equal(quote.year, null);
});

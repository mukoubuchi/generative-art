import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HAT_OUTLINE,
  SQRT_THREE,
  boundsOf,
  createHatPatch,
  determinant,
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

test("The Hat is registered as an unconditional still", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "the-hat");
  assert.equal(artwork.render.kind, "image");
  assert.equal(artwork.render.artifact, "exports/p5js/TheHat.png");
  assert.equal(artwork.render.scale, 2);

  const sketch = readFileSync(
    new URL("../artworks/the-hat/sketch.js", import.meta.url),
    "utf8"
  );
  const setup = sketch.slice(sketch.indexOf("p.setup = () =>"));
  const captureGuardCloses = setup.indexOf("    }\n", setup.indexOf("if (CAPTURE_MODE)"));
  assert.ok(setup.indexOf("p.noLoop();") > captureGuardCloses);
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

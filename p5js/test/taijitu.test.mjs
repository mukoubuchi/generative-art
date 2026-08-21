import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CURVE_ENDPOINTS,
  DARK,
  DARK_LOBE,
  EYE_RADIUS,
  LIGHT,
  LIGHT_LOBE,
  LOBE_RADIUS,
  OUTER_RADIUS,
  OUTSIDE,
  PAINTING_ORDER,
  classify,
  exactRegionArea,
  halfTurn,
  measureAreas,
  oppositeShade
} from "../artworks/taijitu/taijitu.js";

/** Coordinates run -1 to 1 in exact steps, so a sample and its antipode are exact negatives. */
const HALF = 200;
const coordinate = (index) => (index - HALF) / HALF;

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test("the lobes are tangent to the rim and to each other at the centre", () => {
  // Each lobe touches the rim from inside: centre distance plus radius is the rim exactly.
  assert.equal(Math.hypot(LIGHT_LOBE.x, LIGHT_LOBE.y) + LOBE_RADIUS, OUTER_RADIUS);
  assert.equal(Math.hypot(DARK_LOBE.x, DARK_LOBE.y) + LOBE_RADIUS, OUTER_RADIUS);
  // And the two lobes touch each other, at one point, which is the centre of the disc.
  assert.equal(
    Math.hypot(DARK_LOBE.x - LIGHT_LOBE.x, DARK_LOBE.y - LIGHT_LOBE.y),
    2 * LOBE_RADIUS
  );
  assert.equal((LIGHT_LOBE.x + DARK_LOBE.x) / 2, 0);
  assert.equal((LIGHT_LOBE.y + DARK_LOBE.y) / 2, 0);
  // An eye is small enough to sit strictly inside the lobe that carries it.
  assert.ok(EYE_RADIUS < LOBE_RADIUS);
});

test("a half turn with the shades exchanged leaves the figure unchanged", () => {
  // The claim the picture makes, measured over the whole disc rather than at chosen points.
  let checked = 0;
  const exceptions = [];
  for (let row = 0; row <= 2 * HALF; row += 1) {
    const y = coordinate(row);
    for (let column = 0; column <= 2 * HALF; column += 1) {
      const x = coordinate(column);
      const here = classify(x, y);
      if (here === OUTSIDE) {
        continue;
      }
      const antipode = halfTurn({ x, y });
      const there = classify(antipode.x, antipode.y);
      assert.notEqual(there, OUTSIDE, `the disc lost ${antipode.x}, ${antipode.y}`);
      if (there !== oppositeShade(here)) {
        exceptions.push({ x, y });
        continue;
      }
      // Exact, not approximate: the shade a point has is the shade its antipode has not.
      checked += 1;
    }
  }
  // Every exception is a point of the dividing curve, and every point of the curve that
  // this grid can land on is an exception. Naming them is the claim: the swap holds on
  // the two regions, and fails only on the boundary between them, which belongs to
  // neither. Collected and compared as a set rather than skipped one at a time, so a
  // fourth one appearing would be a failure rather than a silence.
  assert.deepEqual(exceptions, CURVE_ENDPOINTS);
  // The sweep is a sweep: the disc holds about pi/4 of the square this grid covers.
  assert.ok(checked > 120000, `only ${checked} interior samples were compared`);
});

test("the two regions have exactly the same area, one half of the disc each", () => {
  const half = exactRegionArea();
  assert.equal(2 * half, Math.PI * OUTER_RADIUS * OUTER_RADIUS);

  // Counted off the rule that draws the figure, not off the sentence above it. The two
  // half-lobes cancel and the two eyes cancel, so neither trade shows up in the total.
  const measured = measureAreas(1200);
  near(measured.light, half, 4e-3);
  near(measured.dark, half, 4e-3);
  near(measured.light - measured.dark, 0, 4e-3);
  assert.equal(measured.samples, 1200 * 1200);
});

test("each region carries a core of the shade of the other", () => {
  assert.equal(classify(LIGHT_LOBE.x, LIGHT_LOBE.y), DARK);
  assert.equal(classify(DARK_LOBE.x, DARK_LOBE.y), LIGHT);
  // The core is a disc, not a single point: just inside the eye is still the other shade,
  // and just outside it the lobe's own shade has resumed.
  assert.equal(classify(LIGHT_LOBE.x + EYE_RADIUS * 0.9, LIGHT_LOBE.y), DARK);
  assert.equal(classify(LIGHT_LOBE.x + EYE_RADIUS * 1.1, LIGHT_LOBE.y), LIGHT);
  assert.equal(classify(DARK_LOBE.x + EYE_RADIUS * 0.9, DARK_LOBE.y), LIGHT);
  assert.equal(classify(DARK_LOBE.x + EYE_RADIUS * 1.1, DARK_LOBE.y), DARK);
});

test("outside the rim there is no shade at all", () => {
  assert.equal(classify(0, OUTER_RADIUS * 1.001), OUTSIDE);
  assert.equal(classify(-OUTER_RADIUS * 1.001, 0), OUTSIDE);
  assert.notEqual(classify(0, OUTER_RADIUS * 0.999), OUTSIDE);
  assert.throws(() => oppositeShade(OUTSIDE), /not a shade/);
});

test("a grid that would straddle the dividing curve is rejected", () => {
  // An odd count puts a row of cell centres on the axis the two lobes meet along, where
  // the figure's boundary is, so the measurement is refused rather than quietly biased.
  assert.throws(() => measureAreas(101), /positive even integer/);
  assert.throws(() => measureAreas(0), /positive even integer/);
  assert.throws(() => measureAreas(2.5), /positive even integer/);
});

test("Taijitu is registered as an unconditional still", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "taijitu");
  assert.equal(artwork.render.kind, "image");
  assert.equal(artwork.render.artifact, "exports/p5js/Taijitu.png");
  assert.equal(artwork.render.scale, 2);
  assert.deepEqual(artwork.quoteIds, ["yijing-taiji-liangyi"]);

  const sketch = readFileSync(
    new URL("../artworks/taijitu/sketch.js", import.meta.url),
    "utf8"
  );
  const setup = sketch.slice(sketch.indexOf("p.setup = () =>"));
  const captureGuardCloses = setup.indexOf("    }\n", setup.indexOf("if (CAPTURE_MODE)"));
  assert.ok(setup.indexOf("p.noLoop();") > captureGuardCloses);
});

test("the picture is drawn from the list that defines the figure", () => {
  // The rule and the drawing are one thing here, and this is what keeps them one. A sketch
  // that laid out its own circles would look right and could then be edited into a figure
  // the tests above no longer describe, with nothing to say so.
  const sketch = readFileSync(
    new URL("../artworks/taijitu/sketch.js", import.meta.url),
    "utf8"
  );
  assert.match(sketch, /for \(const step of PAINTING_ORDER\)/u);
  assert.match(sketch, /from "\.\/taijitu\.js"/u);
  assert.equal(PAINTING_ORDER.length, 6);
  // Three shapes get each shade, so neither is only a background the other sits on.
  assert.equal(PAINTING_ORDER.filter((step) => step.shade === LIGHT).length, 3);
  assert.equal(PAINTING_ORDER.filter((step) => step.shade === DARK).length, 3);
});

test("the catalog preserves the received wording of the Xici", () => {
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
  const quote = catalog.quotes.find((entry) => entry.id === "yijing-taiji-liangyi");
  // Traditional forms and the modern editorial comma, as both witnesses print them. The
  // Japanese shapes of the same sentence would be 両 and a 、 and are not what is registered.
  assert.equal(quote.text, "易有太極，是生兩儀");
  assert.equal(quote.lang, "lzh");
  assert.equal(quote.year, null);
  assert.deepEqual([...quote.text].map((character) => character.codePointAt(0)), [
    0x6613, 0x6709, 0x592a, 0x6975, 0xff0c, 0x662f, 0x751f, 0x5169, 0x5100
  ]);

  // Its pair. One Yin, One Yang takes the fifth chapter of the same treatise; this is the
  // eleventh, and the two are registered as two quotations rather than as one.
  const pair = catalog.quotes.find((entry) => entry.id === "yijing-yin-yang-dao");
  assert.equal(pair.author, quote.author);
  assert.notEqual(pair.source, quote.source);
});

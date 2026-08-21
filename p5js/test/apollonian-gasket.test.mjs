import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FINEST_IN_OUTER_RADII,
  ROOT_BENDS,
  ROOT_CIRCLES,
  buildPacking,
  descartesBends,
  descartesResidual,
  otherCircle,
  radiusOf,
  rootCircles,
  tangencyGap,
  touching
} from "../artworks/apollonian-gasket/apollonian-gasket.js";

const SKETCH = readFileSync(
  new URL("../artworks/apollonian-gasket/sketch.js", import.meta.url),
  "utf8"
);

const PACKING = buildPacking();
const OUTER = PACKING.find((circle) => circle.bend < 0);

test("the four circles the figure starts from are tangent because they were built to be", () => {
  assert.deepEqual(ROOT_BENDS, [-6, 11, 14, 15]);
  assert.equal(descartesResidual(ROOT_BENDS), 0);
  assert.equal(ROOT_CIRCLES.length, 4);

  // Only the bends are given. The centres are worked out, so this is a measurement of the
  // construction and not a re-reading of numbers typed into the file.
  assert.equal(SKETCH.includes("ROOT_CIRCLES = ["), false);
  for (const [at, circle] of ROOT_CIRCLES.entries()) {
    assert.equal(circle.bend, ROOT_BENDS[at]);
    assert.equal(radiusOf(circle), 1 / Math.abs(ROOT_BENDS[at]));
  }

  let pairs = 0;
  for (let first = 0; first < 4; first += 1) {
    for (let second = first + 1; second < 4; second += 1) {
      pairs += 1;
      assert.ok(
        Math.abs(tangencyGap(ROOT_CIRCLES[first], ROOT_CIRCLES[second])) < 1e-12,
        `circles ${first} and ${second} of the root are not tangent`
      );
    }
  }
  assert.equal(pairs, 6);

  // Control: a quadruple that nearly satisfies the relation is refused rather than drawn.
  assert.notEqual(descartesResidual([-6, 11, 14, 16]), 0);
  assert.throws(() => rootCircles([-6, 11, 14, 16]), /not a Descartes quadruple/u);
});

test("every circle is the one Descartes's relation gives for the three it touches", () => {
  assert.ok(PACKING.length > 1700, `the packing has only ${PACKING.length} circles`);

  let checked = 0;
  let worstGap = 0;
  for (const circle of PACKING) {
    if (circle.generation === 0) {
      continue;
    }
    checked += 1;
    const parents = circle.parents.map((index) => PACKING[index]);
    assert.equal(parents.length, 3);

    // Exactly zero, not nearly: the recurrence only adds and doubles whole numbers.
    assert.equal(
      descartesResidual([...parents.map((parent) => parent.bend), circle.bend]),
      0,
      `bend ${circle.bend} does not satisfy the relation with its three`
    );
    for (const parent of parents) {
      worstGap = Math.max(worstGap, Math.abs(tangencyGap(parent, circle)));
      assert.ok(touching(parent, circle), `bend ${circle.bend} does not touch bend ${parent.bend}`);
    }
  }
  assert.ok(checked > 1700, `only ${checked} circles were put to the relation`);
  assert.ok(worstGap < 1e-9, `the worst tangency is off by ${worstGap}`);

  // The two circles that fit against three, and the one the recurrence takes. Both roots
  // of the quadratic are real circles; the packing wants the one in the gap.
  const [smaller, larger] = descartesBends(11, 14, 15);
  assert.ok(smaller < larger);
  assert.equal(Math.round(smaller), -6);
  assert.equal(descartesResidual([11, 14, 15, larger]) < 1e-9, true);
  assert.throws(() => descartesBends(1, 1, -9), /not three mutually tangent/u);
});

test("no two circles of the packing overlap", () => {
  // The claim a packing is a packing. Every pair is looked at, not a sample of them.
  let looked = 0;
  let tangent = 0;
  let worstOverlap = 0;
  for (let first = 0; first < PACKING.length; first += 1) {
    for (let second = first + 1; second < PACKING.length; second += 1) {
      looked += 1;
      const gap = tangencyGap(PACKING[first], PACKING[second]);
      if (Math.abs(gap) < 1e-9) {
        tangent += 1;
      } else {
        worstOverlap = Math.min(worstOverlap, gap);
      }
    }
  }
  assert.equal(looked, (PACKING.length * (PACKING.length - 1)) / 2);
  assert.ok(worstOverlap > -1e-9, `two circles overlap by ${-worstOverlap}`);
  assert.ok(tangent > 5000, `only ${tangent} tangencies were found`);

  // Control, frozen from the defect this check found. A circle whose centre lands on the
  // axis from below came out of the arithmetic at y = -1.3e-15, formatted as
  // "-0.000000000" where its twin formatted as "0.000000000", and entered the packing a
  // second time. The pair overlapped by two elevenths of the outer radius and nothing but
  // a sweep like this one would have noticed, because the two were drawn on top of
  // each other.
  const twin = { bend: 11, x: 0.07575757575757575, y: 0 };
  const ghost = { bend: 11, x: 0.07575757575757533, y: -1.2918958832001822e-15 };
  assert.ok(tangencyGap(twin, ghost) < -0.18, "the duplicate must read as an overlap");
  assert.equal(
    PACKING.filter((circle) => circle.bend === 11 && Math.abs(circle.y) < 1e-9).length,
    1,
    "the circle on the axis is in the packing once"
  );
});

test("every bend in the figure is a whole number", () => {
  assert.equal(PACKING.length, PACKING.filter((circle) => Number.isInteger(circle.bend)).length);
  assert.ok(PACKING.length > 1700);
  assert.equal(Math.min(...PACKING.map((circle) => circle.bend)), -6);
  assert.ok(Math.max(...PACKING.map((circle) => circle.bend)) > 3000);

  // Which is a property of this starting quadruple and not of the arithmetic. Three
  // circles of bend 1 are mutually tangent and the circles that fit them are irrational,
  // so a packing begun there would have no integers in it below the first four.
  const [smaller, larger] = descartesBends(1, 1, 1);
  assert.equal(Number.isInteger(smaller), false);
  assert.equal(Number.isInteger(larger), false);
  assert.ok(Math.abs(larger - (3 + 2 * Math.sqrt(3))) < 1e-12);
});

test("the packing is carried to a stated size and is complete down to it", () => {
  const finest = FINEST_IN_OUTER_RADII * radiusOf(OUTER);
  assert.equal(FINEST_IN_OUTER_RADII, 1 / 612);
  for (const circle of PACKING) {
    assert.ok(
      radiusOf(circle) >= finest - 1e-12,
      `a circle of radius ${radiusOf(circle)} is below the cutoff`
    );
  }

  // Complete, not merely bounded: carrying the same recurrence further finds no circle
  // above the cutoff that this packing does not already have. A cutoff that stopped a
  // branch early would show up here as a circle the deeper run has and this one lacks.
  const deeper = buildPacking(FINEST_IN_OUTER_RADII / 2);
  const key = (circle) => `${circle.bend}:${circle.x.toFixed(6)}:${circle.y.toFixed(6)}`;
  const here = new Set(PACKING.map(key));
  const shouldBeHere = deeper.filter((circle) => radiusOf(circle) >= finest - 1e-12);
  assert.equal(shouldBeHere.length, PACKING.length);
  for (const circle of shouldBeHere) {
    assert.ok(here.has(key(circle)), `the deeper run found a circle of bend ${circle.bend}`);
  }
  assert.ok(deeper.length > PACKING.length, "a finer cutoff must reach more circles");

  // And the figure is the same figure every time it is built.
  assert.deepEqual(buildPacking(), PACKING);
});

test("the swap that grows the packing returns the other circle of the pair", () => {
  // Vieta, checked against the quadratic it comes from: swapping a member out and back
  // in returns the quadruple unchanged, and the swapped-in circle is the root of
  // Descartes's relation that the swapped-out one was not.
  const quadruple = ROOT_CIRCLES;
  for (let index = 0; index < 4; index += 1) {
    const grown = otherCircle(quadruple, index);
    const rest = quadruple.filter((_, at) => at !== index);
    const roots = descartesBends(...rest.map((circle) => circle.bend));
    assert.ok(
      roots.some((root) => Math.abs(root - grown.bend) < 1e-9),
      `${grown.bend} is neither root of the relation for its three`
    );
    assert.notEqual(grown.bend, quadruple[index].bend);
    for (const circle of rest) {
      assert.ok(touching(circle, grown), "the grown circle must touch all three");
    }
    const back = otherCircle(
      quadruple.map((circle, at) => (at === index ? grown : circle)),
      index
    );
    assert.ok(Math.abs(back.bend - quadruple[index].bend) < 1e-9);
    assert.ok(Math.hypot(back.x - quadruple[index].x, back.y - quadruple[index].y) < 1e-9);
  }
});

test("the plate draws the packing, at the size the catalog registers", () => {
  assert.match(SKETCH, /from "\.\/apollonian-gasket\.js"/u);
  assert.match(SKETCH, /const CIRCLES = buildPacking\(\);/u);
  assert.match(SKETCH, /for \(const circle of CIRCLES\)/u);
  // The pen answers to how large a circle is drawn, not to its bend, so the hierarchy on
  // the page is the hierarchy of sizes.
  assert.match(SKETCH, /function penFor\(radiusOnPage\)/u);
  assert.equal(SKETCH.includes("penFor(circle.bend)"), false);

  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "apollonian-gasket");
  assert.equal(artwork.render.kind, "image");
  assert.equal(artwork.render.artifact, "exports/p5js/ApollonianGasket.png");
  assert.equal(artwork.render.scale, 2);
  assert.deepEqual(artwork.canvas, { width: 680, height: 680 });
  assert.deepEqual(artwork.quoteIds, ["pappus-kyklon-agagein"]);
  assert.equal(artwork.thumbnail, undefined);

  // A still, and held to it: noLoop is called whether or not the page is being captured.
  const setup = SKETCH.slice(SKETCH.indexOf("p.setup = () =>"));
  const captureGuardCloses = setup.indexOf("    }\n", setup.indexOf("if (CAPTURE_MODE)"));
  assert.ok(setup.indexOf("p.noLoop();") > captureGuardCloses);

  // The finest circle is a pixel of the exported plate, which is what the cutoff says.
  const outerRadius = Number(SKETCH.match(/const OUTER_RADIUS = (\d+);/u)[1]);
  assert.equal(outerRadius * FINEST_IN_OUTER_RADII * artwork.render.scale, 1);
  assert.ok(2 * outerRadius < artwork.canvas.width);
});

test("the catalog carries Pappus's sentence as Hultsch's text sets it", () => {
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
  const quote = catalog.quotes.find((entry) => entry.id === "pappus-kyklon-agagein");
  assert.equal(
    quote.text,
    "ἑξῆς σημείων καὶ εὐθειῶν καὶ κύκλων τριῶν ὁποιωνοῦν θέσει δοθέντων κύκλον ἀγαγεῖν δι᾽ ἑκάστου"
    + " τῶν δοθέντων σημείων (εἰ δοθείη) ἐφαπτόμενον ἑκάστης τῶν δοθεισῶν γραμμῶν."
  );
  assert.equal(quote.lang, "grc");
  assert.equal(quote.author, "Pappus of Alexandria");
  assert.equal(quote.source, "Collectio VII, §11");
  assert.equal(quote.publicDomain, true);

  // No year. The date of a nineteenth-century edition is not the date of the sentence,
  // and Pappus's own is not known closely enough to print.
  assert.equal(quote.year, null);

  // The word the editor doubted is kept, because the page prints it and the doubt is
  // recorded in the apparatus rather than in the text. Dropping it would be adopting a
  // conjecture silently.
  assert.ok(quote.text.startsWith("ἑξῆς "));

  // The elision is the raised comma the edition sets, U+1FBD, not an apostrophe.
  const elided = quote.text.indexOf("δι") + 2;
  assert.equal(quote.text.codePointAt(elided), 0x1fbd);

  // Polytonic, and counted: 122 letters from Greek and Coptic and 20 codepoints from
  // Greek Extended, the block that carries the breathings, the circumflexes and the
  // elision mark. Setting the text in monotonic Greek would empty the second block, and
  // the length alone would not notice.
  const inBlock = (from, to) => [...quote.text].filter((character) => {
    const point = character.codePointAt(0);
    return point >= from && point <= to;
  }).length;
  assert.equal(quote.text.length, 168);
  assert.equal(inBlock(0x370, 0x3ff), 122);
  assert.equal(inBlock(0x1f00, 0x1fff), 20);

  // And no Latin letter anywhere. Greek omicron and Latin o are one pixel apart on a
  // screen and nothing in a diff would show the swap.
  const allowed = new Set([" ", "(", ")", "."]);
  for (const character of quote.text) {
    const point = character.codePointAt(0);
    assert.ok(
      allowed.has(character) || (point >= 0x370 && point <= 0x3ff) || (point >= 0x1f00 && point <= 0x1fff),
      `${character} (U+${point.toString(16)}) is not Greek`
    );
  }
});

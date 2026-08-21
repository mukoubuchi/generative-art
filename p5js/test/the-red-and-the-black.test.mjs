import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BLACK,
  BLACK_LOBE,
  CURVE_ENDPOINTS,
  EYE_RADIUS,
  GROUND,
  HAZE_INNER_IN_DISCS,
  HAZE_OUTER_IN_WIDTHS,
  HAZE_STOPS,
  LOBE_RADIUS,
  OUTER_RADIUS,
  OUTSIDE,
  PAINTING_ORDER,
  RED,
  RED_LOBE,
  ROAD_COLOUR,
  classify,
  exactRegionArea,
  halfTurn,
  hazeOver,
  measureAreas,
  otherRoad
} from "../artworks/the-red-and-the-black/the-red-and-the-black.js";

/** Coordinates run -1 to 1 in exact steps, so a sample and its antipode are exact negatives. */
const HALF = 200;
const coordinate = (index) => (index - HALF) / HALF;

const SKETCH = readFileSync(
  new URL("../artworks/the-red-and-the-black/sketch.js", import.meta.url),
  "utf8"
);

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

/** sRGB relative luminance and the contrast ratio built on it, as WCAG defines them. */
function luminance([red, green, blue]) {
  const channel = (value) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(first, second) {
  const [darker, lighter] = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (lighter + 0.05) / (darker + 0.05);
}

const chroma = (colour) => Math.max(...colour) - Math.min(...colour);
const crimson = () => ROAD_COLOUR[RED];

test("the lobes are tangent to the rim and to each other at the centre", () => {
  // Each lobe touches the rim from inside: centre distance plus radius is the rim exactly.
  assert.equal(Math.hypot(RED_LOBE.x, RED_LOBE.y) + LOBE_RADIUS, OUTER_RADIUS);
  assert.equal(Math.hypot(BLACK_LOBE.x, BLACK_LOBE.y) + LOBE_RADIUS, OUTER_RADIUS);
  // And the two lobes touch each other, at one point, which is the centre of the disc.
  assert.equal(
    Math.hypot(BLACK_LOBE.x - RED_LOBE.x, BLACK_LOBE.y - RED_LOBE.y),
    2 * LOBE_RADIUS
  );
  assert.equal((RED_LOBE.x + BLACK_LOBE.x) / 2, 0);
  assert.equal((RED_LOBE.y + BLACK_LOBE.y) / 2, 0);
  // An eye is small enough to sit strictly inside the lobe that carries it.
  assert.ok(EYE_RADIUS < LOBE_RADIUS);
});

test("a half turn with the roads exchanged leaves the figure unchanged", () => {
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
      if (there !== otherRoad(here)) {
        exceptions.push({ x, y });
        continue;
      }
      // Exact, not approximate: the road a point is on is the road its antipode is not on.
      checked += 1;
    }
  }
  // Every exception is a point of the dividing curve, and every point of the curve that
  // this grid can land on is an exception. Naming them is the claim: the swap holds on
  // the two roads, and fails only on the boundary between them, which belongs to
  // neither. Collected and compared as a set rather than skipped one at a time, so a
  // fourth one appearing would be a failure rather than a silence.
  assert.deepEqual(exceptions, CURVE_ENDPOINTS);
  // The sweep is a sweep: the disc holds about pi/4 of the square this grid covers.
  assert.ok(checked > 120000, `only ${checked} interior samples were compared`);
});

test("the two roads have exactly the same area, one half of the disc each", () => {
  const half = exactRegionArea();
  assert.equal(2 * half, Math.PI * OUTER_RADIUS * OUTER_RADIUS);

  // Counted off the rule that draws the figure, not off the sentence above it. The two
  // half-lobes cancel and the two eyes cancel, so neither trade shows up in the total,
  // and neither road is the greater one.
  const measured = measureAreas(1200);
  near(measured.red, half, 4e-3);
  near(measured.black, half, 4e-3);
  near(measured.red - measured.black, 0, 4e-3);
  assert.equal(measured.samples, 1200 * 1200);
});

test("each road carries a core of the other", () => {
  assert.equal(classify(RED_LOBE.x, RED_LOBE.y), BLACK);
  assert.equal(classify(BLACK_LOBE.x, BLACK_LOBE.y), RED);
  // The core is a disc, not a single point: just inside the eye is still the other road,
  // and just outside it the lobe's own road has resumed.
  assert.equal(classify(RED_LOBE.x + EYE_RADIUS * 0.9, RED_LOBE.y), BLACK);
  assert.equal(classify(RED_LOBE.x + EYE_RADIUS * 1.1, RED_LOBE.y), RED);
  assert.equal(classify(BLACK_LOBE.x + EYE_RADIUS * 0.9, BLACK_LOBE.y), RED);
  assert.equal(classify(BLACK_LOBE.x + EYE_RADIUS * 1.1, BLACK_LOBE.y), BLACK);
});

test("outside the rim there is no road at all", () => {
  assert.equal(classify(0, OUTER_RADIUS * 1.001), OUTSIDE);
  assert.equal(classify(-OUTER_RADIUS * 1.001, 0), OUTSIDE);
  assert.notEqual(classify(0, OUTER_RADIUS * 0.999), OUTSIDE);
  assert.throws(() => otherRoad(OUTSIDE), /not a road/);
});

test("a grid that would straddle the dividing curve is rejected", () => {
  // An odd count puts a row of cell centres on the axis the two lobes meet along, where
  // the figure's boundary is, so the measurement is refused rather than quietly biased.
  assert.throws(() => measureAreas(101), /positive even integer/);
  assert.throws(() => measureAreas(0), /positive even integer/);
  assert.throws(() => measureAreas(2.5), /positive even integer/);
});

/**
 * The page, read out of the sketch rather than restated here, so the stretch of the haze
 * the eye actually sees is the stretch these tests measure.
 */
const LOGICAL_WIDTH = Number(SKETCH.match(/const LOGICAL_WIDTH = (\d+);/u)[1]);
const LOGICAL_HEIGHT = Number(SKETCH.match(/const LOGICAL_HEIGHT = (\d+);/u)[1]);
const DISC_FRACTION = Number(
  SKETCH.match(/Math\.min\(LOGICAL_WIDTH, LOGICAL_HEIGHT\) \* ([\d.]+);/u)[1]
);
const DISC_RADIUS = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * DISC_FRACTION;
const HAZE_INNER = DISC_RADIUS * HAZE_INNER_IN_DISCS;
const HAZE_OUTER = LOGICAL_WIDTH * HAZE_OUTER_IN_WIDTHS;
const along = (distance) => (distance - HAZE_INNER) / (HAZE_OUTER - HAZE_INNER);
/** The rim of the disc, where the visible haze is thickest, out to the far corner. */
const AT_RIM = along(DISC_RADIUS);
const AT_CORNER = along(Math.hypot(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2));

/**
 * Whether one colour of the ground stays a ground: cooler than it is warm, so no part of
 * it could be taken for the crimson, and lighter than the lacquer black, so no part of it
 * could swallow the black road.
 */
function standsApartFromTheRoads(colour) {
  const lacquer = ROAD_COLOUR[BLACK];
  return (
    colour[2] > colour[0] &&
    chroma(colour) < 20 &&
    luminance(colour) > 1.9 * luminance(lacquer)
  );
}

test("the disc is painted in two colours, and the world outside is in neither of them", () => {
  // Two roads, two colours, and no third entry to become a third road.
  assert.deepEqual(Object.keys(ROAD_COLOUR).sort(), [BLACK, RED].sort());
  assert.equal(Object.keys(ROAD_COLOUR).length, 2);
  const crimson = ROAD_COLOUR[RED];
  const lacquer = ROAD_COLOUR[BLACK];

  // The crimson is a colour and the lacquer black is a darkness; that is what makes each
  // of them tell against a grey world, and the two of them against each other.
  assert.ok(chroma(crimson) >= 120, `the crimson's chroma is only ${chroma(crimson)}`);
  assert.ok(luminance(lacquer) < 0.006, `the lacquer black sits at ${luminance(lacquer)}`);
  assert.ok(contrast(crimson, lacquer) >= 2.2);
  assert.ok(chroma(crimson) - chroma(GROUND) >= 100);
  // The ground the haze is laid over is itself lighter than the lacquer, so the darkest
  // thing on the page is the black road and not the page.
  assert.ok(luminance(GROUND) > luminance(lacquer));
});

test("no colour the ground can take belongs to either road", () => {
  // The haze runs from thickest at the rim to nearly nothing at the corner. Every colour
  // in that stretch is checked, not three chosen ones: the ground is a continuum and a
  // claim about it has to be a claim about all of it.
  assert.ok(AT_RIM > 0, `the haze has already thinned at the rim: ${AT_RIM}`);
  assert.ok(AT_CORNER < 1, `the haze has run out before the corner: ${AT_CORNER}`);
  let sampled = 0;
  let closest = Infinity;
  for (let step = 0; step <= 4000; step += 1) {
    const at = AT_RIM + (step / 4000) * (AT_CORNER - AT_RIM);
    const ground = hazeOver(at);
    assert.ok(standsApartFromTheRoads(ground), `the ground at ${at} is ${ground}`);
    // And the crimson is the only saturated thing on the page, everywhere on it.
    assert.ok(contrast(crimson(), ground) >= 1.75);
    assert.ok(chroma(crimson()) - chroma(ground) >= 120);
    closest = Math.min(closest, luminance(ground) / luminance(ROAD_COLOUR[BLACK]));
    sampled += 1;
  }
  assert.equal(sampled, 4001);
  // Named, because it is the number the picture rests on: at its darkest the ground is
  // still nearly twice the luminance of the lacquer black.
  assert.ok(closest >= 1.9, `the ground closes to ${closest} times the lacquer`);

  // Controls. Neither of these is a colour this picture ever had; they are written down
  // as the two ways this family could stop doing its work, so the sweep above cannot be
  // weakened without one of them passing. The first is a warm grey, which the eye would
  // read as a thin crimson; the second is darker than the lacquer, which would leave the
  // black road as a hole in a darker page.
  assert.equal(standsApartFromTheRoads([92, 64, 62]), false);
  assert.equal(standsApartFromTheRoads([8, 8, 9]), false);
  assert.equal(standsApartFromTheRoads(hazeOver(AT_RIM)), true);
});

test("the haze is thickest at the figure and gone by the corner", () => {
  assert.equal(HAZE_STOPS.length, 3);
  assert.equal(HAZE_STOPS[0].at, 0);
  assert.equal(HAZE_STOPS.at(-1).at, 1);
  // It only ever thins, and at the outer circle it is nothing at all rather than a faint
  // wash the page carries to its edge.
  for (let index = 1; index < HAZE_STOPS.length; index += 1) {
    assert.ok(HAZE_STOPS[index].at > HAZE_STOPS[index - 1].at);
    assert.ok(HAZE_STOPS[index].alpha < HAZE_STOPS[index - 1].alpha);
  }
  assert.equal(HAZE_STOPS.at(-1).alpha, 0);
  assert.deepEqual(hazeOver(1), GROUND);
  // The figure stands in the brightest part of it, and the corners are the bare ground.
  assert.ok(luminance(hazeOver(AT_RIM)) > luminance(hazeOver(AT_CORNER)));
  assert.ok(luminance(hazeOver(AT_CORNER)) >= luminance(GROUND));
  // Off the gradient there is no answer, rather than a silently clamped one.
  assert.throws(() => hazeOver(-0.01), /outside the haze/);
  assert.throws(() => hazeOver(1.01), /outside the haze/);
});

/** The one gradient the ground is made of, as the sketch writes it. */
function hazeGradient(source) {
  const start = source.indexOf("function drawHaze()");
  assert.notEqual(start, -1, "drawHaze has gone");
  const body = source.slice(start, source.indexOf("\n  }\n", start));
  assert.equal(body.includes("createLinearGradient"), false, "a linear gradient has a direction");
  const match = body.match(/createRadialGradient\(([^)]*)\)/u);
  assert.notEqual(match, null, "the ground is not a radial gradient");
  return { circles: match[1].split(",").map((argument) => argument.trim()), body };
}

test("the ground has no direction either", () => {
  const { circles, body } = hazeGradient(SKETCH);
  // Both circles sit on the centre of the disc, as the gloss's do. A world that were
  // brighter on one side would tell the two roads apart from outside, which is the same
  // claim the picture refuses to make from inside.
  assert.equal(circles.length, 6);
  assert.deepEqual([circles[0], circles[1]], ["centreX", "centreY"]);
  assert.deepEqual([circles[3], circles[4]], ["centreX", "centreY"]);
  // And the stops it lays down are the ones measured above, not a second copy of them.
  assert.match(body, /for \(const \{ at, colour, alpha \} of HAZE_STOPS\)/u);
  assert.equal(body.includes("rgba("), true);

  const offCentre = hazeGradient(
    SKETCH.replace(
      "      DISC_RADIUS * HAZE_INNER_IN_DISCS,\n      centreX,",
      "      DISC_RADIUS * HAZE_INNER_IN_DISCS,\n      centreX - 60,"
    )
  );
  assert.notEqual(offCentre.circles[3], "centreX", "a ground moved off the centre would have to be caught");
});

/**
 * Every gradient laid over the disc, as the sketch writes it: the two circles it runs
 * between and the colour stops along it. Reading them out of the source is the only way
 * to check a claim that lives in canvas calls rather than in a number.
 */
function glossGradients(source) {
  const start = source.indexOf("function drawGloss()");
  assert.notEqual(start, -1, "drawGloss has gone");
  const body = source.slice(start, source.indexOf("\n  }\n", start));
  assert.equal(body.includes("createLinearGradient"), false, "a linear gradient has a direction");
  const gradients = [...body.matchAll(/create(Radial)Gradient\(([^)]*)\)/gu)].map((match) => ({
    circles: match[2].split(",").map((argument) => argument.trim())
  }));
  const stops = [...body.matchAll(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/gu)].map((match) => ({
    colour: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: Number(match[4])
  }));
  return { gradients, stops };
}

/** Whether one colour stop is light the two roads can take without a third colour appearing. */
function keepsThePalette({ colour, alpha }) {
  const [red, , blue] = colour;
  const isShadow = colour.every((channel) => channel === 0);
  const isWarm = red - blue >= 100;
  return alpha === 0 || isShadow || isWarm;
}

test("the light on the disc is a function of the radius alone, and warm", () => {
  const { gradients, stops } = glossGradients(SKETCH);
  // Anti-vacuity: if the extraction found nothing, the assertions below would all pass.
  assert.ok(gradients.length >= 3, `only ${gradients.length} gradients were found`);
  assert.ok(stops.length >= 8, `only ${stops.length} colour stops were found`);

  // Both circles of every gradient sit on the centre of the disc, so the light a point
  // receives depends on its distance from the centre and on nothing else. This is what
  // makes the exchange of the two roads exact in the pixels and not only in the rule; a
  // highlight thrown from one side would say that one of the two roads is the lit one.
  for (const { circles } of gradients) {
    assert.equal(circles.length, 6);
    assert.deepEqual([circles[0], circles[1]], ["centreX", "centreY"]);
    assert.deepEqual([circles[3], circles[4]], ["centreX", "centreY"]);
  }

  // And every stop is either a shadow or a warm light. A neutral light added over the
  // lacquer black comes out grey, and a grey inside this disc is a third road.
  for (const stop of stops) {
    assert.ok(keepsThePalette(stop), `${JSON.stringify(stop.colour)} is neither shadow nor warm`);
  }

  // Negative controls, frozen from the two versions of this picture that were wrong.
  // The first laid a near-white sheen over both roads and put a grey ring across the
  // lacquer black; the second is the same gradient moved off the centre.
  assert.equal(keepsThePalette({ colour: [255, 238, 228], alpha: 0.17 }), false);
  assert.equal(keepsThePalette({ colour: [126, 148, 194], alpha: 0.14 }), false);
  assert.ok(keepsThePalette({ colour: [255, 132, 100], alpha: 0.2 }));
  const offCentre = glossGradients(
    SKETCH.replace("      centreX,\n      centreY,\n      0,", "      centreX - 40,\n      centreY,\n      0,")
  );
  assert.ok(
    offCentre.gradients.some(({ circles }) => circles[0] !== "centreX"),
    "a gradient moved off the centre would have to be caught"
  );
});

test("The Red and the Black is registered as an unconditional still", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "the-red-and-the-black");
  assert.equal(artwork.render.kind, "image");
  assert.equal(artwork.render.artifact, "exports/p5js/TheRedAndTheBlack.png");
  assert.equal(artwork.render.scale, 2);
  assert.deepEqual(artwork.quoteIds, ["stendhal-cessa-de-parler"]);

  const setup = SKETCH.slice(SKETCH.indexOf("p.setup = () =>"));
  const captureGuardCloses = setup.indexOf("    }\n", setup.indexOf("if (CAPTURE_MODE)"));
  assert.ok(setup.indexOf("p.noLoop();") > captureGuardCloses);
});

test("the picture is drawn from the list that defines the figure", () => {
  // The rule and the drawing are one thing here, and this is what keeps them one. A sketch
  // that laid out its own circles would look right and could then be edited into a figure
  // the tests above no longer describe, with nothing to say so.
  assert.match(SKETCH, /for \(const step of PAINTING_ORDER\)/u);
  assert.match(SKETCH, /from "\.\/the-red-and-the-black\.js"/u);
  assert.match(SKETCH, /ROAD_COLOUR\[step\.road\]/u);
  assert.equal(PAINTING_ORDER.length, 6);
  // Three shapes get each road, so neither is only a background the other sits on.
  assert.equal(PAINTING_ORDER.filter((step) => step.road === RED).length, 3);
  assert.equal(PAINTING_ORDER.filter((step) => step.road === BLACK).length, 3);
});

test("the catalog keeps the first edition's reading of the sentence", () => {
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
  const quote = catalog.quotes.find((entry) => entry.id === "stendhal-cessa-de-parler");
  assert.equal(
    quote.text,
    "Tout-à-coup Julien cessa de parler de Napoléon ; il annonça le projet de se faire prêtre…"
  );
  assert.equal(quote.lang, "fr");
  // The year printed on the title page of the volume the sourceUrl opens, not the month
  // the book went on sale.
  assert.equal(quote.year, 1831);

  // Levavasseur 1831 and Charpentier 1846 both hyphenate; Michel Levy 1854 sets "Tout a
  // coup". The first edition is what is registered, so the two hyphens are the reading.
  assert.equal([...quote.text].filter((character) => character === "-").length, 2);
  assert.equal(quote.text.codePointAt(4), 0x002d);
  assert.equal(quote.text.codePointAt(6), 0x002d);

  // French sets a space before a semicolon and that space does not break. Written out as
  // a codepoint because it is invisible in the file and a stray edit would silently
  // replace it with an ordinary space, which is a line break waiting to happen on a
  // phone. U+202F is the typographically closer character and is not used: it is not
  // carried reliably by every surface these quotations are printed on.
  const semicolon = quote.text.indexOf(";");
  assert.equal(quote.text.codePointAt(semicolon - 1), 0x00a0);
  assert.equal(quote.text.includes(" ;"), false);
  assert.equal(quote.text.includes(" "), false);
  assert.equal(quote.text.endsWith("…"), true);

  // The novel it comes from is the one the artwork is named after, and the name of the
  // work is the one thing the two share; the catalog says so once, here.
  assert.match(quote.source, /^Le Rouge et le Noir, /u);
  assert.equal(quote.author, "Stendhal");
  assert.equal(quote.publicDomain, true);
  assert.match(quote.sourceUrl, /^https:\/\/gallica\.bnf\.fr\/ark:\/12148\/btv1b8623298f\//u);
});

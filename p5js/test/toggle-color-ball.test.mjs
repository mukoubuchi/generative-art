import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NUMBER_WORDS } from "./number-words.mjs";
import {
  DISC_COUNT,
  DISC_DIAMETER_RATIO,
  EYE_DISTANCE,
  RING_RADIUS_RATIO,
  RING_TILT,
  STEPS_PER_SECOND,
  TURN_STEPS,
  discDepth,
  discPlace,
  frontDisc,
  handoverTurns,
  paintingOrder,
  ringAngle,
  sweptBounds,
  sweptCentreY
} from "../artworks/toggle-color-ball/carousel.js";
import { loadCatalog } from "../lib/catalog.mjs";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
// The canvas the page is drawn on, taken from the manifest rather than repeated here, and
// the ring on it, taken from the module the page draws with. Nothing about the size of the
// figure is written down twice.
const { manifest } = await loadCatalog();
const artwork = manifest.artworks.find((candidate) => candidate.id === "toggle-color-ball");
const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = artwork.canvas;
// The sketch measures the ring against the shorter side, as every artwork here does; the
// edges it has to stay inside are the canvas's own, and on a landscape canvas those are
// two different numbers.
const SHORT_SIDE = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT);
const RING_RADIUS = SHORT_SIDE * RING_RADIUS_RATIO;
const DISC_RADIUS = (SHORT_SIDE * DISC_DIAMETER_RATIO) / 2;

/**
 * The Processing sketch kept a table of which disc came forward in each quarter, and a
 * table is a claim that cannot be wrong. These tests are about there being no table:
 * the front is whichever disc is nearest, the handover is wherever two of them are
 * equally near, and the alternation of kinds — the artwork's line from the Book of
 * Changes — is a consequence of how they sit on the ring. Every number below is found
 * by asking the ring, not by being told.
 */

test("the handover is found rather than declared, at an eighth past each quarter", () => {
  // handoverTurns walks the turn, notices where the nearest disc stops being the same
  // disc, and bisects. It is not told where to look.
  const handovers = handoverTurns();
  assert.equal(handovers.length, DISC_COUNT);
  handovers.forEach((turns, index) => {
    const expected = 0.125 + index * 0.25;
    assert.ok(Math.abs(turns - expected) < 1e-12, `handover ${index} landed at ${turns}`);
  });
  // Which is forty-five degrees past each quarter of the ring, and a whole number of
  // simulation steps, so no frame of the clip straddles a handover.
  for (const turns of handovers) {
    assert.ok(Math.abs(turns * 360 - Math.round(turns * 360)) < 1e-9);
    assert.ok(Math.abs(turns * TURN_STEPS - Math.round(turns * TURN_STEPS)) < 1e-9);
  }
});

test("a handover is exactly a tie in depth between neighbours on the ring", () => {
  for (const turns of handoverTurns()) {
    const before = frontDisc(turns - 1e-9);
    const after = frontDisc(turns + 1e-9);
    assert.notEqual(before, after, "nothing actually changed hands");
    // The two are neighbours — a disc can only be overtaken by the one beside it.
    const apart = Math.abs(before - after) % DISC_COUNT;
    assert.ok(apart === 1 || apart === DISC_COUNT - 1, `${before} and ${after} are not neighbours`);
    // And at that instant they are the same distance away, which is the whole reason
    // the front changes: not a rule, a tie.
    assert.ok(Math.abs(discDepth(before, turns) - discDepth(after, turns)) < 1e-12);
  }
});

test("between handovers the front never changes, and each disc takes one turn", () => {
  const handovers = handoverTurns();
  const fronts = [];
  for (let index = 0; index < handovers.length; index += 1) {
    const from = handovers[index];
    const to = index + 1 < handovers.length ? handovers[index + 1] : handovers[0] + 1;
    const holder = frontDisc((from + to) / 2);
    for (let sample = 1; sample < 40; sample += 1) {
      const turns = from + (to - from) * (sample / 40);
      assert.equal(frontDisc(turns % 1), holder, `the front flickered inside a quarter`);
    }
    fronts.push(holder);
  }
  // Every disc comes forward exactly once per revolution.
  assert.deepEqual([...fronts].sort(), [0, 1, 2, 3]);
});

test("one yin, one yang: the kinds alternate because the ring alternates", () => {
  // The discs are laid out alternately around the ring, and a disc can only be
  // overtaken by its neighbour, so whatever comes forward is the opposite kind to what
  // came forward before it. Nothing in the sketch enforces this.
  const fronts = handoverTurns().map((turns) => frontDisc(turns + 1e-9));
  for (let index = 0; index < fronts.length; index += 1) {
    const next = fronts[(index + 1) % fronts.length];
    assert.notEqual(fronts[index] % 2, next % 2, "two of a kind came forward in a row");
  }
});

test("the painting order is the depth order, back to front", () => {
  for (let sample = 0; sample < 50; sample += 1) {
    const turns = sample / 50;
    const order = paintingOrder(turns);
    assert.deepEqual([...order].sort(), [0, 1, 2, 3], "a disc went missing");
    for (let place = 1; place < order.length; place += 1) {
      assert.ok(
        discDepth(order[place - 1], turns) <= discDepth(order[place], turns),
        "the order is not sorted by depth"
      );
    }
    // The last one painted is the one in front, which is what the front means.
    assert.equal(order.at(-1), frontDisc(turns));
  }
});

test("distance is drawn as well as sorted: nearer discs are larger", () => {
  let smallest = Infinity;
  let largest = 0;
  for (let sample = 0; sample <= 200; sample += 1) {
    const turns = sample / 200;
    const near = discPlace(frontDisc(turns), turns, RING_RADIUS);
    const far = discPlace(paintingOrder(turns)[0], turns, RING_RADIUS);
    assert.ok(near.scale > far.scale, "the nearest disc is not drawn largest");
    // Nearer is also lower on the canvas, as it is looking down at a turning thing.
    assert.ok(near.y > far.y, "the nearest disc is not the lowest");
    smallest = Math.min(smallest, far.scale);
    largest = Math.max(largest, near.scale);
  }
  // Measured, not chosen: the eye distance decides this, and it comes to about three
  // halves across the turn. It is also what the eye distance was shortened for when the
  // ring was leaned further back — depth carries a cosine of the lean, so a steeper ring
  // swings through less of it, and the sizes would otherwise have drawn together as the
  // path opened. This is the pin that says they did not.
  assert.ok(Math.abs(largest - EYE_DISTANCE / (EYE_DISTANCE - Math.cos(RING_TILT))) < 1e-9);
  assert.ok(Math.abs(largest / smallest - 1.58) < 0.01, `size ratio was ${largest / smallest}`);
});

test("what the discs cover is bounded by the near and the far point of the ring", () => {
  // A disc goes lower on the canvas as it comes forward and the distance draws it larger
  // at the same time, so both effects pull the same way and the lowest ink is the near
  // disc's bottom edge. Held against every disc at every step, rather than argued.
  const { top, bottom } = sweptBounds(RING_RADIUS, DISC_RADIUS);
  let lowest = -Infinity;
  let highest = Infinity;
  for (let step = 0; step < TURN_STEPS; step += 1) {
    const turns = step / TURN_STEPS;
    for (let index = 0; index < DISC_COUNT; index += 1) {
      const { y, scale } = discPlace(index, turns, RING_RADIUS);
      assert.ok(y + DISC_RADIUS * scale <= bottom + 1e-9, `disc ${index} dips past the bound at ${turns}`);
      assert.ok(y - DISC_RADIUS * scale >= top - 1e-9, `disc ${index} rises past the bound at ${turns}`);
      lowest = Math.max(lowest, y + DISC_RADIUS * scale);
      highest = Math.min(highest, y - DISC_RADIUS * scale);
    }
  }
  // And the bound is the figure's own, not a generous box drawn around it.
  assert.ok(Math.abs(lowest - bottom) < 1e-9, `the low bound is ${bottom - lowest} px slack`);
  assert.ok(Math.abs(highest - top) < 1e-9, `the high bound is ${highest - top} px slack`);
});

test("the perspective's droop is taken out, and the near disc stays on the canvas", () => {
  const { top, bottom } = sweptBounds(RING_RADIUS, DISC_RADIUS);
  const rise = sweptCentreY(RING_RADIUS, DISC_RADIUS);
  const half = CANVAS_HEIGHT / 2;

  // The defect this repairs: about the centre of the canvas, the figure hangs below it.
  // The near half of the ring is magnified and the far half shrunk, so it reaches further
  // down than up — far enough that the nearest disc left the bottom of the canvas while a
  // band of empty paper stood at the top.
  assert.ok(rise > 0, "the figure was not hanging low at all");
  assert.ok(bottom > half, "the nearest disc fitted without the ring being raised");
  assert.ok(-top < half, "the far side was leaving the canvas too, which this cannot fix");

  // Raised by its own droop, it stands with the same paper above it as below.
  assert.ok(Math.abs((bottom - rise) - (rise - top)) < 1e-9);
  const margin = half - (bottom - rise);
  assert.ok(margin > 25, `only ${margin} px of paper under the figure`);

  // Which is the near disc, at its largest, wholly on the canvas — the thing a reader
  // sees go wrong, stated about the disc rather than about the bound.
  const near = discPlace(0, 0.25, RING_RADIUS);
  const nearRadius = DISC_RADIUS * near.scale;
  assert.ok(near.y - rise + nearRadius <= half, "the nearest disc runs off the bottom");
  assert.ok(Math.abs(near.x) + nearRadius <= CANVAS_WIDTH / 2, "the nearest disc runs off the side");
});

test("the ring is crowded: the two ends of it meet", () => {
  // The nearest disc and the furthest sit at opposite ends of the ring, so whether they
  // touch is one comparison — perspective magnifies their distance apart and their radii
  // in the same proportion, and it cancels. A disc has to be wider than the ring's own
  // half-height, and how much wider is how crowded the four of them read.
  const near = discPlace(0, 0.25, RING_RADIUS);
  const far = discPlace(0, 0.75, RING_RADIUS);
  const apart = near.y - far.y;
  const reach = DISC_RADIUS * (near.scale + far.scale);
  assert.ok(reach > apart, `the ends of the ring stand ${apart - reach} px apart`);
  // Which is exactly the comparison the module's own note makes, with the scales gone.
  assert.ok(DISC_RADIUS > RING_RADIUS * Math.sin(RING_TILT));
  assert.ok(
    Math.abs((reach - apart) - (DISC_RADIUS - RING_RADIUS * Math.sin(RING_TILT)) * (near.scale + far.scale)) < 1e-9,
    "the overlap is not the one the comparison predicts"
  );
  // Deep enough to read as a cluster rather than as four discs in a row.
  assert.ok(reach - apart > DISC_RADIUS / 5, `they overlap by only ${reach - apart} px`);
});

test("the README's account of the ring is the ring's", async () => {
  // Prose is where a number goes to rot: retune the lean or the eye and nothing else in
  // the repository would notice the paragraph still describing the old one.
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const degrees = (RING_TILT * 180) / Math.PI;
  assert.ok(Number.isInteger(degrees), `the lean is ${degrees} degrees, which prose cannot name`);
  assert.ok(
    readme.includes(`The ring leans ${NUMBER_WORDS[degrees]} degrees back from edge-on.`),
    `the README does not say the ring leans ${NUMBER_WORDS[degrees]} degrees`
  );
  assert.ok(
    readme.includes(`the eye stands ${NUMBER_WORDS[EYE_DISTANCE]} ring radii away`),
    `the README does not stand the eye ${NUMBER_WORDS[EYE_DISTANCE]} radii away`
  );
  const rise = sweptCentreY(RING_RADIUS, DISC_RADIUS);
  const margin = Math.floor(CANVAS_HEIGHT / 2 - (sweptBounds(RING_RADIUS, DISC_RADIUS).bottom - rise));
  assert.ok(
    readme.includes(`the same ${NUMBER_WORDS[margin]} pixels of paper above the figure as below`),
    `the README does not leave ${NUMBER_WORDS[margin]} pixels of paper`
  );
});

test("the whole figure stands on the canvas, sides included", () => {
  // The Processing sketch drew discs larger than their own swing and let them leave the
  // canvas at the sides, and that stayed true while the canvas was square. It is what the
  // landscape canvas is for: the ring is half again as wide as it is tall, so the width it
  // wanted was never the width it had. Nothing is cropped now, and this is what says so.
  const rise = sweptCentreY(RING_RADIUS, DISC_RADIUS);
  let widest = 0;
  let lowest = -Infinity;
  for (let step = 0; step < TURN_STEPS; step += 1) {
    const turns = step / TURN_STEPS;
    for (let index = 0; index < DISC_COUNT; index += 1) {
      const { x, y, scale } = discPlace(index, turns, RING_RADIUS);
      widest = Math.max(widest, Math.abs(x) + DISC_RADIUS * scale);
      lowest = Math.max(lowest, Math.abs(y - rise) + DISC_RADIUS * scale);
    }
  }
  assert.ok(widest <= CANVAS_WIDTH / 2, `the discs run ${widest - CANVAS_WIDTH / 2} px past the side`);
  assert.ok(lowest <= CANVAS_HEIGHT / 2, `the discs run ${lowest - CANVAS_HEIGHT / 2} px past the top or foot`);
  // And it is a landscape canvas because the figure is: a square one would have to be as
  // wide as this is tall, and would leave the width unused.
  assert.ok(CANVAS_WIDTH > CANVAS_HEIGHT, "the canvas is not landscape");
  assert.ok(widest > CANVAS_HEIGHT / 2, "the figure would have fitted a square canvas");
});

test("the ring closes: a whole turn puts every disc back where it started", () => {
  for (let index = 0; index < DISC_COUNT; index += 1) {
    const start = discPlace(index, 0, RING_RADIUS);
    const end = discPlace(index, 1, RING_RADIUS);
    assert.ok(Math.abs(end.x - start.x) < 1e-9);
    assert.ok(Math.abs(end.y - start.y) < 1e-9);
    assert.ok(Math.abs(end.scale - start.scale) < 1e-9);
    // And a disc is a quarter of the ring behind the one before it, always.
    const behind = ringAngle(index, 0) - ringAngle(index - 1, 0);
    assert.ok(Math.abs(behind - Math.PI / 2) < 1e-12);
  }
});

test("the clip is a whole number of frames and ten seconds long", () => {
  assert.equal(TURN_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TURN_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TURN_STEPS / STEPS_PER_SECOND, 10);
});

test("the discs really move: the ring is not standing still", () => {
  const travelled = Math.hypot(
    discPlace(0, 0.25, RING_RADIUS).x - discPlace(0, 0, RING_RADIUS).x,
    discPlace(0, 0.25, RING_RADIUS).y - discPlace(0, 0, RING_RADIUS).y
  );
  assert.ok(travelled > RING_RADIUS, `a quarter turn moved a disc only ${travelled}`);
  // Over a turn a disc swings the ring's whole depth, from as far behind the centre as
  // it ever comes in front of it — the lean is all that shortens it.
  const depths = Array.from({ length: 401 }, (unused, sample) => discDepth(0, sample / 400));
  assert.ok(Math.abs(Math.max(...depths) - Math.cos(RING_TILT)) < 1e-9);
  assert.ok(Math.abs(Math.min(...depths) + Math.cos(RING_TILT)) < 1e-9);
});

/**
 * The stray hairline, and why the pin is about what the sketch may draw rather than about
 * what a rendering contains.
 *
 * A faint ellipse used to be stroked under the discs — the path they ride. Measured over
 * the whole turn, every point of it lies inside some disc at every step, so it was never
 * meant to be seen; and yet a reader saw it. Where two discs cross, neither antialiased
 * edge covers its pixel completely, and the line underneath came through the seam. The
 * measurement that found it is not a check that can be kept: reading pixels needs a
 * browser, and one artwork's composition does not earn a browser check of its own.
 *
 * What can be kept is the vocabulary. The sketch draws filled circles on a ground and
 * nothing else, so there is nothing that could surface through a seam. The specimen below
 * is the sketch exactly as it shipped with the fault, frozen out of the artworks tree, and
 * the same scan is run over it: a scanner that cannot see the real fault is not a scanner.
 */
const STROKING = /\bp\.(stroke|strokeWeight|strokeCap|strokeJoin|line|beginShape|vertex|curve|arc)\s*\(/gu;

function strokingCalls(source) {
  return [...source.matchAll(STROKING)].map((match) => match[1]);
}

test("the sketch has no way to draw a line, which is why nothing can show through a seam", async () => {
  const sketch = await readFile(
    new URL("../artworks/toggle-color-ball/sketch.js", import.meta.url),
    "utf8"
  );
  // The scan is looking at the real thing: a file long enough to be the sketch, drawing
  // the four discs it is supposed to draw.
  assert.ok(sketch.length > 2000, `the sketch is only ${sketch.length} characters long`);
  assert.equal([...sketch.matchAll(/\bp\.circle\s*\(/gu)].length, 1, "the discs are not drawn");
  assert.equal([...sketch.matchAll(/\bp\.noStroke\s*\(/gu)].length, 1, "nothing turns the stroke off");

  // p5 starts with a black stroke a pixel wide, so switching it off is not decoration: a
  // sketch that only stopped calling the ring would outline every disc in black instead.
  assert.deepEqual(strokingCalls(sketch), [], "the sketch can still draw a line");
});

test("the scan finds the fault in the sketch that shipped with it", async () => {
  // The negative control, and it is the fault itself rather than one invented for the
  // occasion: the sketch as it stood when a reader photographed the hairline.
  const specimen = await readFile(
    new URL("./fixtures/toggle-stray-ring/sketch.js", import.meta.url),
    "utf8"
  );
  const found = strokingCalls(specimen);
  assert.deepEqual(
    found.sort(),
    ["beginShape", "stroke", "strokeWeight", "vertex"],
    `the specimen no longer carries the fault: found ${found.join(", ")}`
  );
  // And the specimen is otherwise the same artwork, so what the scan rejects it for is
  // the line and not some other difference.
  assert.equal([...specimen.matchAll(/\bp\.circle\s*\(/gu)].length, 1);
  assert.ok(specimen.includes("paintingOrder"), "the specimen is not this artwork");
});

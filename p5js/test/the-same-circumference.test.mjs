import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACTS,
  ACT_FRAMES,
  BOTTOM,
  DURATION_SECONDS,
  FALL_FRAMES,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  RIM_POINTS,
  RIM_RADIUS,
  TICKS,
  TOP,
  TOTAL_FRAMES,
  actAt,
  bottomBody,
  chords,
  circleResidue,
  circlesAt,
  exactBody,
  exactCircles,
  exactFraction,
  fractionAt,
  isExactlyZero,
  kissHeights,
  rimPoint,
  sameRational,
  sceneAt,
  slopedIndices,
  stampsAt,
  stateAt,
  strides,
  tickFractions,
  tickFrames,
  topBody
} from "../artworks/the-same-circumference/the-same-circumference.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/the-same-circumference/sketch.js", import.meta.url);

/** Rational points of the rim: the places where the arithmetic can be exact. */
const RATIONAL_POINTS = [[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n], [20n, 21n, 29n], [7n, 24n, 25n]];

function signedPoints(triples = RATIONAL_POINTS) {
  const points = [];
  for (const [a, b, d] of triples) {
    for (const acrossSign of [1n, -1n]) {
      for (const downSign of [1n, -1n]) points.push([acrossSign * a, downSign * b, d]);
    }
  }
  return points;
}

const ALL_TICKS = Array.from({ length: TICKS + 1 }, (unused, index) => BigInt(index));

function onCircle(point, circle) {
  return Math.abs(Math.hypot(point[0] - circle.center[0], point[1] - circle.center[1]) - circle.radius);
}

test("the rim, the ticks and the clip keep their numbers", () => {
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(RIM_RADIUS, 240);
  assert.equal(RIM_POINTS, 36);
  assert.equal(TICKS, 4);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 10);
  assert.equal(TOTAL_FRAMES, 300);
  assert.deepEqual(ACTS, [["fall", 180], ["rest", 60], ["clear", 60]]);
  assert.equal(ACT_FRAMES, TOTAL_FRAMES);
  assert.equal(FALL_FRAMES, 180);
  assert.deepEqual(TOP, [0, -240]);
  assert.deepEqual(BOTTOM, [0, 240]);
});

test("the rim points stand ten degrees apart on the rim, the top first and clockwise, with exact cardinals", () => {
  for (let index = 0; index < RIM_POINTS; index += 1) {
    const point = rimPoint(index);
    assert.ok(Math.abs(Math.hypot(point[0], point[1]) - RIM_RADIUS) < 1e-9, `rim point ${index}`);
  }
  assert.deepEqual(rimPoint(0), [0, -240]);
  assert.deepEqual(rimPoint(9), [240, 0]);
  assert.deepEqual(rimPoint(18), [0, 240]);
  assert.deepEqual(rimPoint(27), [-240, 0]);
  // Ten degrees on: the next point after the top leans to the right, a little down.
  const next = rimPoint(1);
  assert.ok(next[0] > 0 && next[1] > -240 && next[1] < -200);
  assert.ok(Math.abs(Math.atan2(next[1], next[0]) + Math.PI / 2 - Math.PI / 18) < 1e-12);
  assert.deepEqual(slopedIndices().length, 34);
  assert.ok(!slopedIndices().includes(0) && !slopedIndices().includes(18));
  assert.throws(() => rimPoint(36), RangeError);
  assert.throws(() => rimPoint(-1), RangeError);
  assert.throws(() => rimPoint(1.5), RangeError);
});

test("at twenty rational rim points and every tick, the bodies of both families are on their circles as an integer identity", () => {
  let checks = 0;
  for (const [a, b, d] of signedPoints()) {
    for (const k of ALL_TICKS) {
      const circles = exactCircles(k);
      for (const family of ["top", "bottom"]) {
        const body = exactBody(family, a, b, d, k);
        assert.ok(isExactlyZero(circleResidue(body, circles[family])), `${family} body at (${a}/${d}, ${b}/${d}), tick ${k}`);
        checks += 1;
      }
      // The wrong circle for the family is not satisfied, except by the perpendicular's body.
      if (a !== 0n && k !== 0n && k !== BigInt(TICKS)) {
        assert.ok(!isExactlyZero(circleResidue(exactBody("top", a, b, d, k), circles.bottom)));
        assert.ok(!isExactlyZero(circleResidue(exactBody("bottom", a, b, d, k), circles.top)));
      }
    }
  }
  assert.equal(checks, 20 * (TICKS + 1) * 2);
  // The fraction at a tick is the square of the tick over the square of the count.
  for (const k of ALL_TICKS) {
    assert.ok(sameRational(exactFraction(k), { numerator: k * k, denominator: 16n }));
  }
  // The circles come from the chords and not from the law: under a uniform law the same
  // identity holds, with the circles at the uniform fractions.
  for (const [a, b, d] of signedPoints([[3n, 4n, 5n], [5n, 12n, 13n]])) {
    for (const k of ALL_TICKS) {
      const circles = exactCircles(k, 4n, { law: "uniform" });
      assert.ok(isExactlyZero(circleResidue(exactBody("top", a, b, d, k, 4n, { law: "uniform" }), circles.top)));
      assert.ok(isExactlyZero(circleResidue(exactBody("bottom", a, b, d, k, 4n, { law: "uniform" }), circles.bottom)));
    }
  }
});

test("the two circles touch on the perpendicular, at the body both families share, and never cross", () => {
  for (const k of ALL_TICKS) {
    const { top, bottom, kiss } = exactCircles(k);
    const perpendicular = exactBody("top", 0n, 1n, 1n, k);
    const arriving = exactBody("bottom", 0n, -1n, 1n, k);
    const lowestOfTop = { numerator: top.center[1] + top.radius, denominator: top.denominator };
    const highestOfBottom = { numerator: bottom.center[1] - bottom.radius, denominator: bottom.denominator };
    const kissHeight = { numerator: kiss.numerator[1], denominator: kiss.denominator };
    assert.ok(sameRational(lowestOfTop, kissHeight));
    assert.ok(sameRational(highestOfBottom, kissHeight));
    assert.equal(perpendicular.numerator[0], 0n);
    assert.ok(sameRational({ numerator: perpendicular.numerator[1], denominator: perpendicular.denominator }, kissHeight));
    assert.deepEqual(arriving, perpendicular);
    // Radii adding to the rim's, centres the rim's radius apart: externally tangent.
    assert.equal(top.radius + bottom.radius, top.denominator);
    assert.equal(bottom.center[1] - top.center[1], top.denominator);
  }
  // On the page, in floating point, at every frame.
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    for (const { state } of sceneAt(frame).layers) {
      assert.ok(Math.abs(state.top.center[1] + state.top.radius - state.kiss[1]) < 1e-9);
      assert.ok(Math.abs(state.bottom.center[1] - state.bottom.radius - state.kiss[1]) < 1e-9);
      assert.equal(state.kiss[0], 0);
      assert.ok(Math.abs(state.top.radius + state.bottom.radius - RIM_RADIUS) < 1e-9);
    }
  }
});

test("the marks stand the odd numbers apart: thirty pixels times one, three, five and seven, adding to the diameter", () => {
  assert.deepEqual(kissHeights(), [-240, -210, -120, 30, 240]);
  assert.deepEqual(strides(), [30, 90, 150, 210]);
  assert.deepEqual(strides().map((stride) => stride / 30), [1, 3, 5, 7]);
  assert.equal(strides().reduce((sum, stride) => sum + stride, 0), 2 * RIM_RADIUS);
  // Exactly, on the unit rim: the stride to tick k is (2k - 1) / 8 of the radius.
  for (let k = 1n; k <= 4n; k += 1n) {
    const before = exactCircles(k - 1n).kiss;
    const after = exactCircles(k).kiss;
    const stride = { numerator: after.numerator[1] * before.denominator - before.numerator[1] * after.denominator, denominator: after.denominator * before.denominator };
    assert.ok(sameRational(stride, { numerator: 2n * k - 1n, denominator: 8n }));
  }
  // Control: a uniform law keeps the circles and loses the odd numbers.
  assert.deepEqual(strides({ law: "uniform" }), [120, 120, 120, 120]);
  assert.deepEqual(tickFractions({ law: "uniform" }), [0.25, 0.5, 0.75, 1]);
});

test("at the last tick every falling body is exactly at its rim point and every arriving body exactly at the bottom", () => {
  const arrived = stateAt(1);
  slopedIndices().forEach((index, at) => {
    assert.deepEqual(arrived.topBodies[at], rimPoint(index));
    assert.deepEqual(arrived.bottomBodies[at], [0, 240]);
  });
  assert.deepEqual(arrived.kiss, [0, 240]);
  assert.deepEqual(arrived.top, { center: [0, 0], radius: 240 });
  assert.deepEqual(arrived.bottom, { center: [0, 240], radius: 0 });
  const opening = stateAt(0);
  slopedIndices().forEach((index, at) => {
    assert.deepEqual(opening.topBodies[at], [0, -240]);
    assert.deepEqual(opening.bottomBodies[at], rimPoint(index));
  });
  assert.deepEqual(opening.kiss, [0, -240]);
  assert.deepEqual(opening.bottom, { center: [0, 0], radius: 240 });
  for (const [a, b, d] of signedPoints()) {
    const top = exactBody("top", a, b, d, 4n);
    assert.ok(sameRational({ numerator: top.numerator[0], denominator: top.denominator }, { numerator: a, denominator: d }));
    assert.ok(sameRational({ numerator: top.numerator[1], denominator: top.denominator }, { numerator: b, denominator: d }));
    const bottom = exactBody("bottom", a, b, d, 4n);
    assert.equal(bottom.numerator[0], 0n);
    assert.ok(sameRational({ numerator: bottom.numerator[1], denominator: bottom.denominator }, { numerator: 1n, denominator: 1n }));
  }
  assert.throws(() => stateAt(2), RangeError);
  assert.throws(() => stateAt(-0.5), RangeError);
});

test("at all 300 frames every drawn body is on its family's circle, and every rim point sees the top and the bottom at a right angle", () => {
  let worst = 0;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    for (const { state } of sceneAt(frame).layers) {
      assert.equal(state.topBodies.length, 34);
      assert.equal(state.bottomBodies.length, 34);
      for (const body of state.topBodies) worst = Math.max(worst, onCircle(body, state.top));
      for (const body of state.bottomBodies) worst = Math.max(worst, onCircle(body, state.bottom));
      worst = Math.max(worst, onCircle(state.kiss, state.top), onCircle(state.kiss, state.bottom));
    }
  }
  assert.ok(worst < 1e-9, `a body stands ${worst} off its circle`);
  // Thales: the chord from the top and the chord to the bottom meet at a right angle,
  // which is why the two families keep time with each other.
  for (const index of slopedIndices()) {
    const point = rimPoint(index);
    const fromTop = [point[0] - TOP[0], point[1] - TOP[1]];
    const toBottom = [BOTTOM[0] - point[0], BOTTOM[1] - point[1]];
    assert.ok(Math.abs(fromTop[0] * toBottom[0] + fromTop[1] * toBottom[1]) < 1e-6);
  }
});

test("the standing lines are every chord from the top, every chord to the bottom, and the perpendicular once", () => {
  const lines = chords();
  assert.equal(lines.length, 2 * RIM_POINTS - 3);
  assert.equal(lines.filter((line) => line.family === "top").length, 34);
  assert.equal(lines.filter((line) => line.family === "bottom").length, 34);
  const shared = lines.filter((line) => line.family === "both");
  assert.deepEqual(shared, [{ family: "both", from: TOP, to: BOTTOM }]);
  const folded = new Set(lines.map(({ from, to }) => {
    const ends = [from, to].map((point) => point.map((value) => value.toFixed(6)).join(","));
    return ends.sort().join("|");
  }));
  assert.equal(folded.size, lines.length, "a chord is laid down twice");
  for (const line of lines) {
    for (const end of [line.from, line.to]) assert.ok(Math.abs(Math.hypot(...end) - RIM_RADIUS) < 1e-9);
  }
});

// This control is a synthetic departure from the theorem, not a frozen code defect.
test("the same distance along every chord gives a circle centred at the top, off the touching circle, and no common arrival", () => {
  const fraction = tickFractions()[1];
  const circles = circlesAt(fraction);
  const bodies = slopedIndices().map((index) => topBody(index, fraction, { scaled: false }));
  const fromTop = bodies.map((body) => Math.hypot(body[0] - TOP[0], body[1] - TOP[1]));
  assert.ok(fromTop.every((distance) => Math.abs(distance - 2 * RIM_RADIUS * fraction) < 1e-9));
  assert.ok(Math.min(...bodies.map((body) => onCircle(body, circles.top))) > 0.3);
  // At the last tick every such body but the perpendicular's has overshot the rim.
  const overshot = slopedIndices().map((index) => topBody(index, 1, { scaled: false }));
  assert.ok(overshot.every((body) => Math.hypot(body[0], body[1]) > RIM_RADIUS + 1));
  assert.deepEqual(topBody(18, 1, { scaled: false }), [0, 240]);
  // The scaled bodies, by contrast, are on the touching circle to a rounding.
  assert.ok(slopedIndices().every((index) => onCircle(topBody(index, fraction), circles.top) < 1e-9));
});

test("the acts fill the clip, and the fall's share grows as the square of the time", () => {
  assert.equal(actAt(0).name, "fall");
  assert.equal(actAt(179).name, "fall");
  assert.equal(actAt(180).name, "rest");
  assert.equal(actAt(239).name, "rest");
  assert.equal(actAt(240).name, "clear");
  assert.equal(actAt(299).name, "clear");
  assert.deepEqual(actAt(300), actAt(0));
  assert.deepEqual(tickFrames(), [45, 90, 135, 180]);
  assert.deepEqual(tickFractions(), [0.0625, 0.25, 0.5625, 1]);
  for (const [frame, fraction] of [[45, 1 / 16], [90, 1 / 4], [135, 9 / 16]]) assert.equal(fractionAt(frame), fraction);
  assert.equal(fractionAt(0), 0);
  assert.equal(fractionAt(180), 1);
  assert.equal(fractionAt(299), 1);
  let previous = -1;
  for (let frame = 0; frame < FALL_FRAMES; frame += 1) {
    const fraction = fractionAt(frame);
    assert.ok(fraction > previous);
    assert.equal(fraction, (frame / FALL_FRAMES) ** 2);
    previous = fraction;
  }
  assert.equal(fractionAt(90, { law: "uniform" }), 0.5);
  assert.throws(() => fractionAt(0, { law: "cubic" }), RangeError);
  assert.throws(() => actAt(1.5), TypeError);
  assert.throws(() => sceneAt(Number.NaN), TypeError);
});

test("a mark is laid at each of the first three ticks where the circles stand, and kept until the clearing", () => {
  assert.deepEqual(stampsAt(44), []);
  assert.deepEqual(stampsAt(45).map((stamp) => stamp.tick), [1]);
  assert.deepEqual(stampsAt(134).map((stamp) => stamp.tick), [1, 2]);
  assert.deepEqual(stampsAt(135).map((stamp) => stamp.tick), [1, 2, 3]);
  assert.deepEqual(stampsAt(200).map((stamp) => stamp.tick), [1, 2, 3]);
  assert.deepEqual(stampsAt(299).map((stamp) => stamp.tick), [1, 2, 3]);
  // The moving circles are exactly the stamp at the moment it is laid.
  tickFrames().slice(0, 3).forEach((frame, index) => {
    const state = stateAt(fractionAt(frame));
    const stamp = stampsAt(frame)[index];
    assert.equal(stamp.age, 0);
    assert.deepEqual(stamp.top, state.top);
    assert.deepEqual(stamp.bottom, state.bottom);
    assert.deepEqual(stamp.kiss, state.kiss);
    assert.equal(stamp.kiss[1], kissHeights()[index + 1]);
  });
  assert.equal(stampsAt(200)[0].age, 155);
  // The last tick leaves nothing new: its circles are the rim and a point.
  assert.deepEqual(circlesAt(1).top, { center: [0, 0], radius: 240 });
  assert.equal(circlesAt(1).bottom.radius, 0);
});

test("frames are pure, seekable and exactly periodic, and the clearing lays the first picture under the last", () => {
  assert.deepEqual(sceneAt(300), sceneAt(0));
  assert.deepEqual(sceneAt(-1), sceneAt(299));
  assert.equal(sceneAt(301).frameIndex, 1);
  const forwards = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) forwards.push(sceneAt(frame));
  for (let frame = TOTAL_FRAMES - 1; frame >= 0; frame -= 1) assert.deepEqual(sceneAt(frame), forwards[frame]);
  for (let frame = 0; frame < 240; frame += 1) {
    const scene = sceneAt(frame);
    assert.equal(scene.layers.length, 1);
    assert.equal(scene.layers[0].alpha, 1);
  }
  for (let frame = 240; frame < 300; frame += 1) {
    const [finished, opening] = sceneAt(frame).layers;
    assert.ok(Math.abs(finished.alpha + opening.alpha - 1) < 1e-12);
    assert.deepEqual(finished.state, stateAt(1));
    assert.deepEqual(opening.state, stateAt(0));
    assert.equal(finished.stamps.length, 3);
    assert.deepEqual(opening.stamps, []);
  }
  assert.equal(sceneAt(240).layers[0].alpha, 1);
  assert.equal(sceneAt(299).layers[1].alpha, 59 / 60);
  assert.throws(() => sceneAt(1.5), TypeError);
  assert.throws(() => exactBody("left", 3n, 4n, 5n, 1n), RangeError);
  assert.throws(() => exactBody("top", 3n, 4n, 6n, 1n), RangeError);
  assert.throws(() => exactBody("top", 3, 4, 5, 1n), TypeError);
  assert.throws(() => exactFraction(5n), RangeError);
  assert.throws(() => exactFraction(1n, 4n, { law: "cubic" }), RangeError);
});

test("the catalog keeps the clause as the first edition prints it", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "galileo-istessa-circonferenza");
  const approved = "si vedranno sempre tutti nell’ istessa circonferenza di cerchi successiuamente crescenti";
  assert.equal(quote.text, approved);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 88);
  // The 1638 u, not the 1898 v; the apostrophe with the space both editions set after it.
  assert.ok(quote.text.includes("successiuamente"));
  assert.ok(!quote.text.includes("successivamente"));
  assert.equal(quote.text.codePointAt(quote.text.indexOf("’")), 0x2019);
  assert.ok(quote.text.includes("nell’ istessa"));
  assert.doesNotMatch(quote.text, /[,.;:]/u);
  assert.equal(quote.lang, "it");
  assert.equal(quote.author, "Galileo Galilei");
  assert.equal(quote.source, "Discorsi e dimostrazioni matematiche, giornata terza");
  assert.equal(quote.year, 1638);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://archive.org/details/discorsiedimostr00gali/page/n196/mode/1up");
  assert.equal(CATALOG.quotes.filter((entry) => entry.lang === "it").length, 2);
});

test("the notes name both editions, keep the second family as the project's, and give the numbers the tests hold", () => {
  const section = NOTES.slice(NOTES.indexOf("The Same Circumference starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  assert.match(section, /Elzevir 1638/u);
  assert.match(section, /Favaro 1898/u);
  assert.match(section, /`successiuamente\] Elzevir 1638, p\. 185 : successivamente Favaro 1898, p\. 224`/u);
  assert.match(section, /page 185\]\(https:\/\/archive\.org\/details\/discorsiedimostr00gali\/page\/n196\/mode\/1up\)/u);
  assert.match(section, /page 224\]\(https:\/\/archive\.org\/details\/agh6462\.0008\.001\.umich\.edu\/page\/n221\/mode\/1up\)/u);
  assert.match(section, /The second family, the touching and the strides read off it are this project's construction/u);
  assert.match(section, /none of it is attributed to the text/u);
  assert.doesNotMatch(section, /Galileo (?:drew|knew|described) (?:the|a) (?:second|arriving|touching|kiss)/u);
  assert.match(section, /thirty times the odd numbers/u);
  assert.match(section, /30, 90, 150 and 210 pixels/u);
  assert.match(section, /four equal ones of 120/u);
  assert.match(section, /twenty rational points, five ticks and both families/u);
  assert.match(section, /sixty-nine chords/u);
  assert.match(section, /every 45 frames/u);
  assert.match(section, /The thumbnail is frame 135/u);
  assert.match(section, /eighty-eight code points/u);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "the-same-circumference");
  const quote = CATALOG.quotes.find((entry) => entry.id === "galileo-istessa-circonferenza");
  assert.equal(artwork.title, "The Same Circumference");
  assert.equal(artwork.entry, "p5js/artworks/the-same-circumference/index.html");
  assert.equal(artwork.interactivePath, "the-same-circumference/");
  assert.deepEqual(artwork.canvas, { width: 680, height: 680 });
  assert.deepEqual(artwork.quoteIds, ["galileo-istessa-circonferenza"]);
  // The thumbnail is the third tick: the two circles touching at the third mark.
  assert.deepEqual(artwork.thumbnail, { frame: 135 });
  assert.equal(tickFrames()[2], 135);
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/TheSameCircumference.mp4", durationSeconds: 10, scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `the-same-circumference` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 10 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 208);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">The Same Circumference</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="it">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
  assert.doesNotMatch(NOTES, /\| `the-same-circumference` \| pointer \|/u);
});

test("the sketch's whole drawing vocabulary is circles and lines", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), [
    "background", "circle", "createCanvas", "fill", "frameRate", "line", "noFill",
    "noLoop", "noStroke", "pixelDensity", "pop", "push", "scale", "stroke",
    "strokeWeight", "translate"
  ]);
  // No letter, numeral or arrow can reach the page at any frame: nothing that could draw
  // one is ever called.
  for (const forbidden of ["text", "arc", "vertex", "rect", "triangle", "image", "quad", "drawKeyHint"]) {
    assert.ok(!called.has(forbidden), `${forbidden} must not be drawn`);
  }
  assert.doesNotMatch(source, /\b(?:Math\.)?random\s*\(/u);
  assert.doesNotMatch(source, /drawKeyHint|hint-mode|input-indicator|mouseX/u);
});

test("an export frame draws the rim, the chords, the stamps, the two circles and every body", async () => {
  const priorWindow = globalThis.window;
  const calls = { circles: [], lines: [], scale: [], density: [], frameRate: [] };
  const noop = () => {};
  class RecordingP5 {
    constructor(define) {
      const p = {
        createCanvas: (width, height) => { calls.canvas = [width, height]; return { parent: noop }; },
        background: (...colour) => {
          calls.background = colour;
          calls.circles = []; calls.lines = []; calls.strokes = []; calls.fills = []; calls.weights = [];
        },
        circle: (...args) => calls.circles.push(args),
        line: (...args) => calls.lines.push(args),
        scale: (value) => calls.scale.push(value),
        translate: (...value) => { calls.translate = value; },
        pixelDensity: (value) => calls.density.push(value),
        frameRate: (value) => calls.frameRate.push(value),
        push: noop, pop: noop, noFill: noop, noStroke: noop, noLoop: noop,
        stroke: (...colour) => calls.strokes.push(colour),
        strokeWeight: (weight) => calls.weights.push(weight),
        fill: (...colour) => calls.fills.push(colour)
      };
      define(p);
      p.setup();
    }
  }
  globalThis.window = { p5: RecordingP5, location: { search: "?capture=1&renderScale=2" } };
  try {
    await import(SKETCH_URL);
    assert.deepEqual(calls.canvas, [1360, 1360]);
    assert.deepEqual(calls.density, [1]);
    assert.deepEqual(calls.frameRate, [30]);
    assert.deepEqual(calls.background, [6, 7, 12]);
    assert.deepEqual(calls.translate, [340, 340]);
    assert.ok(calls.scale.every((value) => value === 2));
    // The opening frame: the chords, the rim, the arriving circle on the rim, the bodies.
    assert.equal(calls.lines.length, 69);
    assert.deepEqual(calls.lines[34], [0, -240, 0, 240]);
    assert.equal(calls.circles.length, 1 + 1 + 34 + 34 + 2);
    assert.deepEqual(calls.circles[0], [0, 0, 480]);
    assert.deepEqual(calls.circles[1], [0, 0, 480]);
    assert.deepEqual(calls.strokes.slice(0, 3), [[246, 244, 236, 46], [246, 244, 236, 110], [104, 144, 204, 190]]);
    assert.deepEqual(calls.weights.slice(0, 3), [0.7, 1, 1.3]);

    const state = await window.__renderFrame(135);
    const scene = sceneAt(135);
    // Three stamps of two circles and a mark, the two circles, the bodies, the halo and the shared body.
    assert.equal(calls.lines.length, 69);
    assert.equal(calls.circles.length, 1 + 3 * 3 + 2 + 34 + 34 + 2);
    const [, ...drawn] = calls.circles;
    assert.deepEqual(drawn[0], [0, -225, 30]);
    assert.deepEqual(drawn[1], [0, 15, 450]);
    assert.deepEqual(drawn[2], [0, -210, 5]);
    assert.deepEqual(drawn[9], [0, -105, 270]);
    assert.deepEqual(drawn[10], [0, 135, 210]);
    assert.deepEqual(drawn[11], [...scene.layers[0].state.topBodies[0], 7]);
    assert.deepEqual(drawn[drawn.length - 1], [0, 30, 9]);
    assert.deepEqual(drawn[drawn.length - 2], [0, 30, 22]);
    assert.deepEqual(calls.fills.at(-1), [246, 244, 236, 255]);
    assert.deepEqual(calls.fills.at(-2), [246, 244, 236, 56]);
    assert.equal(state.kind, "video");
    assert.equal(state.frameIndex, 135);
    assert.equal(state.totalFrames, 300);
    assert.equal(state.durationSeconds, 10);
    assert.equal(state.act, "fall");
    assert.deepEqual(state.layers, [{ alpha: 1, fraction: 0.5625, kiss: [0, 30], stamps: [1, 2, 3] }]);
    assert.equal(state.chords, 69);
    assert.equal(state.bodies, 69);
    assert.equal(state.palette, "crystal");
    assert.deepEqual(state.outputSize, { width: 1360, height: 1360 });

    const rest = await window.__renderFrame(200);
    assert.equal(rest.act, "rest");
    // The arriving circle is a point at the rest, so it is not drawn as a circle.
    assert.equal(calls.circles.length, 1 + 3 * 3 + 1 + 34 + 34 + 2);
    assert.deepEqual(await window.__renderFrame(300), await window.__renderFrame(0));
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

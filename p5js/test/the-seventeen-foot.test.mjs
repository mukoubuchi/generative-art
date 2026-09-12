import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACTS,
  COMMENSURABLE_RADII,
  CROSSING,
  CROSSING_HEIGHT,
  DURATION_SECONDS,
  FIGURE_BOUNDS,
  FIGURE_POINTS,
  FIGURE_SPAN,
  FIRST_PAST_THE_TURN,
  INTRUDER,
  INTRUDER_RADIUS,
  LAST_RADIUS,
  LOGICAL_SIZE,
  ORIGIN,
  OVERRUN,
  OVERRUN_OF_THE_VERTEX,
  PAGE_MARGIN,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  TRIANGLE_COUNT,
  TURN_SHORT,
  VERTICES,
  actAt,
  arrivingVertex,
  bearingAt,
  eased,
  extraAt,
  fadeAt,
  hypotSquared,
  isSquare,
  lightAt,
  nearlyEqual,
  onPage,
  reachAt,
  sceneAt,
  segmentsCross,
  tipAt,
  vertexAt
} from "../artworks/the-seventeen-foot/the-seventeen-foot.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const README = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/the-seventeen-foot/sketch.js", import.meta.url);
const INDEX_HTML = readFileSync(new URL("../artworks/the-seventeen-foot/index.html", import.meta.url), "utf8");
const MODEL = readFileSync(new URL("../artworks/the-seventeen-foot/the-seventeen-foot.js", import.meta.url), "utf8");

const TWO_PI = 2 * Math.PI;
const APPROVED_QUOTE =
  "κατὰ μίαν ἑκάστην προαιρούμενος μέχρι τῆς ἑπτακαιδεκάποδος· ἐν δὲ ταύτῃ πως ἐνέσχετο";

test("sixteen triangles take the radius from one to the square root of seventeen, and the intruder to eighteen", () => {
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 10);
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(TRIANGLE_COUNT, 16);
  assert.equal(LAST_RADIUS, 17);
  assert.equal(INTRUDER, 17);
  assert.equal(INTRUDER_RADIUS, 18);
  assert.equal(VERTICES.length, 18);
  assert.deepEqual(ORIGIN, [0, 0]);
  assert.deepEqual(VERTICES[0], [1, 0]);
  assert.deepEqual(vertexAt(1), [1, 0]);
  for (let index = 1; index <= INTRUDER_RADIUS; index += 1) {
    assert.ok(nearlyEqual(hypotSquared(vertexAt(index)), index), `vertex ${index} is not at √${index}`);
    assert.deepEqual(VERTICES[index - 1], vertexAt(index));
  }
  assert.throws(() => vertexAt(0), RangeError);
  assert.throws(() => vertexAt(1.5), TypeError);
});

test("each new side is a unit perpendicular to the radius it leaves", () => {
  for (let index = 1; index < INTRUDER_RADIUS; index += 1) {
    const from = vertexAt(index);
    const to = vertexAt(index + 1);
    const step = [to[0] - from[0], to[1] - from[1]];
    assert.ok(nearlyEqual(Math.hypot(...step), 1), `side ${index} is not a unit`);
    assert.ok(nearlyEqual(from[0] * step[0] + from[1] * step[1], 0), `angle at vertex ${index} is not right`);
  }
  // Controls: a step along the radius, or a step that is not a unit, breaks the recurrence.
  const from = vertexAt(4);
  const along = [from[0] * 1.5, from[1] * 1.5];
  assert.ok(!nearlyEqual(hypotSquared(along), 5));
  const radius = Math.hypot(...from);
  const tooLong = [from[0] - 1.1 * from[1] / radius, from[1] + 1.1 * from[0] / radius];
  assert.ok(!nearlyEqual(hypotSquared(tooLong), 5));
});

test("the whole-number radii are exactly the squares, decided in whole numbers", () => {
  assert.deepEqual(COMMENSURABLE_RADII, [1, 4, 9, 16]);
  for (let index = 1; index <= LAST_RADIUS; index += 1) {
    assert.equal(isSquare(index), [1, 4, 9, 16].includes(index));
  }
  assert.equal(isSquare(17), false);
  assert.equal(isSquare(16), true);
  // The decision is made by squaring a rounded root, not by comparing lengths within a tolerance.
  assert.match(MODEL, /const root = Math\.round\(Math\.sqrt\(value\)\);\n  return root \* root === value;/u);
  assert.equal(isSquare(18), false);
  assert.equal(isSquare(0), true);
  assert.equal(isSquare(-4), false);
  assert.throws(() => isSquare(16.0000001), TypeError);
  // Stopping on the seventeen-foot is stopping on an incommensurable radius.
  assert.ok(!COMMENSURABLE_RADII.includes(LAST_RADIUS));
  assert.ok(COMMENSURABLE_RADII.includes(LAST_RADIUS - 1));
});

test("the turn passes a full circle between the seventeenth radius and the eighteenth, by the margins the notes give", () => {
  assert.equal(bearingAt(1), 0);
  for (let index = 2; index <= INTRUDER_RADIUS; index += 1) {
    assert.ok(bearingAt(index) > bearingAt(index - 1));
    assert.ok(nearlyEqual(bearingAt(index) - bearingAt(index - 1), Math.atan(1 / Math.sqrt(index - 1))));
  }
  assert.equal(FIRST_PAST_THE_TURN, 18);
  assert.ok(bearingAt(17) < TWO_PI);
  assert.ok(bearingAt(18) > TWO_PI);
  assert.equal(bearingAt(17).toFixed(6), "6.128731");
  assert.equal(bearingAt(18).toFixed(6), "6.366672");
  assert.equal(TURN_SHORT.toFixed(6), "0.154454");
  assert.equal(OVERRUN.toFixed(6), "0.083487");
  assert.ok(TURN_SHORT > 0 && OVERRUN > 0);
  // The overrun read off the vertex itself agrees with the summed bearing.
  assert.ok(nearlyEqual(OVERRUN_OF_THE_VERTEX, OVERRUN, 1e-12));
  // The crossing: the eighteenth radius meets the first unit side, x = 1, at tan(overrun).
  assert.ok(nearlyEqual(CROSSING_HEIGHT, Math.tan(OVERRUN), 1e-12));
  assert.equal(CROSSING_HEIGHT.toFixed(4), "0.0837");
  assert.deepEqual(CROSSING, [1, CROSSING_HEIGHT]);
  assert.ok(segmentsCross(ORIGIN, VERTICES[17], VERTICES[0], VERTICES[1]), "the eighteenth radius must cross the first unit side");
  // Controls: the seventeenth radius is short of the ray and crosses nothing; the sixteen
  // triangles' outer path does not cross itself.
  assert.ok(!segmentsCross(ORIGIN, VERTICES[16], VERTICES[0], VERTICES[1]));
  let crossings = 0;
  for (let first = 0; first < TRIANGLE_COUNT; first += 1) {
    for (let second = first + 2; second < TRIANGLE_COUNT; second += 1) {
      if (segmentsCross(VERTICES[first], VERTICES[first + 1], VERTICES[second], VERTICES[second + 1])) crossings += 1;
    }
  }
  assert.equal(crossings, 0);
});

test("the acts fill the clip: the sixteen in turn, the intruder in and out, the hold, and the dissolve back to the first frame", () => {
  assert.deepEqual(ACTS.map((act) => [act.name, act.frames]), [
    ["lay", 160], ["rest", 12], ["cross", 24], ["crossed", 12], ["retreat", 24], ["hold", 38], ["dissolve", 30]
  ]);
  assert.equal(ACTS.reduce((sum, act) => sum + act.frames, 0), TOTAL_FRAMES);
  assert.equal(actAt(0).name, "lay");
  assert.equal(actAt(159).name, "lay");
  assert.equal(actAt(160).name, "rest");
  assert.equal(actAt(172).name, "cross");
  assert.equal(actAt(196).name, "crossed");
  assert.equal(actAt(208).name, "retreat");
  assert.equal(actAt(232).name, "hold");
  assert.equal(actAt(270).name, "dissolve");
  assert.equal(actAt(299).name, "dissolve");
  assert.deepEqual(sceneAt(300), sceneAt(0));
  assert.deepEqual(sceneAt(-1), sceneAt(299));
  assert.throws(() => sceneAt(1.5), TypeError);

  // The sixteen arrive ten frames each, monotonically, and are all there at the rest.
  assert.equal(reachAt(0), 0);
  assert.equal(reachAt(80), 8);
  assert.equal(reachAt(160), 16);
  let previous = -1;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    assert.ok(reachAt(frame) >= previous);
    previous = reachAt(frame);
  }
  // The intruder: nought before the cross, one exactly through the stay, nought again
  // from the hold on, eased so that neither end jolts.
  assert.equal(extraAt(171), 0);
  assert.equal(extraAt(172), 0);
  assert.equal(extraAt(196), 1);
  assert.equal(extraAt(207), 1);
  assert.equal(extraAt(208), 1);
  assert.equal(extraAt(232), 0);
  assert.equal(extraAt(250), 0);
  assert.ok(extraAt(184) > 0 && extraAt(184) < 1);
  assert.equal(extraAt(184), eased(0.5));
  assert.equal(extraAt(220), 1 - eased(0.5));
  // Eased, not linear: a quarter of the way through the act is less than a quarter of the way in.
  assert.equal(extraAt(178), eased(0.25));
  assert.equal(eased(0.25), 0.15625);
  assert.equal(extraAt(214), 1 - eased(0.25));
  for (let frame = 173; frame <= 196; frame += 1) assert.ok(extraAt(frame) > extraAt(frame - 1));
  for (let frame = 209; frame <= 232; frame += 1) assert.ok(extraAt(frame) < extraAt(frame - 1));
  assert.equal(eased(0), 0);
  assert.equal(eased(1), 1);
  assert.ok(eased(0.001) < 0.001 && 1 - eased(0.999) < 0.001);

  // The figure is whole until the dissolve and gone on the last frame; the last frame and
  // the first both draw nothing but the ground.
  assert.equal(fadeAt(0), 1);
  assert.equal(fadeAt(269), 1);
  assert.equal(fadeAt(270), 1);
  assert.ok(fadeAt(285) > 0 && fadeAt(285) < 1);
  assert.equal(fadeAt(299), 0);
  assert.equal(sceneAt(299).fade, 0);
  assert.equal(sceneAt(0).reach, 0);
});

test("the light is the angle past the opening ray as a share of the overrun: nought short of it, one at full arrival", () => {
  assert.equal(lightAt(0), 0);
  assert.equal(lightAt(1), 1);
  assert.equal(sceneAt(196).light, 1);
  assert.equal(sceneAt(172).light, 0);
  assert.equal(sceneAt(232).light, 0);
  assert.equal(sceneAt(250).light, 0);
  // The tip runs along the intruder's unit side, from √17 to √18.
  assert.deepEqual(tipAt(0), VERTICES[16]);
  assert.deepEqual(tipAt(1), VERTICES[17]);
  assert.deepEqual(tipAt(0.25), arrivingVertex(INTRUDER, 0.25));
  // Below the ray the light stays nought, and once above it rises monotonically to one.
  let lit = false;
  let previous = 0;
  for (let step = 0; step <= 1000; step += 1) {
    const light = lightAt(step / 1000);
    assert.ok(light >= previous, `the light must not fall on the way in (${step})`);
    if (light > 0) lit = true;
    else assert.ok(!lit, "the light must not go out on the way in");
    previous = light;
  }
  assert.ok(lit);
  assert.equal(lightAt(0.5), 0);
  assert.ok(lightAt(0.75) > 0 && lightAt(0.75) < 1);
  // The share is the angle over the full overrun.
  const tip = tipAt(0.9);
  assert.ok(nearlyEqual(lightAt(0.9), Math.atan2(tip[1], tip[0]) / OVERRUN_OF_THE_VERTEX));
  assert.throws(() => arrivingVertex(18, 0.5), RangeError);
  assert.throws(() => arrivingVertex(3, 1.5), RangeError);
});

test("the page is fitted to the origin and all eighteen vertices, inside the margin", () => {
  assert.equal(PAGE_MARGIN, 48);
  assert.equal(FIGURE_POINTS.length, 19);
  assert.equal(FIGURE_SPAN, Math.max(FIGURE_BOUNDS.maxX - FIGURE_BOUNDS.minX, FIGURE_BOUNDS.maxY - FIGURE_BOUNDS.minY));
  assert.ok(FIGURE_BOUNDS.maxX >= VERTICES[17][0], "the intruder's vertex must be inside the envelope");
  const pages = FIGURE_POINTS.map(onPage);
  const left = Math.min(...pages.map((point) => point[0]));
  const right = Math.max(...pages.map((point) => point[0]));
  const top = Math.min(...pages.map((point) => point[1]));
  const bottom = Math.max(...pages.map((point) => point[1]));
  assert.ok(left >= PAGE_MARGIN - 1e-9 && top >= PAGE_MARGIN - 1e-9);
  assert.ok(right <= LOGICAL_SIZE - PAGE_MARGIN + 1e-9 && bottom <= LOGICAL_SIZE - PAGE_MARGIN + 1e-9);
  assert.ok(nearlyEqual(Math.max(right - left, bottom - top), LOGICAL_SIZE - 2 * PAGE_MARGIN, 1e-9));
  // Up becomes down: the crossing, above the opening ray, is drawn above the origin.
  assert.ok(onPage(CROSSING)[1] < onPage(ORIGIN)[1]);
  assert.ok(onPage(CROSSING)[0] > onPage(ORIGIN)[0]);
});

test("the archived original: catalog keeps the clause both editions print, at the leaf it is on", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "platon-en-de-tautei").original;
  assert.equal(quote.text, APPROVED_QUOTE);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 84);
  assert.equal(quote.text.split(" ")[6], "ἑπτακαιδεκάποδος·");
  assert.deepEqual(
    [...quote.text.split(" ")[6].replace("·", "")].map((letter) => letter.codePointAt(0)),
    [0x1F11, 0x03C0, 0x03C4, 0x03B1, 0x03BA, 0x03B1, 0x03B9, 0x03B4, 0x03B5, 0x03BA, 0x03AC, 0x03C0, 0x03BF, 0x03B4, 0x03BF, 0x03C2]
  );
  assert.equal(quote.lang, "grc");
  assert.equal(quote.author, "Πλάτων");
  assert.equal(quote.source, "Theaetetus 147d");
  assert.equal(quote.year, null);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://archive.org/details/theaetetuswithtr00platuoft/page/n31/mode/1up");
  assert.equal(CATALOG.quotes.filter((entry) => (entry.original ?? entry).lang === "grc").length, 10);
  assert.equal(CATALOG.quotes.filter((entry) => (entry.original ?? entry).author === "Πλάτων").length, 3);
});

test("the notes keep the spiral as this project's, give the numbers the tests hold, and name both editions", () => {
  const section = NOTES.slice(NOTES.indexOf("The Seventeen-Foot starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  assert.match(section, /its title is the sentence's own word, ἑπτακαιδεκάποδος, the seventeen-foot/u);
  assert.match(section, /this project's construction, and none of it is attributed to the text/u);
  assert.doesNotMatch(section, /Theodorus (?:drew|knew) the spiral/u);
  assert.doesNotMatch(section, /stopped because/u);
  assert.match(section, /It is not a reason attributed to Theodorus, and the clip gives none/u);
  assert.match(section, /one, four, nine and sixteen, decided by squaring a rounded root/u);
  assert.match(section, /6\.128731 at the seventeenth, which is 0\.154454 short of 2π, and 6\.366672 at the eighteenth, 0\.083487 over/u);
  assert.match(section, /at a height of `tan\(0\.083487\)`, 0\.0837 of a foot/u);
  assert.match(section, /a hundred and sixty frames, ten to a triangle/u);
  assert.match(section, /a rest of twelve/u);
  assert.match(section, /over twenty-four frames, eased/u);
  assert.match(section, /a stay of twelve/u);
  assert.match(section, /held for thirty-eight; and a dissolve of thirty/u);
  assert.match(section, /forty-eight logical pixels of margin/u);
  assert.match(section, /at a level of six tenths, a gold halo of six additive layers, a gold core and a white heart/u);
  assert.match(section, /the light is a measurement/u);
  assert.match(section, /The thumbnail is frame 196/u);
  assert.match(section, /Kennedy 1881/u);
  assert.match(section, /Fowler 1921/u);
  assert.match(section, /page 10\]\(https:\/\/archive\.org\/details\/theaetetuswithtr00platuoft\/page\/n31\/mode\/1up\)/u);
  assert.match(section, /page 24\]\(https:\/\/archive\.org\/details\/L123PlatoVIITheaetetusSophist\/page\/n34\/mode\/1up\)/u);
  assert.match(section, /`ξύμμετροι\] Kennedy 1881, p\. 10 : σύμμετροι Fowler 1921, p\. 24`/u);
  assert.match(section, /eighty-four code points/u);
  assert.match(README, /\| \[The Seventeen-Foot\]\(p5js\/artworks\/the-seventeen-foot\/\) \|/u);
  assert.match(MODEL, /reason: none is in the text/u);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "the-seventeen-foot");
  const quote = CATALOG.quotes.find((entry) => entry.id === "platon-en-de-tautei");
  assert.equal(artwork.title, "The Seventeen-Foot");
  assert.equal(artwork.entry, "p5js/artworks/the-seventeen-foot/index.html");
  assert.equal(artwork.interactivePath, "the-seventeen-foot/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, ["platon-en-de-tautei"]);
  // The thumbnail: the intruder fully arrived, the crossing lit.
  assert.deepEqual(artwork.thumbnail, { frame: 196 });
  assert.equal(actAt(196).name, "crossed");
  assert.equal(sceneAt(196).light, 1);
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/TheSeventeenFoot.mp4", durationSeconds: DURATION_SECONDS, scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `the-seventeen-foot` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 10 seconds,/u);
  assert.match(INDEX_HTML, /<title>The Seventeen-Foot<\/title>/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.ok(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters) <= MANIFEST.defaults.maxWeightedCharacters);
  assert.equal(body.split("\n")[0], quote.text);
  assert.equal(body.split("\n")[1], `— ${quote.author}, ${quote.source}`);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">The Seventeen-Foot</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="en">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
  // Not an artwork that answers to the reader: no legend row.
  assert.doesNotMatch(NOTES, /\| `the-seventeen-foot` \| [a-z, +]+ \| `/u);
});

test("the sketch's whole drawing vocabulary is triangles, lines and circles, with no notation", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), [
    "background", "blendMode", "circle", "createCanvas", "fill", "frameRate", "line", "noFill",
    "noLoop", "noStroke", "pixelDensity", "pop", "push", "scale", "stroke", "strokeCap",
    "strokeWeight", "triangle"
  ]);
  for (const forbidden of ["text", "arc", "vertex", "beginShape", "rect", "image", "quad", "drawKeyHint"]) {
    assert.ok(!called.has(forbidden), `${forbidden} must not be drawn`);
  }
  assert.doesNotMatch(source, /\b(?:Math\.)?random\s*\(/u);
  assert.doesNotMatch(source, /drawKeyHint|hint-mode|input-indicator|mouseX|overlap|Theodorus stopped because/u);
  assert.match(source, /from "\.\/the-seventeen-foot\.js"/u);
  assert.match(source, /const STAR_LEVEL = 0\.6;/u);
  assert.match(source, /const INTRUDER_RADIUS_WEIGHT = 0\.9;/u);
  assert.match(source, /const INTRUDER_RADIUS_ALPHA = 96;/u);
});

test("an export frame draws the sixteen, then the intruder and the lit crossing, and the ground alone at both ends", async () => {
  const priorWindow = globalThis.window;
  const calls = {};
  const noop = () => {};
  class RecordingP5 {
    constructor(define) {
      const p = {
        createCanvas: (width, height) => { calls.canvas = [width, height]; return { parent: noop }; },
        background: (...colour) => {
          calls.background = colour;
          calls.triangles = []; calls.lines = []; calls.circles = []; calls.fills = []; calls.strokes = []; calls.weights = []; calls.blends = [];
        },
        triangle: (...args) => calls.triangles.push(args),
        line: (...args) => calls.lines.push(args),
        circle: (...args) => calls.circles.push(args),
        fill: (...colour) => calls.fills.push(colour),
        stroke: (...colour) => calls.strokes.push(colour),
        strokeWeight: (weight) => calls.weights.push(weight),
        ADD: "add", BLEND: "blend", ROUND: "round",
        blendMode: (mode) => calls.blends.push([mode, calls.circles.length]),
        strokeCap: (cap) => { calls.cap = cap; },
        scale: (value) => { calls.scale = value; },
        pixelDensity: (value) => { calls.density = value; },
        frameRate: (value) => { calls.frameRate = value; },
        push: noop, pop: noop, noFill: noop, noStroke: noop, noLoop: noop
      };
      define(p);
      p.setup();
    }
  }
  globalThis.window = { p5: RecordingP5, location: { search: "?capture=1&renderScale=2" } };
  try {
    await import(SKETCH_URL);
    // The opening frame is the ground and nothing else.
    assert.deepEqual(calls.canvas, [1360, 1360]);
    assert.equal(calls.density, 1);
    assert.equal(calls.frameRate, 30);
    assert.deepEqual(calls.background, [6, 7, 12]);
    assert.equal(calls.triangles.length, 0);
    assert.equal(calls.lines.length, 0);
    assert.deepEqual(window.__ARTWORK_STATE__.outputSize, { width: 1360, height: 1360 });
    assert.equal(window.__ARTWORK_STATE__.triangles, 0);

    // Ten triangles in: ten sectors, eleven radii and ten sides, no intruder, no light.
    const laying = await window.__renderFrame(100);
    assert.equal(laying.act, "lay");
    assert.equal(laying.reach, 10);
    assert.equal(laying.triangles, 10);
    assert.equal(calls.scale, 2);
    assert.equal(calls.cap, "round");
    assert.equal(calls.triangles.length, 10);
    assert.equal(calls.lines.length, 11 + 10);
    assert.equal(calls.circles.length, 0);
    assert.deepEqual(calls.blends, []);
    assert.deepEqual(calls.fills[0], [252, 204, 116, 5]);
    assert.deepEqual(calls.fills[9], [252, 204, 116, 11.6]);
    // The radius to the unit foot is gold and heavy; the one to √2 is a bone hair; √4 is gold.
    assert.deepEqual(calls.strokes[0], [252, 204, 116, 225]);
    assert.equal(calls.weights[0], 2);
    assert.deepEqual(calls.strokes[1], [246, 244, 236, 60]);
    assert.equal(calls.weights[1], 0.6);
    assert.deepEqual(calls.strokes[3], [252, 204, 116, 225]);
    // The sides come last, in bone at the sides' weight.
    assert.deepEqual(calls.strokes.at(-1), [246, 244, 236, 225]);
    assert.equal(calls.weights.at(-1), 2);
    const origin = onPage(ORIGIN);
    assert.deepEqual(calls.lines[0], [origin[0], origin[1], ...onPage(VERTICES[0])]);

    // The intruder fully arrived: sixteen sectors and its own, thirty-three lines and its
    // radius and side, then the star, added rather than painted, and only the star.
    const crossed = await window.__renderFrame(196);
    assert.equal(crossed.act, "crossed");
    assert.equal(crossed.extra, 1);
    assert.equal(crossed.light, 1);
    assert.equal(crossed.triangles, 16);
    assert.equal(calls.triangles.length, 16 + 1);
    assert.equal(calls.lines.length, 17 + 16 + 2);
    assert.equal(calls.circles.length, 8);
    assert.deepEqual(calls.blends, [["add", 0], ["blend", 8]]);
    assert.deepEqual(calls.fills[15], [252, 204, 116, 16]);
    assert.deepEqual(calls.fills[16], [104, 144, 204, 64]);
    assert.deepEqual(calls.strokes.at(-2), [156, 192, 240, 96]);
    assert.equal(calls.weights.at(-2), 0.9);
    assert.deepEqual(calls.strokes.at(-1), [156, 192, 240, 225]);
    const crossing = onPage(CROSSING);
    assert.deepEqual(calls.circles[0], [crossing[0], crossing[1], 2 * (11 + 46 * 0.6) / 2]);
    assert.deepEqual(calls.circles[6], [crossing[0], crossing[1], 2 * 4.2]);
    assert.deepEqual(calls.circles[7], [crossing[0], crossing[1], 2 * 2.1]);
    assert.deepEqual(calls.fills[17], [252, 204, 116, 16]);
    assert.deepEqual(calls.fills.at(-2), [252, 204, 116, 204]);
    assert.deepEqual(calls.fills.at(-1), [248, 250, 255, 196]);
    assert.deepEqual(crossed.crossing, crossing);
    assert.equal(crossed.kind, "video");
    assert.equal(crossed.totalFrames, 300);
    assert.equal(crossed.durationSeconds, 10);

    // Half way in, the intruder is drawn as far as it has come and the crossing is dark.
    const coming = await window.__renderFrame(184);
    assert.equal(coming.extra, eased(0.5));
    assert.equal(coming.light, 0);
    assert.equal(calls.triangles.length, 17);
    assert.equal(calls.circles.length, 0);
    assert.deepEqual(calls.triangles[16].slice(4), onPage(arrivingVertex(17, eased(0.5))));

    // Part way over the ray the star carries the light: every part of it at the light's share.
    const partly = await window.__renderFrame(190);
    assert.ok(partly.light > 0 && partly.light < 1);
    assert.equal(calls.circles.length, 8);
    assert.deepEqual(calls.fills.at(-8), [252, 204, 116, 16 * partly.light]);
    assert.deepEqual(calls.fills.at(-2), [252, 204, 116, 204 * partly.light]);
    assert.deepEqual(calls.fills.at(-1), [248, 250, 255, 196 * partly.light]);

    // The hold: the sixteen alone, nothing of the intruder, nothing lit.
    const held = await window.__renderFrame(250);
    assert.equal(held.act, "hold");
    assert.equal(calls.triangles.length, 16);
    assert.equal(calls.lines.length, 17 + 16);
    assert.equal(calls.circles.length, 0);

    // The dissolve carries the fade into every alpha; the last frame is the ground alone.
    const fading = await window.__renderFrame(285);
    assert.ok(fading.fade > 0 && fading.fade < 1);
    assert.deepEqual(calls.fills[0], [252, 204, 116, 5 * fading.fade]);
    assert.deepEqual(calls.strokes[0], [252, 204, 116, 225 * fading.fade]);
    const last = await window.__renderFrame(299);
    assert.equal(last.fade, 0);
    assert.equal(calls.triangles.length, 0);
    assert.equal(calls.lines.length, 0);
    assert.deepEqual(await window.__renderFrame(300), await window.__renderFrame(0));
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

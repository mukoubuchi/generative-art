import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACCENT_EVERY,
  ACTS,
  ACT_FRAMES,
  DURATION_SECONDS,
  EXACT_PIN,
  FULL_HEIGHT,
  HALF_COSINE,
  HALF_SINE,
  HEIGHT,
  MAX_TWIST,
  PLAYBACK_FPS,
  RADIUS,
  ROD_COUNT,
  ROD_LENGTH,
  TOTAL_FRAMES,
  TURNTABLE,
  WAIST,
  WIDTH,
  actAt,
  eased,
  exactPointOnRod,
  exactRod,
  exactlyOnCollar,
  exactlyOnHyperboloid,
  exactlyRodLength,
  heightAt,
  leverAtFrame,
  sceneAt,
  spinAtFrame,
  structureAt,
  twistAtLever,
  waistAt
} from "../artworks/innumerable-straight-lines/innumerable-straight-lines.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/innumerable-straight-lines/sketch.js", import.meta.url);

/** Rational bearings: the points of the unit circle where the arithmetic can be exact. */
const BEARINGS = [[1n, 0n, 1n], [3n, 4n, 5n], [-5n, 12n, 13n], [8n, -15n, 17n], [-1n, 0n, 1n], [20n, 21n, 29n]];
const SHARES = [[0n, 1n], [1n, 7n], [1n, 3n], [1n, 2n], [2n, 3n], [1n, 1n]].map(([n, d]) => ({ numerator: n, denominator: d }));

test("the collars, the rods and the clip keep their numbers", () => {
  assert.equal(WIDTH, 960);
  assert.equal(HEIGHT, 640);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 12);
  assert.equal(TOTAL_FRAMES, 360);
  assert.equal(ROD_COUNT, 36);
  assert.equal(ACCENT_EVERY, 6);
  assert.equal(RADIUS, 1);
  assert.equal(ROD_LENGTH, 13 / 5);
  assert.equal(HALF_SINE, 12 / 13);
  assert.equal(HALF_COSINE, 5 / 13);
  assert.equal(FULL_HEIGHT, 119 / 65);
  assert.equal(WAIST, 5 / 13);
  assert.ok(Math.abs(MAX_TWIST * 180 / Math.PI - 134.76027010391917) < 1e-12);
  assert.ok(Math.abs(TURNTABLE - Math.PI / 3) < 1e-15);
  assert.deepEqual(EXACT_PIN.sine, { numerator: 12n, denominator: 13n });
  assert.deepEqual(EXACT_PIN.cosine, { numerator: 5n, denominator: 13n });
  assert.deepEqual(EXACT_PIN.length, { numerator: 13n, denominator: 5n });
  assert.deepEqual(EXACT_PIN.height, { numerator: 119n, denominator: 65n });
  // The pin's numbers are one identity: 13² · 65² − 4 · 12² · 25 · ... written out, h² = L² − 4 sin².
  assert.equal(13n * 13n * 65n * 65n - 4n * 12n * 12n * 25n * 25n, 119n * 119n * 25n);
  assert.equal(12n * 12n + 5n * 5n, 13n * 13n);
});

test("at six rational bearings the rod's ends are on the collars, its length is the pin's, and six points of it are on the hyperboloid", () => {
  let checks = 0;
  for (const [a, b, d] of BEARINGS) {
    const rod = exactRod(a, b, d);
    assert.ok(exactlyOnCollar(rod.bottom));
    assert.ok(exactlyOnCollar(rod.top));
    assert.ok(exactlyRodLength(rod));
    for (const share of SHARES) {
      assert.ok(exactlyOnHyperboloid(exactPointOnRod(rod, share)));
      checks += 1;
    }
  }
  assert.equal(checks, 36);
  assert.throws(() => exactRod(3n, 4n, 6n), RangeError);
  assert.throws(() => exactRod(3, 4, 5), TypeError);
  assert.throws(() => exactPointOnRod(exactRod(3n, 4n, 5n), { numerator: 1, denominator: 2 }), TypeError);
});

// These controls are synthetic departures from the pin, not frozen code defects.
test("a wrong half-angle, a wrong length or a wrong height breaks the identities", () => {
  const rod = exactRod(3n, 4n, 5n);
  const share = SHARES[2];
  // The half-angle's sine one thirteenth short: the ends leave the collars and the length is wrong.
  const angle = { ...EXACT_PIN, sine: { numerator: 11n, denominator: 13n } };
  const bent = exactRod(3n, 4n, 5n, angle);
  assert.ok(!exactlyOnCollar(bent.bottom));
  assert.ok(!exactlyRodLength(bent, angle));
  // The rods a fifth longer: the ends are still on the collars, but the length is not the pin's.
  const longer = { ...EXACT_PIN, length: { numerator: 14n, denominator: 5n } };
  assert.ok(exactlyOnCollar(rod.bottom));
  assert.ok(!exactlyRodLength(rod, longer));
  // The height wrong: the ends are on the collars, but the surface equation fails off the ends.
  const taller = { ...EXACT_PIN, height: { numerator: 2n, denominator: 1n } };
  const stretched = exactRod(3n, 4n, 5n, taller);
  assert.ok(exactlyOnCollar(stretched.bottom));
  assert.ok(!exactlyRodLength(stretched));
  assert.ok(!exactlyOnHyperboloid(exactPointOnRod(stretched, share)));
  // A point off the rod is off the surface.
  const point = exactPointOnRod(rod, share);
  const nudged = { ...point, x: { numerator: point.x.numerator + point.x.denominator / 100n * 0n + 1n, denominator: point.x.denominator } };
  assert.ok(!exactlyOnHyperboloid(nudged));
});

test("every drawn rod keeps its length and its ends on the collars at every twist, and lies on the surface", () => {
  for (let step = 0; step <= 60; step += 1) {
    const twist = MAX_TWIST * step / 60;
    const structure = structureAt(twist);
    assert.equal(structure.rods.length, ROD_COUNT);
    assert.ok(Math.abs(structure.height - heightAt(twist)) < 1e-15);
    assert.ok(Math.abs(structure.waist - waistAt(twist)) < 1e-15);
    for (const rod of structure.rods) {
      assert.equal(rod.accent, rod.index % ACCENT_EVERY === 0);
      const length = Math.hypot(...rod.top.map((part, axis) => part - rod.bottom[axis]));
      assert.ok(Math.abs(length - ROD_LENGTH) < 1e-12);
      for (const end of [rod.bottom, rod.top]) {
        assert.ok(Math.abs(Math.hypot(end[0], end[2]) - RADIUS) < 1e-12);
        assert.ok(Math.abs(Math.abs(end[1]) - structure.height / 2) < 1e-12);
      }
      for (const u of [0, 0.2, 0.5, 0.8, 1]) {
        const point = rod.bottom.map((part, axis) => part + u * (rod.top[axis] - part));
        const left = point[0] * point[0] + point[2] * point[2] - structure.waist ** 2;
        const right = (2 * point[1] / structure.height) ** 2 * (RADIUS * RADIUS - structure.waist ** 2);
        assert.ok(Math.abs(left - right) < 1e-12);
      }
    }
  }
  // Untwisted the rods stand as a cylinder: full height, full waist, ends one above the other.
  const cylinder = structureAt(0);
  assert.equal(cylinder.height, ROD_LENGTH);
  assert.equal(cylinder.waist, RADIUS);
  for (const rod of cylinder.rods) {
    assert.ok(Math.abs(rod.top[0] - rod.bottom[0]) < 1e-15 && Math.abs(rod.top[2] - rod.bottom[2]) < 1e-15);
  }
  // At the full twist the numbers are the pin's.
  const full = structureAt(MAX_TWIST);
  assert.ok(Math.abs(full.height - FULL_HEIGHT) < 1e-15);
  assert.ok(Math.abs(full.waist - WAIST) < 1e-15);
  assert.throws(() => structureAt(-0.1), RangeError);
  assert.throws(() => structureAt(MAX_TWIST + 0.1), RangeError);
});

test("turning the collars only ever draws them together and the waist in", () => {
  let previous = structureAt(0);
  for (let step = 1; step <= 120; step += 1) {
    const current = structureAt(MAX_TWIST * step / 120);
    assert.ok(current.height < previous.height);
    assert.ok(current.waist < previous.waist);
    previous = current;
  }
});

test("a sixth of a turn carries each rod onto the rod six along, accents onto accents: the turntable closes", () => {
  const structure = structureAt(MAX_TWIST);
  const cosine = Math.cos(TURNTABLE);
  const sine = Math.sin(TURNTABLE);
  for (const rod of structure.rods) {
    const other = structure.rods[(rod.index + ROD_COUNT / 6) % ROD_COUNT];
    assert.equal(rod.accent, other.accent);
    for (const [from, to] of [[rod.bottom, other.bottom], [rod.top, other.top]]) {
      const turned = [from[0] * cosine - from[2] * sine, from[1], from[0] * sine + from[2] * cosine];
      assert.ok(Math.hypot(...turned.map((part, axis) => part - to[axis])) < 1e-12);
    }
  }
  // A twelfth of a turn carries the rods onto rods too -- three along -- but an accent onto
  // a plain rod, so the picture would not close there: the closure is the accents' period.
  const half = TURNTABLE / 2;
  const rod = structure.rods[0];
  const turned = [rod.bottom[0] * Math.cos(half) - rod.bottom[2] * Math.sin(half), rod.bottom[1], rod.bottom[0] * Math.sin(half) + rod.bottom[2] * Math.cos(half)];
  const landing = structure.rods[3];
  assert.ok(Math.hypot(...turned.map((part, axis) => part - landing.bottom[axis])) < 1e-12);
  assert.notEqual(rod.accent, landing.accent);
  assert.equal(ROD_COUNT % ACCENT_EVERY, 0);
  assert.equal(ROD_COUNT / 6 % ACCENT_EVERY, 0);
});

test("the acts fill the clip, the twist is eased and returns both ends exactly, and the stage turns a sixth", () => {
  assert.deepEqual(ACTS, [["open", 30], ["twist", 120], ["closed", 60], ["untwist", 120], ["open", 30]]);
  assert.equal(ACT_FRAMES, TOTAL_FRAMES);
  for (let frame = 0; frame < 30; frame += 1) assert.equal(sceneAt(frame).twist, 0);
  for (let frame = 150; frame < 210; frame += 1) assert.equal(sceneAt(frame).twist, MAX_TWIST);
  for (let frame = 330; frame < 360; frame += 1) assert.equal(sceneAt(frame).twist, 0);
  for (let frame = 31; frame < 150; frame += 1) assert.ok(sceneAt(frame).twist > sceneAt(frame - 1).twist);
  for (let frame = 211; frame < 330; frame += 1) assert.ok(sceneAt(frame).twist < sceneAt(frame - 1).twist);
  assert.equal(sceneAt(90).twist, twistAtLever(eased(0.5)));
  assert.ok(sceneAt(31).twist < twistAtLever(1 / 120));
  assert.equal(twistAtLever(0), 0);
  assert.equal(twistAtLever(1), MAX_TWIST);
  assert.equal(eased(0.5), 0.5);
  assert.throws(() => twistAtLever(1.5), RangeError);
  assert.throws(() => actAt(0.5), TypeError);
  assert.equal(actAt(0).name, "open");
  assert.equal(actAt(30).name, "twist");
  assert.equal(actAt(150).name, "closed");
  assert.equal(actAt(210).name, "untwist");
  assert.equal(actAt(330).name, "open");
  // The stage turns evenly, a sixth over the whole clip, and frame 360 is frame 0.
  assert.equal(spinAtFrame(0), 0);
  assert.ok(Math.abs(spinAtFrame(180) - TURNTABLE / 2) < 1e-15);
  assert.ok(Math.abs(spinAtFrame(359) - TURNTABLE * 359 / 360) < 1e-15);
  assert.deepEqual(sceneAt(360), sceneAt(0));
  assert.deepEqual(sceneAt(-1), sceneAt(359));
  assert.equal(leverAtFrame(180), 1);
});

test("the catalog keeps Wren's clause as the London edition prints it", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "wren-rectas-innumeras");
  const approved = "in superficie Cylindroidis, quamvis e duplici flexura constet, rectas nihilominus innumeras duci posse";
  assert.equal(quote.text, approved);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 102);
  // The London edition's letters: no long s, no ligature, no accent, and no colon.
  assert.doesNotMatch(quote.text, /[ſ:è]/u);
  assert.equal(quote.lang, "la");
  assert.equal(quote.author, "Christopher Wren");
  assert.equal(quote.source, "Philosophical Transactions, no. 48 (1669), p. 962");
  assert.equal(quote.year, 1669);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://archive.org/details/philosophicaltra4166roya/page/n77/mode/1up");
  assert.equal(CATALOG.quotes.filter((entry) => entry.lang === "la").length, 9);
});

test("the notes name both printings, keep the sculpture as the project's, and say what is not calculated", () => {
  const section = NOTES.slice(NOTES.indexOf("Innumerable Straight Lines starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  assert.match(section, /London 1669/u);
  assert.match(section, /Frankfurt 1669/u);
  assert.match(section, /`quamvis e\] London 1669, p\. 962 : qvamvis è Frankfurt 1669, p\. 213`/u);
  assert.match(section, /page 962\]\(https:\/\/archive\.org\/details\/philosophicaltra4166roya\/page\/n77\/mode\/1up\)/u);
  assert.match(section, /page 961\]\(https:\/\/archive\.org\/details\/philosophicaltra4166roya\/page\/n76\/mode\/1up\)/u);
  assert.match(section, /page 213\]\(https:\/\/archive\.org\/details\/s3id11856700\/page\/n244\/mode\/1up\)/u);
  assert.match(section, /Auth\. Christophoro Wren L L D\./u);
  assert.match(section, /calculates neither tension nor gravity nor any material/u);
  assert.match(section, /the sculpture is this project's construction and is not attributed to him/u);
  assert.doesNotMatch(section, /Wren (?:drew|knew|built) (?:a|the|this) (?:sculpture|model|rods)/u);
  // The title's innumerable against the thirty-six that are drawn.
  assert.match(section, /innumerable, as Wren says; the rods that are drawn are thirty-six of them/u);
  // The pin's numbers, and the stage's measured lift.
  assert.match(section, /one hundred and nineteen sixty-fifths and the waist is five thirteenths/u);
  assert.match(section, /lifted by twenty-seven logical pixels/u);
  assert.match(section, /66 above and 66 below and 294 either side/u);
  assert.match(section, /between 9\.83 and 14\.27 per cent/u);
  // Three metals, and the mark's meaning said in the notes.
  assert.match(section, /five of them for a plain rod, at 2\.6 logical pixels from its own line and 1\.1 thick, seven for a marked one at 3\.4 and 1\.3/u);
  assert.match(section, /four thin rings, standing at four points round the tube it would have had, of seventy-two segments each/u);
  assert.match(section, /silver for the thirty rods.*copper for the six that mark every sixth.*gold for the collars/su);
  assert.match(section, /that sixfold mark is the reading the loop closes on/u);
  assert.match(section, /drawn in straight lines and nothing else/u);
  assert.doesNotMatch(section, /drawn as shaded faces/u);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "innumerable-straight-lines");
  const quote = CATALOG.quotes.find((entry) => entry.id === "wren-rectas-innumeras");
  assert.equal(artwork.title, "Innumerable Straight Lines");
  assert.equal(artwork.entry, "p5js/artworks/innumerable-straight-lines/index.html");
  assert.equal(artwork.interactivePath, "innumerable-straight-lines/");
  assert.deepEqual(artwork.canvas, { width: 960, height: 640 });
  assert.deepEqual(artwork.quoteIds, ["wren-rectas-innumeras"]);
  // The thumbnail is the middle of the rest at the full twist.
  assert.deepEqual(artwork.thumbnail, { frame: 180 });
  assert.equal(actAt(180).name, "closed");
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/InnumerableStraightLines.mp4", durationSeconds: 12, scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `innumerable-straight-lines` \| 960×640 \| 1920×1280 MP4 at 30 fps \| 12 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 220);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Innumerable Straight Lines</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="la">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
  // Not an artwork that answers to the reader: no legend row.
  assert.doesNotMatch(NOTES, /\| `innumerable-straight-lines` \| [a-z, +]+ \| `/u);
});

test("the sketch's whole drawing vocabulary is shaded faces and the stage, with no light asked of the renderer", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), [
    "background", "createCanvas", "frameRate", "line", "linePerspective", "noFill", "noLoop",
    "pixelDensity", "pop", "push", "rotateX", "rotateY", "setAttributes", "stroke",
    "strokeWeight", "translate"
  ]);
  // Nothing is filled and nothing is a face: the figure is drawn in lines throughout.
  for (const forbidden of ["text", "rect", "circle", "ellipse", "fill", "beginShape", "vertex", "endShape",
    "cylinder", "torus", "sphere", "box", "image", "createGraphics",
    "ambientLight", "directionalLight", "pointLight", "specularMaterial", "shininess", "camera", "perspective", "ortho"]) {
    assert.ok(!called.has(forbidden), `${forbidden} must not be called`);
  }
  assert.match(source, /pinLogicalCamera\(p, HEIGHT, OUTPUT_WIDTH, OUTPUT_HEIGHT\)/u);
  assert.doesNotMatch(source, /drawKeyHint|hint-mode|input-indicator|mouseX|slider|querySelector/u);
  assert.match(source, /const STAGE_LIFT = -27;/u);
});

async function loadSketch(search, record) {
  const noop = () => {};
  class RecordingP5 {
    constructor(define) {
      const p = {
        WEBGL: "WEBGL", TRIANGLES: "TRIANGLES",
        frameCount: 0,
        createCanvas: (...args) => { record.canvas = args; return { parent: noop }; },
        setAttributes: (...args) => record.attributes.push(args),
        pixelDensity: (value) => record.density.push(value),
        frameRate: (value) => record.frameRate.push(value),
        perspective: (...args) => record.perspective.push(args),
        noLoop: noop,
        background: (...colour) => {
          record.background = colour;
          record.lines = []; record.strokes = []; record.weights = []; record.translate = []; record.rotateX = []; record.rotateY = [];
        },
        translate: (...args) => record.translate.push(args),
        rotateX: (value) => record.rotateX.push(value),
        rotateY: (value) => record.rotateY.push(value),
        linePerspective: (value) => record.linePerspective.push(value),
        line: (...args) => record.lines.push({ ends: args, stroke: record.strokes.at(-1), weight: record.weights.at(-1) }),
        stroke: (...colour) => record.strokes.push(colour),
        strokeWeight: (value) => record.weights.push(value),
        noFill: noop, push: noop, pop: noop
      };
      define(p);
      record.p = p;
      p.setup();
    }
  }
  globalThis.window = { p5: RecordingP5, location: { search } };
  await import(`${SKETCH_URL.href}?${search.slice(1)}`);
}

test("an export frame draws thirty-six bundles and two collars in lines under the pinned camera, turned by the frame's spin", async () => {
  const priorWindow = globalThis.window;
  const record = { attributes: [], density: [], frameRate: [], perspective: [], lines: [], strokes: [], weights: [], linePerspective: [], translate: [], rotateX: [], rotateY: [] };
  // Thirty rods of five hairlines, six accents of seven, and two collars of four rings of
  // seventy-two segments each.
  const rodLines = 30 * 5 + 6 * 7;
  const collarLines = 2 * 4 * 72;
  try {
    await loadSketch("?capture=1&renderScale=2", record);
    assert.deepEqual(record.canvas, [1920, 1280, "WEBGL"]);
    assert.deepEqual(record.attributes, [["preserveDrawingBuffer", true]]);
    assert.deepEqual(record.density, [1]);
    assert.deepEqual(record.frameRate, [30]);
    // The pinned camera: the logical height's own field, p5's default eye.
    assert.deepEqual(record.perspective, [[2 * Math.atan(640 / 2 / 800), 1920 / 1280, 80, 8000]]);
    assert.deepEqual(record.background, [6, 7, 12]);
    assert.deepEqual(record.translate, [[0, -27, 0]]);
    assert.deepEqual(record.rotateX, [-0.32]);
    assert.deepEqual(record.rotateY, [0.35]);
    // Every line's width is its own, and none of them thins with distance.
    assert.deepEqual(record.linePerspective, [false]);
    assert.equal(record.lines.length, rodLines + collarLines);
    // The bundles come first, then the two collars.
    const rods = record.lines.slice(0, rodLines);
    const collars = record.lines.slice(rodLines);
    assert.equal(collars.length, collarLines);
    assert.ok(collars.every(({ weight }) => weight === 1.6 * 2));
    // An accent is seven lines at 1.3, a plain rod five at 1.1, at the export's 2x.
    assert.equal(rods.filter(({ weight }) => weight === 1.3 * 2).length, 6 * 7);
    assert.equal(rods.filter(({ weight }) => weight === 1.1 * 2).length, 30 * 5);
    // The hairlines of a bundle stand on the circle the rod's tube would have had: the
    // accent's at 3.4 logical pixels from its own line, the plain rod's at 2.6, and every
    // one of them parallel to it.
    const radiusOf = ({ ends }, rod) => {
      const stageBottom = [rod.bottom[0] * 160, -rod.bottom[1] * 160, rod.bottom[2] * 160];
      const stageAxis = [(rod.top[0] - rod.bottom[0]) * 160, -(rod.top[1] - rod.bottom[1]) * 160, (rod.top[2] - rod.bottom[2]) * 160];
      const length = Math.hypot(...stageAxis);
      const offset = (point) => {
        const d = point.map((part, axis) => part - stageBottom[axis]);
        const along = (d[0] * stageAxis[0] + d[1] * stageAxis[1] + d[2] * stageAxis[2]) / length;
        return Math.sqrt(Math.max(0, d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - along ** 2));
      };
      return [offset(ends.slice(0, 3)), offset(ends.slice(3, 6))];
    };
    const untwisted = sceneAt(0);
    for (const line of rods.slice(0, 7)) {
      const [bottom, top] = radiusOf(line, untwisted.rods[0]);
      assert.ok(Math.abs(bottom - 3.4) < 1e-9 && Math.abs(top - 3.4) < 1e-9, "an accent's hairline stands 3.4 off its rod");
    }
    for (const line of rods.slice(7, 12)) {
      const [bottom, top] = radiusOf(line, untwisted.rods[1]);
      assert.ok(Math.abs(bottom - 2.6) < 1e-9 && Math.abs(top - 2.6) < 1e-9, "a rod's hairline stands 2.6 off its rod");
    }
    // Three metals, and each of the three used: a bundle's lines differ only in how the
    // two lights fall on them, so every line of one rod is that metal dimmed.
    const shares = (colour, metal) => colour.every((part, axis) => Math.abs(part / metal[axis] - colour[0] / metal[0]) < 1e-9);
    assert.ok(rods.slice(0, 7).every(({ stroke }) => shares(stroke, [196, 106, 74])), "the accents are copper");
    assert.ok(rods.slice(7, 12).every(({ stroke }) => shares(stroke, [246, 244, 236])), "the rods are silver");
    assert.ok(collars.every(({ stroke }) => shares(stroke, [252, 204, 116])), "the collars are gold");
    // The lights do fall: a bundle drawn flat in its metal would read as a ribbon, not a
    // rod, so the lines of one bundle differ in brightness, and the first accent's line and
    // the first rod's are these, which is the metal through the duals' two lights.
    const brightness = ({ stroke }) => stroke[0] + stroke[1] + stroke[2];
    const spread = (lines) => Math.max(...lines.map(brightness)) / Math.min(...lines.map(brightness));
    assert.ok(spread(rods.slice(0, 7)) > 2, "an accent's bundle must be shaded across");
    assert.ok(spread(rods.slice(7, 12)) > 1.8, "a rod's bundle must be shaded across");
    assert.ok(spread(collars) > 2, "a collar's rings must be shaded round");
    const near = (colour, expected) => colour.every((part, axis) => Math.abs(part - expected[axis]) < 1e-6);
    assert.ok(near(rods[0].stroke, [174.93, 94.605, 66.045]), "the accent's first hairline is copper at the lights");
    assert.ok(near(rods[7].stroke, [219.555, 217.77, 210.63]), "the rod's first hairline is silver at the lights");
    assert.ok(near(collars[0].stroke, [194.255461, 157.25442, 89.41918]), "the collar's first segment is gold at the lights");
    // And the register is the collection's literals, by name.
    const source = readFileSync(SKETCH_URL, "utf8");
    for (const literal of ["const GROUND = [6, 7, 12];", "const ROD = [246, 244, 236];", "const ACCENT = [196, 106, 74];", "const COLLAR = [252, 204, 116];",
      "const ROD_LINES = 5;", "const ACCENT_LINES = 7;", "const COLLAR_RINGS = 4;"]) {
      assert.ok(source.includes(literal), `${literal} must be the register`);
    }

    const state = await window.__renderFrame(180);
    assert.equal(state.kind, "video");
    assert.equal(state.frameIndex, 180);
    assert.equal(state.totalFrames, 360);
    assert.equal(state.durationSeconds, 12);
    assert.equal(state.twist, MAX_TWIST);
    assert.ok(Math.abs(state.height - FULL_HEIGHT) < 1e-15);
    assert.ok(Math.abs(state.waist - WAIST) < 1e-15);
    assert.equal(state.rods, 36);
    assert.equal(state.palette, "three metals");
    assert.deepEqual(state.outputSize, { width: 1920, height: 1280 });
    assert.ok(Math.abs(record.rotateY[0] - (0.35 + TURNTABLE / 2)) < 1e-15);

    const opening = await window.__renderFrame(0);
    assert.deepEqual({ ...await window.__renderFrame(360), frameIndex: 0 }, opening);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

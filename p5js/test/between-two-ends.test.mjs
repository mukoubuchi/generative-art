import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  DURATION_SECONDS,
  LARGE_RADIUS,
  LOCAL_TURNS,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  RADIUS_RATIO,
  TOTAL_FRAMES,
  exactPoint,
  mechanismAtUnit,
  rotationCounts,
  sceneAt,
  unitAtFrame
} from "../artworks/between-two-ends/between-two-ends.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/between-two-ends/sketch.js", import.meta.url);

test("the two circles keep the historical ratio and opposite relative speed", () => {
  assert.equal(RADIUS_RATIO, 2);
  assert.equal(LOCAL_TURNS, -2);
  assert.equal(LARGE_RADIUS, 240);
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 10);
  assert.equal(TOTAL_FRAMES, 300);
});

test("twelve non-axial rational phases have integer-exact zero height", () => {
  for (const [a, b, d] of [[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n]]) {
    for (const sx of [1n, -1n]) {
      for (const sy of [1n, -1n]) {
        const point = exactPoint(sx * a, sy * b, d);
        assert.equal(point.numerator[1], 0n);
        // Independent conjugate identity: the horizontal coordinate is 2a/d.
        assert.equal(point.numerator[0] * d, 2n * sx * a * point.denominator);
        const drawn = mechanismAtUnit([Number(sx * a) / Number(d), Number(sy * b) / Number(d)]);
        assert.equal(drawn.materialPoint[1], 0);
        assert.ok(Math.abs(drawn.materialPoint[0] - LARGE_RADIUS * Number(sx * a) / Number(d)) < 1e-12);
      }
    }
  }
});

// These controls are synthetic departures from the theorem, not frozen code defects.
test("changing exactly one condition at the same rational phase breaks the line", () => {
  const cases = [
    [{}, [150n, 0n]],
    [{ radiusRatio: 3n }, [225n, 100n]],
    [{ localTurns: 2 }, [-42n, 144n]],
    [{ localTurns: -1 }, [200n, 100n]]
  ];
  for (const [conditions, expected] of cases) {
    const point = exactPoint(3n, 4n, 5n, conditions);
    const scale = 125n / point.denominator;
    assert.equal(125n % point.denominator, 0n);
    assert.deepEqual(point.numerator.map((coordinate) => coordinate * scale), expected);
    const numericConditions = { ...conditions };
    if ("radiusRatio" in conditions) numericConditions.radiusRatio = Number(conditions.radiusRatio);
    const drawn = mechanismAtUnit([3 / 5, 4 / 5], numericConditions);
    const smallRadius = LARGE_RADIUS / (numericConditions.radiusRatio ?? 2);
    for (let axis = 0; axis < 2; axis += 1) {
      assert.ok(Math.abs(drawn.materialPoint[axis] - smallRadius * Number(expected[axis]) / 125) < 1e-12);
    }
    if (expected[1] !== 0n) assert.notEqual(drawn.materialPoint[1], 0);
  }
});

test("one carrier revolution means two backwards relative turns and one backwards world turn", () => {
  assert.deepEqual(rotationCounts(300), { carrier: 300, local: -600, world: -300, denominator: 300 });
  for (let frame = 0; frame < 300; frame += 1) {
    const first = rotationCounts(frame);
    const next = rotationCounts(frame + 1);
    assert.equal(next.carrier - first.carrier, 1);
    assert.equal(next.local - first.local, -2);
    assert.equal(next.world - first.world, -1);
  }
});

test("the computed radius vectors really wind once and twice, independently of reported turn counts", () => {
  // Count oriented crossings of a ray by the actual geometric vectors. Reading
  // rotationCounts alone would only check metadata against the same constants.
  function winding(vectors) {
    let turns = 0;
    for (let index = 1; index < vectors.length; index += 1) {
      const [ax, ay] = vectors[index - 1];
      const [bx, by] = vectors[index];
      const cross = ax * by - ay * bx;
      if (ay <= 0 && by > 0 && cross > 0) turns += 1;
      if (ay > 0 && by <= 0 && cross < 0) turns -= 1;
    }
    return turns;
  }
  const carriers = [];
  const worldRadii = [];
  const localRadii = [];
  for (let frame = 0; frame <= 300; frame += 1) {
    const scene = sceneAt(frame);
    const [cx, cy] = scene.smallCenter;
    const [px, py] = scene.materialPoint;
    const [vx, vy] = [px - cx, py - cy];
    carriers.push([cx, cy]);
    worldRadii.push([vx, vy]);
    // Rotate back by the observed carrier vector, retaining a positive scale.
    localRadii.push([vx * cx + vy * cy, -vx * cy + vy * cx]);
  }
  assert.equal(winding(carriers), 1);
  assert.equal(winding(worldRadii), -1);
  assert.equal(winding(localRadii), -2);
});

test("the material point reaches both diameter ends and reverses there", () => {
  for (const direction of [1n, -1n]) {
    const point = exactPoint(direction, 0n, 1n);
    assert.equal(point.numerator[0], 2n * direction * point.denominator);
    assert.equal(point.numerator[1], 0n);
  }
  assert.deepEqual(sceneAt(0).materialPoint, [240, 0]);
  assert.deepEqual(sceneAt(150).materialPoint, [-240, 0]);
  assert.equal(sceneAt(75).materialPoint[0], 0);
  assert.equal(sceneAt(225).materialPoint[0], 0);
  for (let frame = 1; frame <= 150; frame += 1) {
    assert.ok(sceneAt(frame).materialPoint[0] < sceneAt(frame - 1).materialPoint[0]);
  }
  for (let frame = 151; frame <= 300; frame += 1) {
    assert.ok(sceneAt(frame).materialPoint[0] > sceneAt(frame - 1).materialPoint[0]);
  }
  assert.ok(sceneAt(-1).materialPoint[0] < sceneAt(0).materialPoint[0]);
  assert.ok(sceneAt(1).materialPoint[0] < sceneAt(0).materialPoint[0]);
});

test("every displayed phase keeps internal tangency and the point on the small circumference", () => {
  for (let frame = 0; frame <= 300; frame += 1) {
    const scene = sceneAt(frame);
    const [cx, cy] = scene.smallCenter;
    const [px, py] = scene.materialPoint;
    const [tx, ty] = scene.tangentPoint;
    assert.equal(scene.largeRadius, 240);
    assert.equal(scene.smallRadius, 120);
    assert.equal(py, 0);
    // These distances measure floating-point render coordinates, not the exact theorem.
    assert.ok(Math.abs(Math.hypot(cx, cy) - 120) < 1e-12);
    assert.ok(Math.abs(Math.hypot(tx, ty) - 240) < 1e-12);
    assert.ok(Math.abs(Math.hypot(tx - cx, ty - cy) - 120) < 1e-12);
    assert.ok(Math.abs(Math.hypot(px - cx, py - cy) - 120) < 1e-12);
  }
});

test("frames are pure, seekable, and exactly periodic without an extra terminal frame", () => {
  const forward = Array.from({ length: 300 }, (_, frame) => sceneAt(frame));
  for (let frame = 299; frame >= 0; frame -= 1) {
    assert.deepEqual(sceneAt(frame), forward[frame]);
    assert.deepEqual(sceneAt(frame + 300), forward[frame]);
    assert.deepEqual(sceneAt(frame - 300), forward[frame]);
  }
  assert.deepEqual(sceneAt(300), sceneAt(0));
  assert.notDeepEqual(sceneAt(299), sceneAt(0));
  const altered = sceneAt(42);
  altered.materialPoint[0] = Infinity;
  assert.deepEqual(sceneAt(42), forward[42]);
  assert.deepEqual(unitAtFrame(0), [1, 0]);
  assert.deepEqual(unitAtFrame(75), [0, 1]);
  assert.deepEqual(unitAtFrame(150), [-1, 0]);
  assert.deepEqual(unitAtFrame(225), [0, -1]);
});

test("invalid frame and rational inputs fail explicitly", () => {
  for (const frame of [NaN, Infinity, 0.5, "30", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => sceneAt(frame), TypeError);
    assert.throws(() => rotationCounts(frame), TypeError);
  }
  assert.throws(() => exactPoint(3, 4, 5), TypeError);
  assert.throws(() => exactPoint(3n, 4n, 6n), RangeError);
  assert.throws(() => exactPoint(3n, 4n, -5n), RangeError);
  assert.throws(() => exactPoint(3n, 4n, 5n, { radiusRatio: 1n }), RangeError);
  assert.throws(() => exactPoint(3n, 4n, 5n, { localTurns: -1.5 }), RangeError);
  assert.throws(() => mechanismAtUnit([1, 0], { radiusRatio: 1 }), RangeError);
});

test("the catalog preserves the corrected Arabic letters and the work's Arabic locus", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "tusi-mutaraddida");
  const approved = "تلك النقطة متحركة على قطر الدايرة الكبيرة المار بنقطة التماس اولا مترددة بين طرفيه";
  assert.equal(quote.text, approved);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 82);
  assert.deepEqual([...quote.text.split(" ")[10]].map((letter) => letter.codePointAt(0)), [0x0627, 0x0648, 0x0644, 0x0627]);
  assert.equal(quote.lang, "ar");
  assert.equal(quote.author, "نصير الدين الطوسي");
  assert.equal(quote.source, "التذكرة في علم الهيئة، الباب الثاني، الفصل الحادي عشر");
  assert.equal(quote.year, null);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://www.qdl.qa/en/archive/81055/vdc_100023489696.0x00004a");
  assert.equal(CATALOG.quotes.filter((entry) => entry.lang === "ar").length, 2);
});

test("the manifest, notes, card, and post agree on the clip and quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "between-two-ends");
  const quote = CATALOG.quotes.find((entry) => entry.id === "tusi-mutaraddida");
  assert.equal(artwork.title, "Between Two Ends");
  assert.equal(artwork.entry, "p5js/artworks/between-two-ends/index.html");
  assert.equal(artwork.interactivePath, "between-two-ends/");
  assert.deepEqual(artwork.canvas, { width: 680, height: 680 });
  assert.deepEqual(artwork.quoteIds, ["tusi-mutaraddida"]);
  assert.deepEqual(artwork.thumbnail, { frame: 38 });
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/BetweenTwoEnds.mp4", durationSeconds: 10, scale: 2
  });
  assert.match(NOTES, /\| `between-two-ends` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 10 seconds,/u);
  assert.match(NOTES, /`الدايرة\] A : الدائرة B`/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 198);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Between Two Ends</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="ar">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
});

test("capture draws only two circumferences, one diameter, and their material point", async () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  assert.doesNotMatch(source, /UMBER|ACCENT_TARGET/u);
  const priorWindow = globalThis.window;
  const calls = { circles: [], lines: [], scale: [], density: [], frameRate: [] };
  const noop = () => {};
  class RecordingP5 {
    constructor(define) {
      const p = {
        createCanvas: (width, height) => { calls.canvas = [width, height]; return { parent: noop }; },
        background: (...colour) => {
          calls.background = colour;
          calls.circles = [];
          calls.lines = [];
          calls.strokes = [];
          calls.fills = [];
          calls.weights = [];
        },
        circle: (...args) => calls.circles.push(args),
        line: (...args) => calls.lines.push(args),
        scale: (value) => calls.scale.push(value),
        translate: (...value) => { calls.translate = value; },
        pixelDensity: (value) => calls.density.push(value),
        frameRate: (value) => calls.frameRate.push(value),
        push: noop, pop: noop, noFill: noop, noStroke: noop,
        stroke: (...colour) => calls.strokes.push(colour),
        strokeWeight: (weight) => calls.weights.push(weight),
        fill: (...colour) => calls.fills.push(colour),
        noLoop: noop
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
    assert.deepEqual(calls.background, [230, 224, 208]);
    assert.deepEqual(calls.translate, [340, 340]);
    const state = await window.__renderFrame(38);
    const scene = sceneAt(38);
    assert.deepEqual(calls.lines, [[-240, 0, 240, 0]]);
    assert.deepEqual(calls.circles, [[0, 0, 480], [...scene.smallCenter, 240], [...scene.materialPoint, 8]]);
    assert.deepEqual(calls.strokes, [[38, 34, 40, 100], [38, 34, 40, 230], [38, 34, 40, 230]]);
    assert.deepEqual(calls.fills, [[38, 34, 40]]);
    assert.deepEqual(calls.weights, [0.7, 1.4, 1.7]);
    assert.ok(calls.scale.every((value) => value === 2));
    assert.equal(state.kind, "video");
    assert.equal(state.frameIndex, 38);
    assert.equal(state.totalFrames, 300);
    assert.equal(state.durationSeconds, 10);
    assert.equal(state.palette, "ink");
    assert.deepEqual(state.outputSize, { width: 1360, height: 1360 });
    assert.deepEqual(state.materialPoint, scene.materialPoint);
    assert.deepEqual(await window.__renderFrame(300), await window.__renderFrame(0));
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

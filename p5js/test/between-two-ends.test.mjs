import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  COUPLE_COUNT,
  DIAMETER_ANGLES,
  DURATION_SECONDS,
  LARGE_RADIUS,
  LOCAL_TURNS,
  LOGICAL_SIZE,
  NESTED_GEAR,
  NESTED_POINT_COUNT,
  PLAYBACK_FPS,
  RADIUS_RATIO,
  TOTAL_FRAMES,
  astroidResidue,
  exactNestedPoint,
  exactPoint,
  isExactlyZero,
  mechanismAtUnit,
  nestedAtUnit,
  nestedTrace,
  rotationCounts,
  sceneAt,
  unitAtFrame
} from "../artworks/between-two-ends/between-two-ends.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/between-two-ends/sketch.js", import.meta.url);

/** Pythagorean unit points: the phases where the arithmetic can be exact. */
const RATIONAL_PHASES = [[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n], [20n, 21n, 29n], [7n, 24n, 25n]];

function signedPhases(triples = RATIONAL_PHASES) {
  const phases = [];
  for (const [a, b, d] of triples) {
    for (const alongSign of [1n, -1n]) {
      for (const acrossSign of [1n, -1n]) phases.push([alongSign * a, acrossSign * b, d]);
    }
  }
  return phases;
}

/** A quarter turn on an exact surd point, by exchange and negation only. */
function turnExactQuarter({ x, y, denominator }, quarters) {
  const turns = ((quarters % 4) + 4) % 4;
  const negate = ([rational, root]) => [-rational, -root];
  if (turns === 1) return { x: negate(y), y: x, denominator };
  if (turns === 2) return { x: negate(x), y: negate(y), denominator };
  if (turns === 3) return { x: y, y: negate(x), denominator };
  return { x, y, denominator };
}

test("the two circles keep the historical ratio and opposite relative speed", () => {
  assert.equal(RADIUS_RATIO, 2);
  assert.equal(LOCAL_TURNS, -2);
  assert.equal(LARGE_RADIUS, 240);
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 10);
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(NESTED_GEAR, 2);
  assert.equal(COUPLE_COUNT, 4);
  assert.equal(NESTED_POINT_COUNT, 3);
});

test("twelve non-axial rational phases have integer-exact zero height", () => {
  for (const [a, b, d] of signedPhases([[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n]])) {
    const point = exactPoint(a, b, d);
    assert.equal(point.numerator[1], 0n);
    // Independent conjugate identity: the horizontal coordinate is 2a/d.
    assert.equal(point.numerator[0] * d, 2n * a * point.denominator);
    const drawn = mechanismAtUnit([Number(a) / Number(d), Number(b) / Number(d)]);
    assert.equal(drawn.materialPoint[1], 0);
    assert.ok(Math.abs(drawn.materialPoint[0] - LARGE_RADIUS * Number(a) / Number(d)) < 1e-12);
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
  const nestedRadii = [];
  for (let frame = 0; frame <= 300; frame += 1) {
    const couple = sceneAt(frame).couples[0];
    const [cx, cy] = couple.smallCenter;
    const [px, py] = couple.materialPoint;
    const [vx, vy] = [px - cx, py - cy];
    carriers.push([cx, cy]);
    worldRadii.push([vx, vy]);
    // Rotate back by the observed carrier vector, retaining a positive scale.
    localRadii.push([vx * cx + vy * cy, -vx * cy + vy * cx]);
    // The nested centre seen from the small circle's own centre.
    nestedRadii.push([couple.nestedCenter[0] - cx, couple.nestedCenter[1] - cy]);
  }
  assert.equal(winding(carriers), 1);
  assert.equal(winding(worldRadii), -1);
  assert.equal(winding(localRadii), -2);
  // The nested carrier is the parent's frame turned by the gear: -1 + 2 = +1.
  assert.equal(winding(nestedRadii), 1);
});

test("the material point reaches both diameter ends and reverses there", () => {
  for (const direction of [1n, -1n]) {
    const point = exactPoint(direction, 0n, 1n);
    assert.equal(point.numerator[0], 2n * direction * point.denominator);
    assert.equal(point.numerator[1], 0n);
  }
  const first = (frame) => sceneAt(frame).couples[0].materialPoint;
  assert.deepEqual(first(0), [240, 0]);
  assert.deepEqual(first(150), [-240, 0]);
  assert.equal(first(75)[0], 0);
  assert.equal(first(225)[0], 0);
  for (let frame = 1; frame <= 150; frame += 1) {
    assert.ok(first(frame)[0] < first(frame - 1)[0]);
  }
  for (let frame = 151; frame <= 300; frame += 1) {
    assert.ok(first(frame)[0] > first(frame - 1)[0]);
  }
});

test("every displayed phase keeps both couples internally tangent and both points on their circumferences", () => {
  for (let frame = 0; frame <= 300; frame += 1) {
    for (const couple of sceneAt(frame).couples) {
      const centreDistance = Math.hypot(...couple.smallCenter);
      assert.ok(Math.abs(centreDistance - (LARGE_RADIUS - couple.smallRadius)) < 1e-9);
      const onSmall = Math.hypot(
        couple.materialPoint[0] - couple.smallCenter[0],
        couple.materialPoint[1] - couple.smallCenter[1]
      );
      assert.ok(Math.abs(onSmall - couple.smallRadius) < 1e-9);
      // The nested circle sits inside the small one, touching it.
      const nestedDistance = Math.hypot(
        couple.nestedCenter[0] - couple.smallCenter[0],
        couple.nestedCenter[1] - couple.smallCenter[1]
      );
      assert.ok(Math.abs(nestedDistance - (couple.smallRadius - couple.nestedRadius)) < 1e-9);
      for (const point of couple.nestedPoints) {
        const onNested = Math.hypot(
          point[0] - couple.nestedCenter[0],
          point[1] - couple.nestedCenter[1]
        );
        assert.ok(Math.abs(onNested - couple.nestedRadius) < 1e-9);
      }
    }
  }
});

test("the four couples are one figure turned by quarters, and their points make a square", () => {
  for (let frame = 0; frame <= 300; frame += 1) {
    const { couples } = sceneAt(frame);
    assert.equal(couples.length, 4);
    const [along] = couples[0].materialPoint;
    // Compared coordinate by coordinate: a negated zero is the same number
    // here, and a deep comparison would call it a different one.
    // Adding zero folds a negated zero back onto zero; strict equality here
    // uses Object.is, which would otherwise call them different numbers.
    const samePoint = (actual, expected) => {
      assert.equal(actual[0] + 0, expected[0] + 0);
      assert.equal(actual[1] + 0, expected[1] + 0);
    };
    // Exactly on the two diameters, and exactly a square about the centre.
    samePoint(couples[0].materialPoint, [along, 0]);
    samePoint(couples[1].materialPoint, [0, along]);
    samePoint(couples[2].materialPoint, [-along, 0]);
    samePoint(couples[3].materialPoint, [0, -along]);
    for (let copy = 1; copy < 4; copy += 1) {
      for (let index = 0; index < NESTED_POINT_COUNT; index += 1) {
        const [x, y] = couples[0].nestedPoints[index];
        samePoint(couples[copy].nestedPoints[index], [[-y, x], [-x, -y], [y, -x]][copy - 1]);
      }
    }
  }
});

test("the nested point of the first couple is exactly on the astroid, and the gear decides it", () => {
  for (const [a, b, d] of signedPhases([[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n]])) {
    const point = exactNestedPoint(a, b, d);
    // Rational, with nothing under the root: this point needs no surd at all.
    assert.equal(point.x[1], 0n);
    assert.equal(point.y[1], 0n);
    // x * d^3 = 2r * a^3 and y * d^3 = 2r * b^3, with 2r the large radius.
    assert.equal(point.x[0] * d ** 3n, BigInt(LARGE_RADIUS) * a ** 3n * point.denominator);
    assert.equal(point.y[0] * d ** 3n, BigInt(LARGE_RADIUS) * b ** 3n * point.denominator);
  }
  // A different gear is a different curve: two cusps at one, none at three.
  for (const gear of [1, 3]) {
    const point = exactNestedPoint(3n, 4n, 5n, { gear });
    assert.notEqual(
      point.x[0] * 125n === BigInt(LARGE_RADIUS) * 27n * point.denominator
        && point.y[0] * 125n === BigInt(LARGE_RADIUS) * 64n * point.denominator,
      true
    );
    assert.ok(!isExactlyZero(astroidResidue(point, 0)));
  }
});

test("all three standing curves are the same astroid turned, exactly rather than to a tolerance", () => {
  // The three points sit a third of the nested circumference apart, so the
  // turns are 0, 30 and 60 degrees and every cosine involved is rational or a
  // rational multiple of root three. Turning each point back by its own angle
  // must land it on the base astroid with an exactly vanishing residue.
  let checks = 0;
  for (const [a, b, d] of signedPhases()) {
    for (let index = 0; index < NESTED_POINT_COUNT; index += 1) {
      const point = exactNestedPoint(a, b, d, { pointIndex: index });
      assert.ok(isExactlyZero(astroidResidue(point, index)));
      // A quarter turn carries an astroid onto itself, so the other three
      // couples run these same three curves rather than nine more.
      for (let copy = 1; copy < COUPLE_COUNT; copy += 1) {
        assert.ok(isExactlyZero(astroidResidue(turnExactQuarter(point, copy), index)));
      }
      checks += COUPLE_COUNT;
    }
  }
  assert.equal(checks, 20 * NESTED_POINT_COUNT * COUPLE_COUNT);
  // Without the turn back, only the untouched curve satisfies the equation.
  assert.ok(!isExactlyZero(astroidResidue(exactNestedPoint(3n, 4n, 5n, { pointIndex: 1 }), 0)));
  assert.ok(!isExactlyZero(astroidResidue(exactNestedPoint(3n, 4n, 5n, { pointIndex: 2 }), 0)));
});

test("the plate lays down no line and no curve twice", () => {
  // Four couples give four diameter directions and four times three carried
  // points, but a line is its own half turn and an astroid its own quarter,
  // so what the plate actually holds is two lines and three curves.
  assert.deepEqual(DIAMETER_ANGLES, [0, Math.PI / 2]);
  const folded = new Set();
  for (let copy = 0; copy < COUPLE_COUNT; copy += 1) {
    folded.add(((copy * Math.PI / 2) % Math.PI).toFixed(9));
  }
  assert.equal(folded.size, DIAMETER_ANGLES.length);
  const traces = Array.from({ length: NESTED_POINT_COUNT }, (unused, index) => nestedTrace(index));
  assert.equal(traces.length, 3);
  for (const path of traces) assert.equal(path.length, TOTAL_FRAMES + 1);
  // The three are genuinely different curves: each has a point the others miss.
  const nearest = (point, path) => Math.min(...path.map(
    ([x, y]) => Math.hypot(point[0] - x, point[1] - y)
  ));
  for (let first = 0; first < traces.length; first += 1) {
    for (let second = 0; second < traces.length; second += 1) {
      const worst = Math.max(...traces[first].map((point) => nearest(point, traces[second])));
      if (first === second) assert.equal(worst, 0);
      else assert.ok(worst > 1, `curves ${first} and ${second} should not coincide`);
    }
  }
});

test("each carried point stays on its own standing curve at every displayed phase", () => {
  const traces = Array.from({ length: NESTED_POINT_COUNT }, (unused, index) => nestedTrace(index));
  for (let frame = 0; frame <= TOTAL_FRAMES; frame += 1) {
    const { couples } = sceneAt(frame);
    for (let index = 0; index < NESTED_POINT_COUNT; index += 1) {
      // The curve is sampled from the same phases the picture shows, so the
      // first couple's point is the vertex itself rather than near it.
      assert.deepEqual(couples[0].nestedPoints[index], traces[index][frame % TOTAL_FRAMES]);
    }
  }
});

test("frames are pure, seekable, and exactly periodic without an extra terminal frame", () => {
  assert.deepEqual(sceneAt(38), sceneAt(38));
  assert.deepEqual(sceneAt(300), sceneAt(0));
  assert.deepEqual(sceneAt(-1), sceneAt(299));
  assert.equal(sceneAt(301).frameIndex, 1);
  const forwards = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) forwards.push(sceneAt(frame));
  for (let frame = TOTAL_FRAMES - 1; frame >= 0; frame -= 1) {
    assert.deepEqual(sceneAt(frame), forwards[frame]);
  }
});

test("invalid frame and rational inputs fail explicitly", () => {
  assert.throws(() => sceneAt(1.5), TypeError);
  assert.throws(() => sceneAt(Number.NaN), TypeError);
  assert.throws(() => unitAtFrame(2 ** 60), TypeError);
  assert.throws(() => exactPoint(3, 4, 5), TypeError);
  assert.throws(() => exactPoint(3n, 4n, 6n), RangeError);
  assert.throws(() => exactNestedPoint(3n, 4n, 6n), RangeError);
  assert.throws(() => exactNestedPoint(3n, 4n, 5n, { pointIndex: 3 }), RangeError);
  assert.throws(() => nestedAtUnit([1, 0], { pointIndex: 5 }), RangeError);
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

test("the notes separate the sentence's own mechanism from this project's construction", () => {
  const section = NOTES.slice(NOTES.indexOf("Between Two Ends starts from"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  // The extension is named as an extension, and not attributed to anyone.
  assert.match(section, /None of them is in the manuscript, and none is attributed to it\./u);
  assert.doesNotMatch(
    section.slice(0, section.indexOf("## Install")),
    /al-Tusi (?:drew|knew)|Copernicus (?:drew|knew)/u
  );
  assert.match(NOTES, /`الدايرة\] A : الدائرة B`/u);
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

test("the sketch's whole drawing vocabulary is circles and lines", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), [
    "background", "circle", "createCanvas", "fill", "frameRate", "line", "noFill",
    "noLoop", "noStroke", "pixelDensity", "pop", "push", "scale", "stroke",
    "strokeWeight", "translate"
  ]);
  // No letter, numeral or arrow can reach the plate, at any phase, because
  // nothing that could draw one is ever called.
  for (const forbidden of ["text", "arc", "vertex", "rect", "triangle", "image", "quad"]) {
    assert.ok(!called.has(forbidden), `${forbidden} must not be drawn`);
  }
  assert.doesNotMatch(source, /UMBER|ACCENT_TARGET/u);
});

test("capture draws the two lines, three curves, nine circumferences and sixteen points", async () => {
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

    // Two diameters, then the three standing curves as polylines.
    assert.equal(calls.lines.length, 2 + 3 * TOTAL_FRAMES);
    assert.deepEqual(calls.lines[0], [-240, -0, 240, 0]);
    assert.deepEqual(calls.lines[1].map((value) => Math.round(value)), [-0, -240, 0, 240]);

    // One large circumference, then a small and a nested one per couple, then
    // one point for each couple and three more for each nested couple.
    assert.equal(calls.circles.length, 1 + 2 * COUPLE_COUNT + COUPLE_COUNT * (1 + NESTED_POINT_COUNT));
    assert.deepEqual(calls.circles[0], [0, 0, 480]);
    assert.deepEqual(calls.circles[1], [...scene.couples[0].smallCenter, 240]);
    assert.deepEqual(calls.circles[2], [...scene.couples[0].nestedCenter, 120]);
    for (let index = 0; index < COUPLE_COUNT * (1 + NESTED_POINT_COUNT); index += 1) {
      assert.equal(calls.circles[9 + index][2], 8);
    }

    assert.deepEqual(calls.strokes, [
      [38, 34, 40, 100], [38, 34, 40, 230],
      ...Array.from({ length: COUPLE_COUNT }, () => [[38, 34, 40, 230], [38, 34, 40, 170]]).flat()
    ]);
    assert.deepEqual(calls.fills, [[38, 34, 40]]);
    assert.deepEqual(calls.weights, [0.7, 1.4, ...Array.from({ length: 2 * COUPLE_COUNT }, () => 1.7)]);
    assert.ok(calls.scale.every((value) => value === 2));

    assert.equal(state.kind, "video");
    assert.equal(state.frameIndex, 38);
    assert.equal(state.totalFrames, 300);
    assert.equal(state.durationSeconds, 10);
    assert.equal(state.palette, "ink");
    assert.equal(state.couples, 4);
    assert.equal(state.nestedPointsPerCouple, 3);
    assert.equal(state.diameters, 2);
    assert.equal(state.traces, 3);
    assert.deepEqual(state.outputSize, { width: 1360, height: 1360 });
    assert.deepEqual(state.materialPoints, scene.couples.map((couple) => couple.materialPoint));
    assert.deepEqual(await window.__renderFrame(300), await window.__renderFrame(0));
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

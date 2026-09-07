import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  DURATION_SECONDS,
  EYE_HEIGHT,
  FAR_DISTANCE,
  FAR_EYE,
  FIELD_CONSTANT,
  FLOOR_COUNT,
  FLOOR_HEIGHTS,
  FLOOR_SPACING,
  LANE_HEIGHT,
  LANE_INSET,
  LOGICAL_SIZE,
  LOOK_AT,
  NEAR_DISTANCE,
  NEAR_EYE,
  NEAR_FIELD_OF_VIEW,
  PLAYBACK_FPS,
  RADIUS,
  REST_FAR_CLOSING,
  REST_FAR_OPENING,
  REST_NEAR,
  RIM_SEGMENTS,
  STAGE_SCALE,
  TOTAL_FRAMES,
  TOWER_MIDDLE,
  WALK_IN,
  WALK_LAW,
  WALK_LAWS,
  WALK_OUT,
  cornerEnds,
  distanceAtLever,
  exactEye,
  exactFloor,
  exactNominalPoints,
  exactRimPoint,
  exactlyOnRay,
  eyeAt,
  fieldOfView,
  leverAtFrame,
  leverFromPointer,
  pointerAtLever,
  rimAt,
  rimPoint,
  rimShare,
  sceneAt,
  sceneAtLever,
  verticals
} from "../artworks/the-same-tower/the-same-tower.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/the-same-tower/sketch.js", import.meta.url);

/** Rational unit points: the phases where the arithmetic can be exact. */
const RATIONAL_POINTS = [[3n, 4n, 5n], [5n, 12n, 13n], [8n, 15n, 17n], [20n, 21n, 29n], [7n, 24n, 25n]];

function signedPoints(triples = RATIONAL_POINTS) {
  const points = [];
  for (const [a, b, d] of triples) {
    for (const acrossSign of [1n, -1n]) {
      for (const depthSign of [1n, -1n]) points.push([acrossSign * a, depthSign * b, d]);
    }
  }
  return points;
}

/** The side of the square a circle point answers to: the one on its own side of the eyes. */
function sideOf(b) {
  return b < 0n ? -1n : 1n;
}

const EXACT_FLOORS = [0, 1.5, 3.5].map(exactFloor);

function sameFraction(left, right) {
  return left.value * right.denominator === right.value * left.denominator;
}

function coordinate(point, axis) {
  return { value: point.numerator[axis], denominator: point.denominator };
}

function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Distance of `point` from the line through `eye` and `target`, in tower units. */
function offLine(point, eye, target) {
  const along = subtract(target, eye);
  const [x, y, z] = cross(subtract(point, eye), along);
  return Math.hypot(x, y, z) / Math.hypot(...along);
}

test("the two eyes, the tower and the clip keep their numbers", () => {
  assert.equal(EYE_HEIGHT, 3);
  assert.equal(FAR_DISTANCE, 12);
  assert.equal(NEAR_DISTANCE, 4);
  assert.equal(RADIUS, 1);
  assert.equal(FLOOR_COUNT, 8);
  assert.equal(FLOOR_SPACING, 0.5);
  assert.deepEqual(FLOOR_HEIGHTS, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  assert.equal(TOWER_MIDDLE, 1.75);
  assert.equal(RIM_SEGMENTS, 360);
  assert.equal(STAGE_SCALE, 100);
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 10);
  assert.equal(TOTAL_FRAMES, 300);
  assert.deepEqual(FAR_EYE, [0, -12, 3]);
  assert.deepEqual(NEAR_EYE, [0, -4, 3]);
  assert.deepEqual(LOOK_AT, [0, 0, 1.75]);
  assert.equal(REST_FAR_OPENING + WALK_IN + REST_NEAR + WALK_OUT + REST_FAR_CLOSING, TOTAL_FRAMES);
  assert.deepEqual([REST_FAR_OPENING, WALK_IN, REST_NEAR, WALK_OUT, REST_FAR_CLOSING], [15, 120, 30, 120, 15]);
  assert.deepEqual(WALK_LAWS, ["reciprocal", "linear"]);
  assert.equal(WALK_LAW, "reciprocal");
  assert.equal(LANE_INSET, 0.08);
  assert.equal(LANE_HEIGHT, 0.955);
});

test("at forty rational points on three floors the rim point is on both rays, as an integer identity", () => {
  let checks = 0;
  for (const floor of EXACT_FLOORS) {
    for (const [a, b, d] of signedPoints()) {
      const side = sideOf(b);
      const point = exactRimPoint(a, b, d, side, floor);
      const { circle, square } = exactNominalPoints(a, b, d, side, floor);
      assert.ok(exactlyOnRay(point, exactEye(FAR_DISTANCE), circle));
      assert.ok(exactlyOnRay(point, exactEye(NEAR_DISTANCE), square));
      // The circle and the square are apart here, so the point is off the floor's plane.
      assert.notEqual(point.share.numerator, point.share.denominator);
      assert.ok(!sameFraction(coordinate(point, 2), { value: floor.numerator, denominator: floor.denominator }));
      checks += 1;
    }
  }
  assert.equal(checks, 3 * 20);
});

test("the footprint is one curve for every floor, and the floors stand in order on it", () => {
  for (const [a, b, d] of signedPoints()) {
    const side = sideOf(b);
    const ground = exactRimPoint(a, b, d, side, EXACT_FLOORS[0]);
    let previousHeight = null;
    for (const floor of EXACT_FLOORS) {
      const point = exactRimPoint(a, b, d, side, floor);
      assert.ok(sameFraction(coordinate(point, 0), coordinate(ground, 0)));
      assert.ok(sameFraction(coordinate(point, 1), coordinate(ground, 1)));
      const height = coordinate(point, 2);
      if (previousHeight) {
        // Higher floor, higher point: the share is positive.
        assert.ok(height.value * previousHeight.denominator > previousHeight.value * height.denominator);
      }
      previousHeight = height;
    }
  }
});

test("each corner is a straight run along the far ray between the near rays to the side's ends", () => {
  for (const floor of EXACT_FLOORS) {
    for (const sign of [1n, -1n]) {
      const ends = [-1n, 1n].map((side) => exactRimPoint(sign, 0n, 1n, side, floor));
      const { circle } = exactNominalPoints(sign, 0n, 1n, 1n, floor);
      for (const [index, side] of [-1n, 1n].entries()) {
        const { square } = exactNominalPoints(sign, 0n, 1n, side, floor);
        assert.ok(exactlyOnRay(ends[index], exactEye(FAR_DISTANCE), circle));
        assert.ok(exactlyOnRay(ends[index], exactEye(NEAR_DISTANCE), square));
      }
      // Both ends on one line through the eye, so the segment between them is on it too.
      const midpoint = {
        numerator: ends[0].numerator.map((part, axis) => (
          part * ends[1].denominator + ends[1].numerator[axis] * ends[0].denominator
        )),
        denominator: 2n * ends[0].denominator * ends[1].denominator
      };
      assert.ok(exactlyOnRay(midpoint, exactEye(FAR_DISTANCE), circle));
    }
  }
  // The numbers the notes give for the ground floor's right corner.
  const [front, back] = cornerEnds(1, 0);
  assert.deepEqual(front.map((value) => Math.round(value * 63)), [56, -84, 21]);
  assert.deepEqual(back.map((value) => Math.round(value * 63)), [72, 108, -27]);
});

test("where the circle touches the square the curve touches the floor", () => {
  for (const floor of EXACT_FLOORS) {
    const point = exactRimPoint(0n, -1n, 1n, -1n, floor);
    const { circle, square } = exactNominalPoints(0n, -1n, 1n, -1n, floor);
    assert.equal(point.share.numerator, point.share.denominator);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(sameFraction(coordinate(point, axis), coordinate(circle, axis)));
      assert.ok(sameFraction(coordinate(point, axis), coordinate(square, axis)));
    }
  }
  assert.equal(rimShare(-RADIUS, -RADIUS), 1);
});

// These controls are synthetic departures from the construction, not frozen code defects.
test("a third eye, a moved eye, or the wrong pairing puts the point on no ray", () => {
  const floor = EXACT_FLOORS[1];
  for (const [a, b, d] of signedPoints([[3n, 4n, 5n], [5n, 12n, 13n]])) {
    const side = sideOf(b);
    const point = exactRimPoint(a, b, d, side, floor);
    const { circle, square } = exactNominalPoints(a, b, d, side, floor);
    // Another station on the same line sees neither figure.
    for (const distance of [2, 7, 20]) {
      assert.ok(!exactlyOnRay(point, exactEye(distance), circle));
      assert.ok(!exactlyOnRay(point, exactEye(distance), square));
    }
    // The eyes off their line: across, or raised.
    assert.ok(!exactlyOnRay(point, { numerator: [1n, -12n, 3n], denominator: 1n }, circle));
    assert.ok(!exactlyOnRay(point, { numerator: [0n, -12n, 4n], denominator: 1n }, circle));
    assert.ok(!exactlyOnRay(point, { numerator: [1n, -4n, 3n], denominator: 1n }, square));
    assert.ok(!exactlyOnRay(point, { numerator: [0n, -4n, 4n], denominator: 1n }, square));
    // The right eyes, the wrong figures.
    assert.ok(!exactlyOnRay(point, exactEye(FAR_DISTANCE), square));
    assert.ok(!exactlyOnRay(point, exactEye(NEAR_DISTANCE), circle));
  }
});

test("every drawn floor is a closed polyline through its corners, and every sample is on both rays", () => {
  const half = RIM_SEGMENTS / 2;
  let checked = 0;
  for (const height of FLOOR_HEIGHTS) {
    const rim = rimAt(height);
    assert.equal(rim.length, RIM_SEGMENTS + 3);
    assert.deepEqual(rim[0], rim[rim.length - 1]);
    const [leftFront, leftBack] = cornerEnds(-1, height);
    const [rightFront, rightBack] = cornerEnds(1, height);
    assert.deepEqual([rim[0], rim[half], rim[half + 1], rim[RIM_SEGMENTS + 1]], [leftFront, rightFront, rightBack, leftBack]);
    for (let index = 0; index <= RIM_SEGMENTS + 1; index += 1) {
      const angle = Math.PI + 2 * Math.PI * (index <= half ? index : index - 1) / RIM_SEGMENTS;
      const isCorner = index === 0 || index === half || index === half + 1 || index === RIM_SEGMENTS + 1;
      const circlePoint = isCorner
        ? [index === 0 || index === RIM_SEGMENTS + 1 ? -RADIUS : RADIUS, 0, height]
        : [RADIUS * Math.cos(angle), RADIUS * Math.sin(angle), height];
      const side = index === 0 || index === half ? -RADIUS : index === half + 1 || index === RIM_SEGMENTS + 1 ? RADIUS : Math.sign(circlePoint[1]) * RADIUS;
      const squarePoint = [circlePoint[0], side, height];
      assert.ok(offLine(rim[index], FAR_EYE, circlePoint) < 1e-12, `floor ${height} sample ${index} off the far ray`);
      assert.ok(offLine(rim[index], NEAR_EYE, squarePoint) < 1e-12, `floor ${height} sample ${index} off the near ray`);
      checked += 1;
    }
  }
  assert.equal(checked, FLOOR_COUNT * (RIM_SEGMENTS + 2));
  assert.throws(() => rimAt(0, 7), RangeError);
  assert.throws(() => rimAt(0, 2), RangeError);
});

test("the floors never cross: at every sample they stand in order, on one footprint", () => {
  const rims = FLOOR_HEIGHTS.map((height) => rimAt(height));
  for (let index = 0; index < rims[0].length; index += 1) {
    for (let floor = 1; floor < FLOOR_COUNT; floor += 1) {
      const below = rims[floor - 1][index];
      const above = rims[floor][index];
      assert.ok(Math.abs(above[0] - below[0]) < 1e-12);
      assert.ok(Math.abs(above[1] - below[1]) < 1e-12);
      assert.ok(above[2] > below[2]);
    }
  }
  // The swing of a floor's height is proportional to its distance below the eyes, so it
  // turns over above them and vanishes at their height: the numbers the notes give.
  const swing = (height) => {
    const heights = rimAt(height).map((point) => point[2] - height);
    return [Math.max(...heights), Math.min(...heights)];
  };
  const [groundUp, groundDown] = swing(0);
  assert.ok(Math.abs(groundUp - 1 / 3) < 1e-12);
  assert.ok(Math.abs(groundDown + 3 / 7) < 1e-12);
  const [topUp, topDown] = swing(3.5);
  assert.ok(Math.abs(topUp - 1 / 14) < 1e-12);
  assert.ok(Math.abs(topDown + 1 / 18) < 1e-12);
  // The ground floor rises at its front and dips at its back; the top floor the other way.
  const [groundFront, groundBack] = cornerEnds(1, 0);
  const [topFront, topBack] = cornerEnds(1, 3.5);
  assert.ok(groundFront[2] > 0 && groundBack[2] < 0);
  assert.ok(topFront[2] < 3.5 && topBack[2] > 3.5);
  assert.deepEqual(swing(EYE_HEIGHT), [0, 0]);
  assert.ok(Math.abs(rimPoint(0, -RADIUS, -RADIUS, 0)[2]) < 1e-12);
});

test("the four hairlines are vertical, run the tower's whole height, and stand at the corner ends", () => {
  const lines = verticals();
  assert.equal(lines.length, 4);
  const lowest = FLOOR_HEIGHTS[0];
  const highest = FLOOR_HEIGHTS[FLOOR_COUNT - 1];
  const expected = [-1, 1].flatMap((sign) => {
    const low = cornerEnds(sign, lowest);
    const high = cornerEnds(sign, highest);
    return [[low[0], high[0]], [low[1], high[1]]];
  });
  assert.deepEqual(lines, expected);
  for (const [from, to] of lines) {
    assert.equal(from[0], to[0]);
    assert.equal(from[1], to[1]);
    assert.ok(to[2] > from[2]);
  }
  // From the far eye the two hairlines of one side lie on one ray: a cylinder has two
  // silhouette lines, not four.
  for (const sign of [-1, 1]) {
    const [front, back] = cornerEnds(sign, lowest);
    assert.ok(offLine(back, FAR_EYE, front) < 1e-12);
  }
});

test("the eye keeps the tower at one angular height: tan of half the field times the distance is constant", () => {
  assert.ok(Math.abs(NEAR_FIELD_OF_VIEW - 62 * Math.PI / 180) < 1e-15);
  assert.ok(Math.abs(fieldOfView(NEAR_DISTANCE) - NEAR_FIELD_OF_VIEW) < 1e-15);
  assert.ok(Math.abs(fieldOfView(FAR_DISTANCE) * 180 / Math.PI - 22.651472074083998) < 1e-12);
  let previous = Infinity;
  for (let step = 0; step <= 80; step += 1) {
    const distance = NEAR_DISTANCE + (FAR_DISTANCE - NEAR_DISTANCE) * step / 80;
    const field = fieldOfView(distance);
    assert.ok(Math.abs(Math.tan(field / 2) * distance - FIELD_CONSTANT) < 1e-14);
    assert.ok(field < previous);
    previous = field;
  }
  assert.throws(() => fieldOfView(0), RangeError);
  assert.throws(() => eyeAt(-1), RangeError);
  assert.deepEqual(eyeAt(7), [0, -7, EYE_HEIGHT]);
});

test("the walk rests at both stations exactly and closes on its first frame", () => {
  for (let frame = 0; frame < REST_FAR_OPENING; frame += 1) assert.equal(leverAtFrame(frame), 0);
  for (let frame = REST_FAR_OPENING + WALK_IN; frame < REST_FAR_OPENING + WALK_IN + REST_NEAR; frame += 1) {
    assert.equal(leverAtFrame(frame), 1);
  }
  for (let frame = TOTAL_FRAMES - REST_FAR_CLOSING; frame < TOTAL_FRAMES; frame += 1) assert.equal(leverAtFrame(frame), 0);
  for (let frame = REST_FAR_OPENING + 1; frame <= REST_FAR_OPENING + WALK_IN; frame += 1) {
    assert.ok(leverAtFrame(frame) > leverAtFrame(frame - 1));
  }
  const outStart = REST_FAR_OPENING + WALK_IN + REST_NEAR;
  for (let frame = outStart + 1; frame <= outStart + WALK_OUT; frame += 1) {
    assert.ok(leverAtFrame(frame) < leverAtFrame(frame - 1));
  }
  assert.equal(leverAtFrame(TOTAL_FRAMES), 0);
  assert.deepEqual(sceneAt(TOTAL_FRAMES), sceneAt(0));
  assert.deepEqual(sceneAt(-1), sceneAt(299));
  assert.equal(sceneAt(75).distance, 6);
  assert.equal(sceneAt(0).distance, FAR_DISTANCE);
  assert.equal(sceneAt(150).distance, NEAR_DISTANCE);
  assert.throws(() => leverAtFrame(1.5), TypeError);
});

test("the lever reads as a distance by the named law, and the stations are returned exactly", () => {
  assert.equal(distanceAtLever(0), FAR_DISTANCE);
  assert.equal(distanceAtLever(1), NEAR_DISTANCE);
  assert.equal(distanceAtLever(0, "linear"), FAR_DISTANCE);
  assert.equal(distanceAtLever(1, "linear"), NEAR_DISTANCE);
  for (let step = 0; step <= 100; step += 1) {
    const lever = step / 100;
    const reciprocal = distanceAtLever(lever, "reciprocal");
    const linear = distanceAtLever(lever, "linear");
    assert.ok(Math.abs(1 / reciprocal - ((1 - lever) / FAR_DISTANCE + lever / NEAR_DISTANCE)) < 1e-15);
    assert.ok(Math.abs(linear - (FAR_DISTANCE + lever * (NEAR_DISTANCE - FAR_DISTANCE))) < 1e-12);
    assert.ok(reciprocal >= NEAR_DISTANCE && reciprocal <= FAR_DISTANCE);
    assert.ok(reciprocal <= linear + 1e-12);
  }
  assert.equal(distanceAtLever(0.5), 6);
  assert.equal(distanceAtLever(0.5, "linear"), 8);
  assert.throws(() => distanceAtLever(1.1), RangeError);
  assert.throws(() => distanceAtLever(0.5, "eased"), RangeError);
  assert.equal(sceneAtLever(0.5, "linear").distance, 8);
});

test("the pointer's lane is the lever: inset at both ends, clamped outside, and its own inverse", () => {
  const width = LOGICAL_SIZE;
  assert.equal(leverFromPointer(0, width), 0);
  assert.equal(leverFromPointer(width * LANE_INSET, width), 0);
  assert.equal(leverFromPointer(width * (1 - LANE_INSET), width), 1);
  assert.equal(leverFromPointer(width, width), 1);
  assert.equal(leverFromPointer(-40, width), 0);
  for (let step = 0; step <= 20; step += 1) {
    const lever = step / 20;
    const hand = pointerAtLever(lever, width, width);
    assert.ok(Math.abs(leverFromPointer(hand.x, width) - lever) < 1e-12);
    assert.equal(hand.y, width * LANE_HEIGHT);
  }
  assert.deepEqual(pointerAtLever(0, 680, 680), { x: 54.4, y: 649.4 });
});

test("the catalog keeps the clause as both editions print it", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "sextus-ho-autos-pyrgos");
  const approved = "ὁ αὐτὸς πύργος πόρρωθεν μὲν φαίνεται στρογγύλος ἐγγύθεν δὲ τετράγωνος";
  assert.equal(quote.text, approved);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 69);
  // No quotation mark and no comma: the two editions differ only in those, at I.32.
  assert.doesNotMatch(quote.text, /[,‘’“”]/u);
  assert.equal(quote.lang, "grc");
  assert.equal(quote.author, "Σέξτος Ἐμπειρικός");
  assert.equal(quote.source, "Pyrrhoniae hypotyposes I.118");
  assert.equal(quote.year, null);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://archive.org/details/sextiempiriciope01sext/page/n62/mode/1up");
  assert.equal(CATALOG.quotes.filter((entry) => entry.lang === "grc").length, 9);
});

test("the notes name both editions, keep the extension as the project's, and say what the floors are", () => {
  const section = NOTES.slice(NOTES.indexOf("The Same Tower starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  assert.match(section, /Mutschmann 1912/u);
  assert.match(section, /Bekker 1842/u);
  assert.match(section, /`στρογγύλος,\] Mutschmann 1912, p\. 12 : στρογγύλος Bekker 1842, p\. 9`/u);
  assert.match(section, /one footprint/u);
  assert.match(section, /The distances, the floors and the walk are this project's construction/u);
  assert.doesNotMatch(section, /Sextus (?:knew|drew|described) (?:a|the) (?:ambiguous|tower)/u);
  assert.match(section, /the ground floor's swing is \+1\/3 at the front of a corner and −3\/7 at its back/u);
  assert.match(section, /the top floor's, half a unit above the eyes, is −1\/18 and \+1\/14/u);
  assert.match(section, /closes the first section of the fifth mode/u);
  // The related form is quoted from pages that were read, with the editor's supplement marked.
  assert.match(section, /Mutschmann page 78\]\(https:\/\/archive\.org\/details\/sextiempiriciope01sext\/page\/n109\/mode\/1up\) prints `τὸν ⟨αὐτὸν⟩ πύργον ὁτὲ μὲν στρογγύλον, ὁτὲ δὲ τετράγωνον`/u);
  assert.match(section, /Bekker page 69\]\(https:\/\/archive\.org\/details\/sextusempiricus00bekkgoog\/page\/n76\/mode\/1up\) prints `τὸν πύργον ὁτὲ μὲν στρογγύλον ὁτὲ δὲ τετράγωνον`/u);
  assert.doesNotMatch(section, /closes the fifth mode/u);
});

test("the manifest, notes, card, post and legend agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "the-same-tower");
  const quote = CATALOG.quotes.find((entry) => entry.id === "sextus-ho-autos-pyrgos");
  assert.equal(artwork.title, "The Same Tower");
  assert.equal(artwork.entry, "p5js/artworks/the-same-tower/index.html");
  assert.equal(artwork.interactivePath, "the-same-tower/");
  assert.deepEqual(artwork.canvas, { width: 680, height: 680 });
  assert.deepEqual(artwork.quoteIds, ["sextus-ho-autos-pyrgos"]);
  assert.deepEqual(artwork.thumbnail, { frame: 75 });
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/TheSameTower.mp4", durationSeconds: 10, scale: 2
  });
  assert.match(NOTES, /\| `the-same-tower` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 10 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 167);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">The Same Tower</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="grc">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
  // The legend the sketch prints is the line the notes' table gives for it.
  const source = readFileSync(SKETCH_URL, "utf8");
  const legend = source.match(/\{ cap: "(?<cap>[^"]+)", text: "(?<text>[^"]+)" \}/u);
  assert.ok(legend);
  assert.equal(legend.groups.cap, "move");
  assert.ok(NOTES.includes(`| \`the-same-tower\` | pointer | \`${legend.groups.cap}\` ${legend.groups.text} |`));
});

test("the sketch's whole drawing vocabulary is lines and the eye, with the hand's circles for the clip", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), [
    "background", "camera", "createCanvas", "createGraphics", "frameRate", "image", "line",
    "linePerspective", "noFill", "noLoop", "perspective", "pixelDensity", "pop", "push",
    "resetMatrix", "scale", "setAttributes", "stroke", "strokeWeight", "translate"
  ]);
  // No letter, numeral, arrow, face or nominal figure can reach the frame: nothing that
  // could draw one is ever called on the stage. The legend's type goes on its own surface.
  for (const forbidden of ["text", "rect", "vertex", "quad", "triangle", "arc", "box", "sphere", "cylinder", "circle", "ellipse"]) {
    assert.ok(!called.has(forbidden), `${forbidden} must not be drawn on the stage`);
  }
  // The eye is the sketch's own, not the shared pinned one.
  assert.doesNotMatch(source, /pinLogicalCamera/u);
  assert.match(source, /p\.perspective\(scene\.fieldOfView, 1, NEAR_PLANE, FAR_PLANE\)/u);
  assert.match(source, /p\.camera\(\.\.\.onStage\(scene\.eye\), \.\.\.onStage\(scene\.lookAt\), 0, 1, 0\)/u);
});

/** A stand-in for a 2D surface, enough for the legend to be set on it. */
function recordingSurface(record) {
  const surface = {
    RGB: "RGB", LEFT: "LEFT", BOTTOM: "BOTTOM",
    pixelDensity: () => {}, clear: () => {}, push: () => {}, pop: () => {}, scale: () => {},
    colorMode: () => {}, noStroke: () => {}, noFill: () => {}, stroke: () => {}, strokeWeight: () => {},
    fill: () => {}, textAlign: () => {}, textSize: () => {},
    textWidth: (label) => label.length * 8,
    rect: (...args) => record.rects.push(args),
    text: (...args) => record.texts.push(args)
  };
  return surface;
}

async function loadSketch(search, record) {
  const noop = () => {};
  class RecordingP5 {
    constructor(define) {
      const p = {
        WEBGL: "WEBGL",
        mouseX: 0,
        frameCount: 0,
        createCanvas: (...args) => { record.canvas = args; return { parent: noop }; },
        setAttributes: (...args) => record.attributes.push(args),
        linePerspective: (value) => record.linePerspective.push(value),
        pixelDensity: (value) => record.density.push(value),
        frameRate: (value) => record.frameRate.push(value),
        noLoop: noop,
        background: (...colour) => {
          record.background = colour;
          record.lines = [];
          record.strokes = [];
          record.weights = [];
          record.perspective = [];
          record.camera = [];
          record.circles = [];
          record.images = [];
          record.translate = [];
        },
        perspective: (...args) => record.perspective.push(args),
        camera: (...args) => record.camera.push(args),
        resetMatrix: noop,
        translate: (...args) => record.translate.push(args),
        scale: (value) => record.scale.push(value),
        noFill: noop, noStroke: noop, push: noop, pop: noop, colorMode: noop, fill: noop,
        stroke: (...colour) => record.strokes.push(colour),
        strokeWeight: (weight) => record.weights.push(weight),
        line: (...args) => record.lines.push(args),
        circle: (...args) => record.circles.push(args),
        createGraphics: (...args) => { record.graphics.push(args); return recordingSurface(record); },
        image: (...args) => record.images.push(args)
      };
      define(p);
      record.p = p;
      p.setup();
    }
  }
  globalThis.window = { p5: RecordingP5, location: { search } };
  await import(`${SKETCH_URL.href}?${search.slice(1)}`);
}

function freshRecord() {
  return {
    attributes: [], linePerspective: [], density: [], frameRate: [], scale: [], graphics: [], rects: [], texts: [],
    lines: [], strokes: [], weights: [], perspective: [], camera: [], circles: [], images: [], translate: []
  };
}

test("an export frame draws the eight floors and four hairlines under the walking eye, and the hand under the default one", async () => {
  const priorWindow = globalThis.window;
  const record = freshRecord();
  try {
    await loadSketch("?capture=1&renderScale=2", record);
    assert.deepEqual(record.canvas, [1360, 1360, "WEBGL"]);
    assert.deepEqual(record.attributes, [["preserveDrawingBuffer", true]]);
    // Hairlines of one weight wherever they stand: the depth scaling of strokes is off.
    assert.deepEqual(record.linePerspective, [false]);
    assert.deepEqual(record.density, [1]);
    assert.deepEqual(record.frameRate, [30]);
    // At load: one canvas only, the far station, no legend and no hand.
    assert.deepEqual(record.graphics, []);
    assert.deepEqual(record.background, [6, 7, 12]);
    assert.deepEqual(record.circles, []);
    assert.deepEqual(record.perspective, [[fieldOfView(FAR_DISTANCE), 1, 50, 4000]]);
    assert.deepEqual(record.camera, [[0, -300, 1200, 0, -175, 0, 0, 1, 0]]);

    const state = await window.__renderFrame(150);
    const scene = sceneAt(150);
    assert.equal(state.kind, "video");
    assert.equal(state.frameIndex, 150);
    assert.equal(state.totalFrames, 300);
    assert.equal(state.durationSeconds, 10);
    assert.equal(state.distance, NEAR_DISTANCE);
    assert.equal(state.lever, 1);
    assert.equal(state.fieldOfView, NEAR_FIELD_OF_VIEW);
    assert.deepEqual(state.eye, NEAR_EYE);
    assert.equal(state.floors, 8);
    assert.equal(state.verticals, 4);
    assert.equal(state.palette, "night");
    assert.deepEqual(state.outputSize, { width: 1360, height: 1360 });

    // The walking eye first, then the default one for the hand.
    assert.deepEqual(record.perspective, [[NEAR_FIELD_OF_VIEW, 1, 50, 4000], []]);
    assert.deepEqual(record.camera, [[0, -300, 400, 0, -175, 0, 0, 1, 0], []]);
    assert.equal(record.lines.length, FLOOR_COUNT * (RIM_SEGMENTS + 2) + 4);
    // The first line is the ground floor's left corner, front end, onto the stage.
    const [x, y, z] = scene.floors[0][0];
    assert.deepEqual(record.lines[0].slice(0, 3), [x * STAGE_SCALE, -z * STAGE_SCALE, -y * STAGE_SCALE]);
    // The tower's one stroke, then the hand's white rim.
    assert.deepEqual(record.strokes, [[246, 244, 236], [255, 255, 255, 235]]);
    assert.equal(record.weights[0], 2.8);
    assert.equal(record.weights.length, 2);
    assert.equal(record.circles.length, 1);
    assert.deepEqual(record.circles[0].slice(0, 2), [625.6, 649.4]);
    assert.deepEqual(record.translate, [[-680, -680]]);
    assert.deepEqual(record.graphics, []);
    assert.deepEqual(record.images, []);

    const opening = await window.__renderFrame(0);
    assert.deepEqual(record.circles[0].slice(0, 2), [54.4, 649.4]);
    // Frame 300 is frame 0's picture; the index is reported as asked, which the renderer requires.
    assert.deepEqual({ ...await window.__renderFrame(300), frameIndex: 0 }, opening);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

test("a thumbnail frame lays the legend over the frame on its own surface, and draws no hand", async () => {
  const priorWindow = globalThis.window;
  const record = freshRecord();
  try {
    await loadSketch("?capture=1&renderScale=1&hint=1&hintScale=1.7", record);
    assert.deepEqual(record.graphics, []);
    await window.__renderFrame(75);
    assert.deepEqual(record.graphics, [[680, 680]]);
    assert.equal(record.images.length, 1);
    assert.deepEqual(record.images[0].slice(1), [-340, -340]);
    assert.deepEqual(record.circles, []);
    assert.ok(record.texts.some(([label]) => label === "move"));
    assert.ok(record.texts.some(([label]) => label === "walk towards the tower and back"));
    assert.equal(record.perspective.length, 2);
    assert.deepEqual(record.perspective[0], [fieldOfView(6), 1, 50, 4000]);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACTS,
  ACT_FRAMES,
  BACK_FRAME,
  BEAMS,
  BOUNDING_RADIUS,
  CUBE_SIZE,
  CUBES,
  CUBES_PER_BEAM,
  DURATION_SECONDS,
  FRONT_FRAME,
  GROUND,
  INK,
  JOINTS,
  JOINT_STEP,
  LOGICAL_SIZE,
  LOOK_AT,
  MAGIC,
  MAGIC_AXIS,
  PLAYBACK_FPS,
  SIDE_FRAME,
  STROKE_WEIGHT,
  TOTAL_FRAMES,
  TURN_AXIS,
  actAt,
  cubeCells,
  exactCross,
  exactDelta,
  exactZero,
  eyeStepAt,
  jointGaps,
  jointsOf,
  projectedGap,
  sceneAt,
  silhouetteBounds,
  turnAt,
  viewDirection
} from "../artworks/eyed-awry/eyed-awry.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const README = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const SKETCH = readFileSync(new URL("../artworks/eyed-awry/sketch.js", import.meta.url), "utf8");
const INDEX_HTML = readFileSync(new URL("../artworks/eyed-awry/index.html", import.meta.url), "utf8");
const MODEL = readFileSync(new URL("../artworks/eyed-awry/eyed-awry.js", import.meta.url), "utf8");

const APPROVED_QUOTE =
  "Like perspectiues,which rightly gazde vpon Shew nothing but confusion; eyde awry, Distinguish forme";

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

test("the acts cover the clip and the wrap is the first station", () => {
  assert.equal(ACT_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, PLAYBACK_FPS * DURATION_SECONDS);
  assert.equal(DURATION_SECONDS, 13);
  assert.deepEqual(ACTS.map(([name]) => name), ["front", "leave", "side", "cross", "back", "home"]);
  assert.equal(actAt(0).name, "front");
  assert.equal(actAt(FRONT_FRAME).name, "front");
  assert.equal(actAt(SIDE_FRAME).name, "side");
  assert.equal(actAt(BACK_FRAME).name, "back");
  assert.equal(actAt(TOTAL_FRAMES - 1).name, "home");
  assert.equal(actAt(TOTAL_FRAMES).name, "front");
  assert.equal(turnAt(0), 0);
  assert.equal(turnAt(SIDE_FRAME), 0.25);
  assert.equal(turnAt(BACK_FRAME), 0.5);
  assert.equal(turnAt(TOTAL_FRAMES - 1), 1);
  assert.equal(turnAt(TOTAL_FRAMES), 0);
});

test("fifteen integer cubes, three beams, no cell shared", () => {
  assert.equal(CUBES.length, 3 * CUBES_PER_BEAM);
  assert.equal(CUBES_PER_BEAM, 5);
  assert.equal(BEAMS.a.length, 5);
  assert.equal(BEAMS.b.length, 5);
  assert.equal(BEAMS.c.length, 5);
  const keys = CUBES.map(({ cell }) => cell.join(","));
  assert.equal(new Set(keys).size, keys.length);
  for (const { cell } of CUBES) {
    assert.ok(cell.every((part) => Number.isInteger(part)));
  }
  // Neighbouring cubes of a beam stand one cell apart on one axis.
  for (let index = 1; index < BEAMS.a.length; index += 1) {
    assert.deepEqual(
      BEAMS.a[index].map((part, axis) => part - BEAMS.a[index - 1][axis]),
      [1, 0, 0]
    );
  }
  for (let index = 1; index < BEAMS.b.length; index += 1) {
    assert.deepEqual(
      BEAMS.b[index].map((part, axis) => part - BEAMS.b[index - 1][axis]),
      [0, 1, 0]
    );
  }
  for (let index = 1; index < BEAMS.c.length; index += 1) {
    assert.deepEqual(
      BEAMS.c[index].map((part, axis) => part - BEAMS.c[index - 1][axis]),
      [0, 0, 1]
    );
  }
  assert.ok(CUBE_SIZE < 1, "a cube smaller than its cell leaves a gutter");
  assert.ok(CUBE_SIZE > 0.5);
});

test("each joint is a whole number of steps along (1, 1, 1), and only along it", () => {
  assert.equal(JOINTS.length, 3);
  assert.equal(JOINT_STEP, 2);
  const axis = MAGIC.map((part) => BigInt(part));
  for (const joint of JOINTS) {
    const delta = exactDelta(joint.near, joint.far);
    assert.ok(exactZero(exactCross(delta, axis)), `${joint.from}-${joint.to} is not on the axis`);
    assert.ok(
      delta.every((part) => part === delta[0]),
      `${joint.from}-${joint.to} steps unequally`
    );
    assert.ok(delta[0] !== 0n, `${joint.from}-${joint.to} meets in space`);
    // A direction off the axis does not hide the gap.
    assert.equal(exactZero(exactCross(delta, [1n, 0n, 0n])), false);
    assert.equal(exactZero(exactCross(delta, [0n, 1n, 0n])), false);
    assert.equal(exactZero(exactCross(delta, [0n, 0n, 1n])), false);
  }
  // The third joint closes for any count and any step: that is the construction.
  for (const count of [2, 3, 5, 8]) {
    for (const step of [1, 2, 4]) {
      const joints = jointsOf({
        a: cubeCells(count, step).filter((cube) => cube.beam === "a").map((cube) => cube.cell),
        b: cubeCells(count, step).filter((cube) => cube.beam === "b").map((cube) => cube.cell),
        c: cubeCells(count, step).filter((cube) => cube.beam === "c").map((cube) => cube.cell)
      });
      const delta = exactDelta(joints[2].near, joints[2].far);
      assert.ok(exactZero(exactCross(delta, axis)));
      assert.ok(delta[0] !== 0n);
    }
  }
});

test("the projected gap is nought on the axis and not nought off it", () => {
  const closed = jointGaps(MAGIC);
  assert.deepEqual(closed, [0, 0, 0]);
  assert.deepEqual(jointGaps([-1, -1, -1]), [0, 0, 0]);
  const side = jointGaps(TURN_AXIS);
  assert.ok(side.every((gap) => gap > 1));
  // The side station is the direction of greatest split for this axis.
  const halfway = jointGaps(viewDirection(0.125));
  assert.ok(halfway.every((gap, index) => gap < side[index]));
  // Shift one cube of a joint off the axis and the closed view splits.
  const [joint] = JOINTS;
  const offAxis = [joint.far[0] + 1, joint.far[1], joint.far[2]];
  assert.ok(projectedGap(joint.near, offAxis, MAGIC) > 0);
});

test("the two stations look along the axis, the side station across it", () => {
  assert.ok(Math.abs(dot(MAGIC_AXIS, TURN_AXIS)) < 1e-15);
  assert.ok(Math.abs(hypot3ok(MAGIC_AXIS) - 1) < 1e-15);
  assert.ok(Math.abs(hypot3ok(TURN_AXIS) - 1) < 1e-15);
  const front = sceneAt(FRONT_FRAME);
  const side = sceneAt(SIDE_FRAME);
  const back = sceneAt(BACK_FRAME);
  const last = sceneAt(TOTAL_FRAMES - 1);
  const again = sceneAt(TOTAL_FRAMES);
  assert.deepEqual(front.direction, MAGIC_AXIS);
  assert.deepEqual(back.direction, MAGIC_AXIS.map((part) => -part));
  assert.deepEqual(side.direction, TURN_AXIS);
  assert.deepEqual(last.direction, MAGIC_AXIS);
  assert.deepEqual(again.direction, MAGIC_AXIS);
  assert.equal(front.closed, true);
  assert.equal(side.closed, false);
  assert.equal(back.closed, true);
  assert.equal(last.closed, true);
  assert.deepEqual(jointGaps(front.direction), [0, 0, 0]);
  assert.deepEqual(jointGaps(back.direction), [0, 0, 0]);
  assert.ok(jointGaps(side.direction).every((gap) => gap > 1));
  // The closed triangle is the smaller picture, so its frame is the tighter one.
  assert.ok(front.orthoHalf < side.orthoHalf);
  assert.ok(back.orthoHalf < side.orthoHalf);
  assert.equal(front.orthoHalf, last.orthoHalf);
});

test("holds stand still, and the last frame of a move is the hold it arrives at", () => {
  for (const frame of [FRONT_FRAME, SIDE_FRAME, BACK_FRAME]) {
    assert.equal(eyeStepAt(frame), 0);
    assert.equal(eyeStepAt(frame + 1), 0);
  }
  // The last frame of leave is the side station; the last of cross, the back.
  assert.equal(turnAt(SIDE_FRAME - 1), 0.25);
  assert.equal(turnAt(BACK_FRAME - 1), 0.5);
  assert.equal(eyeStepAt(SIDE_FRAME - 1), 0);
  assert.equal(eyeStepAt(BACK_FRAME - 1), 0);
  // The wrap: last frame and first frame are the same eye.
  const first = sceneAt(0).eye;
  const wrap = sceneAt(TOTAL_FRAMES - 1).eye;
  assert.deepEqual(first, wrap);
  assert.equal(eyeStepAt(TOTAL_FRAMES - 1), 0);
});

test("a cube is smaller than its cell, and the frame holds the bounding sphere", () => {
  assert.ok(CUBE_SIZE < 1);
  assert.ok(BOUNDING_RADIUS > 6);
  assert.ok(BOUNDING_RADIUS < 10);
  assert.ok(LOOK_AT.every((part) => Number.isFinite(part)));
  const closed = silhouetteBounds(MAGIC);
  const side = silhouetteBounds(TURN_AXIS);
  assert.ok(Math.max(closed.width, closed.height) < Math.max(side.width, side.height));
});

test("the sketch is a clip of paper cubes in one stroke, timed from the clock", () => {
  assert.match(SKETCH, /from "\.\/eyed-awry\.js"/u);
  assert.match(SKETCH, /p\.createCanvas\(OUTPUT_SIZE, OUTPUT_SIZE, p\.WEBGL\)/u);
  assert.match(SKETCH, /p\.linePerspective\(false\)/u);
  assert.match(SKETCH, /p\.ortho\(-scene\.orthoHalf, scene\.orthoHalf, -scene\.orthoHalf, scene\.orthoHalf/u);
  assert.match(SKETCH, /p\.noLights\(\)/u);
  assert.match(SKETCH, /p\.fill\(\.\.\.GROUND\)/u);
  assert.match(SKETCH, /p\.stroke\(\.\.\.INK\)/u);
  assert.match(SKETCH, /STROKE_WEIGHT \* RENDER_SCALE/u);
  assert.match(SKETCH, /window\.performance\.now\(\)/u);
  assert.match(SKETCH, /p\.buildGeometry\(/u);
  assert.match(SKETCH, /p\.box\(BOX\)/u);
  assert.match(SKETCH, /return Promise\.resolve\(publishState\(/u);
  assert.match(SKETCH, /return state/u);
  assert.doesNotMatch(SKETCH, /drawKeyHint/u);
  assert.doesNotMatch(SKETCH, /p\.text\(/u);
  assert.doesNotMatch(SKETCH, /p\.sphere\(/u);
  assert.deepEqual(GROUND, [230, 224, 208]);
  assert.deepEqual(INK, [0, 0, 0]);
  assert.equal(STROKE_WEIGHT, 1.7);
  assert.match(INDEX_HTML, /<title>Eyed Awry<\/title>/u);
  assert.doesNotMatch(MODEL, /Penrose|Escher|Reutersvärd drew/u);
});

test("the archived original: catalog keeps the quarto's clause, letter for letter", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "shakespeare-eyed-awry").original;
  assert.equal(quote.text, APPROVED_QUOTE);
  assert.equal(quote.text, quote.text.normalize("NFC"));
  assert.equal([...quote.text].length, 99);
  assert.equal(quote.lang, "en");
  assert.equal(quote.author, "William Shakespeare");
  assert.equal(quote.source, "Richard II, II.2");
  assert.equal(quote.year, 1597);
  assert.equal(quote.publicDomain, true);
  assert.equal(
    quote.sourceUrl,
    "https://internetshakespeare.uvic.ca/media/facsimile/shakespeare/BritishLibrary/R2_Q1/Q1_R2_036-550w.jpg"
  );
  assert.equal(CATALOG.quotes.filter((entry) => (entry.original ?? entry).lang === "en").length, 8);
  assert.equal(CATALOG.quotes.filter((entry) => entry.author === "William Shakespeare").length, 1);
});

test("the notes keep the figure as this project's, give the numbers the tests hold, and name both editions", () => {
  const section = NOTES.slice(NOTES.indexOf("Eyed Awry starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0, "the notes must open the section with what it starts from");
  assert.match(section, /this project's construction/u);
  assert.doesNotMatch(section, /Shakespeare (?:drew|knew|described) (?:a|the) (?:triangle|cubes)/u);
  assert.match(section, /fifteen cubes/u);
  assert.match(section, /three beams/u);
  assert.match(section, /\(1, 1, 1\)/u);
  assert.match(section, /smootherstep/u);
  assert.match(section, /fitted to the silhouette/u);
  assert.match(section, /The thumbnail is frame 18/u);
  assert.match(section, /warm white/u);
  assert.match(section, /No face is lit/u);
  assert.match(section, /1597/u);
  assert.match(section, /1623/u);
  assert.match(section, /`gazde\] Q1 1597 : gaz'd F1 1623`/u);
  assert.match(README, /\| \[Eyed Awry\]\(p5js\/artworks\/eyed-awry\/\) \|/u);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "eyed-awry");
  const quote = CATALOG.quotes.find((entry) => entry.id === "shakespeare-eyed-awry");
  assert.equal(artwork.title, "Eyed Awry");
  assert.equal(artwork.entry, "p5js/artworks/eyed-awry/index.html");
  assert.equal(artwork.interactivePath, "eyed-awry/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, ["shakespeare-eyed-awry"]);
  assert.deepEqual(artwork.thumbnail, { frame: 18 });
  assert.equal(actAt(18).name, "front");
  assert.equal(sceneAt(18).closed, true);
  assert.deepEqual(artwork.render, {
    kind: "video",
    artifact: "exports/p5js/EyedAwry.mp4",
    durationSeconds: DURATION_SECONDS,
    scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `eyed-awry` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 13 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.ok(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters) <= 280);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Eyed Awry</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="en">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.doesNotMatch(NOTES, /\| `eyed-awry` \| [a-z, +]+ \| `/u);
});

function hypot3ok([x, y, z]) {
  return Math.hypot(x, y, z);
}

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, loadCatalog } from "../lib/catalog.mjs";
import { hintMode } from "../artworks/shared/hint-mode.js";
import { NUMBER_WORDS } from "./number-words.mjs";
import {
  HINT_INSET_RATIO,
  HINT_TONE,
  drawKeyHint,
  fitHintSize,
  hintTextSize,
  legendRoom
} from "../artworks/shared/key-hint.js";

const parameters = (query) => new URLSearchParams(query);

test("the page shows the hint and a capture for posting does not", () => {
  assert.equal(hintMode(parameters(""), false).shown, true);
  assert.equal(hintMode(parameters("capture=1"), true).shown, false);
});

test("a thumbnail is a capture that shows the hint anyway, enlarged", () => {
  const mode = hintMode(parameters("capture=1&hint=1&hintScale=1.7"), true);
  assert.equal(mode.shown, true);
  assert.equal(mode.scale, 1.7);
});

test("a missing or unreadable scale leaves the hint at the page's own size", () => {
  assert.equal(hintMode(parameters("capture=1&hint=1"), true).scale, 1);
  assert.equal(hintMode(parameters("capture=1&hint=1&hintScale=zero"), true).scale, 1);
  // Zero would erase the hint rather than leave it alone, so it is not honoured either.
  assert.equal(hintMode(parameters("capture=1&hint=1&hintScale=0"), true).scale, 1);
});

test("the enlarged hint is still legible once a card has scaled the canvas down", () => {
  // A card fits the canvas into an opening about 353 pixels wide. The two artworks that
  // answer to a key are 680 square and 1010 by 640, so both arrive there at around two
  // fifths of their own size — and the hint has to survive that, not the full size.
  const openingWidth = 353;
  const cases = [
    { width: 680, height: 680 },
    { width: 1010, height: 640 }
  ];
  for (const { width, height } of cases) {
    const shrink = Math.min(openingWidth / width, (openingWidth * 3 / 4) / height);
    const onCard = hintTextSize(width, height, 1.7) * shrink;
    assert.ok(onCard >= 9.5, `${width}x${height} would land at ${onCard.toFixed(1)} pixels`);
    // And not so large that the note starts competing with the artwork it sits under.
    assert.ok(onCard <= 16, `${width}x${height} would land at ${onCard.toFixed(1)} pixels`);
  }
});

/**
 * A legend has to fit the canvas it is drawn on, and the card is where it fails first:
 * the same words are set 1.7 times larger there on a canvas of the same width. How wide
 * a word actually is can only be answered by a browser, so the renderer settles that on
 * the picture it is about to write; what can be settled here is the arithmetic that
 * shrinks the type, given a measurer.
 */

/** A stand-in for a font: width proportional to type size, as fonts nearly are. */
const proportional = (perPoint) => (size) => perPoint * size;

test("a legend that fits is left at the size it asked for", () => {
  const room = legendRoom(680, 680 * HINT_INSET_RATIO);
  const size = hintTextSize(680, 680, 1.7);
  assert.equal(fitHintSize(size, room, proportional(10)), size);
});

test("a legend that overruns is shrunk until it fits, however far it overran", () => {
  const width = 680;
  const room = legendRoom(width, width * HINT_INSET_RATIO);
  const asked = hintTextSize(width, width, 1.7);
  // Necker Cube's line overran the card by about five per cent; the second case is a
  // legend half as long again as the room, which must also come back inside.
  for (const perPoint of [22, 30, 60]) {
    const fitted = fitHintSize(asked, room, proportional(perPoint));
    assert.ok(fitted <= asked, "a fitted legend grew");
    assert.ok(proportional(perPoint)(fitted) <= room + 1e-9,
      `${perPoint} per point still measured ${proportional(perPoint)(fitted)} against ${room}`);
  }
});

test("the shrink is no more than it has to be", () => {
  // Shrinking further than the overrun would make short legends needlessly small.
  const room = 600;
  const fitted = fitHintSize(20, room, proportional(40));
  assert.ok(Math.abs(fitted - 15) < 1e-9, `fitted to ${fitted} rather than 15`);
});

test("a font whose widths do not scale exactly is still brought inside", () => {
  // Real fonts round to whole pixels and hint their stems, so the width at a smaller
  // size is not exactly proportional. The fit asks again after shrinking, which is what
  // the extra rounds are for.
  const room = 600;
  const lumpy = (size) => 40 * size + 25;
  const fitted = fitHintSize(20, room, lumpy);
  assert.ok(lumpy(fitted) <= room + 1e-9, `still ${lumpy(fitted)} against ${room}`);
});

test("the room a legend has is the canvas less an inset at each end", () => {
  assert.equal(legendRoom(680, 20), 640);
  // The plate hangs half a padding outside the inset at both ends, so the padding
  // cancels and the legend itself is what has to fit.
  assert.ok(legendRoom(680, 680 * HINT_INSET_RATIO) < 680);
});

test("the README's roll of interactive artworks is the sketches' own", async () => {
  // The same staleness the thumbnail count had: a number written in prose, a table
  // beside it, and the truth in a third place. All three are held together here. The
  // truth is which registered artworks actually draw a legend, which is a question
  // about the sketches rather than about anybody's memory of them.
  const readme = await readFile(resolve(P5JS_DIRECTORY, "README.md"), "utf8");
  const claim = readme.match(/(?<count>[\w-]+) artworks answer to the reader/u);
  assert.ok(claim, "the README no longer says how many artworks answer to the reader");
  const stated = NUMBER_WORDS.indexOf(claim.groups.count.toLowerCase());
  assert.ok(stated > 0, `"${claim.groups.count}" is not a number word this test can read`);

  // The table that follows the sentence, one row per artwork.
  const table = readme.slice(readme.indexOf(claim[0]));
  const rows = [...table.matchAll(/^\| `(?<id>[a-z0-9-]+)` \| /gmu)].map((row) => row.groups.id);
  assert.equal(rows.length, stated, `the sentence says ${stated} and the table lists ${rows.length}`);

  // And the artworks that really carry one: registered in the manifest, and drawing a
  // legend in their own sketch. An artwork in the tree but not in the manifest is not
  // published, so it is not one of the artworks a reader can answer to yet.
  const { manifest } = await loadCatalog();
  const carrying = [];
  for (const artwork of manifest.artworks) {
    const sketch = resolve(P5JS_DIRECTORY, "artworks", artwork.id, "sketch.js");
    const source = await readFile(sketch, "utf8").catch(() => "");
    // A call, not the name: an import line alone draws nothing.
    if (/^(?!\s*(?:\/\/|\*|import\b)).*\bdrawKeyHint\(/mu.test(source)) {
      carrying.push(artwork.id);
    }
  }
  assert.deepEqual(rows.slice().sort(), carrying.slice().sort());
  assert.equal(carrying.length, stated);
});

/**
 * The legend is the page's, not the artwork's, so every page draws it in one tone. Still
 * There passed its own, with a plate the colour of its ground, and its legend lost the
 * plate that every other page has. Two things are held here: what the shared drawing
 * actually paints, and what each artwork hands it.
 */

/** Every argument list of a drawKeyHint call in a source, split at its own top-level commas. */
function keyHintCalls(source) {
  const calls = [];
  for (const match of source.matchAll(/^(?!\s*(?:\/\/|\*|import\b)).*?\bdrawKeyHint\(/gmu)) {
    const args = [];
    let depth = 0;
    let quote = null;
    let current = "";
    for (let index = match.index + match[0].length; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        quote = character === quote ? null : quote;
      } else if (`"'\``.includes(character)) {
        quote = character;
      } else if ("([{".includes(character)) {
        depth += 1;
      } else if (")]}".includes(character)) {
        if (depth === 0) {
          break;
        }
        depth -= 1;
      } else if (character === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
      current += character;
    }
    args.push(current.trim());
    calls.push(args.filter((argument) => argument !== ""));
  }
  return calls;
}

/** Layer, segments, width, height and scale; anything after them is a tone of its own. */
const handsItsOwnTone = (args) => args.length > 5;

/** A stand-in for p5 that remembers every colour it is asked to paint in. */
function recordingSketch() {
  const colours = [];
  return {
    colours,
    RGB: "rgb", LEFT: "left", BOTTOM: "bottom",
    push() {}, pop() {}, colorMode() {}, noStroke() {}, noFill() {}, textAlign() {},
    textSize() {}, strokeWeight() {}, rect() {}, text() {},
    textWidth: (text) => String(text).length * 7,
    fill: (...colour) => colours.push(colour),
    stroke: (...colour) => colours.push(colour)
  };
}

test("the shared legend paints only in the shared tone, whatever it is handed", () => {
  const legend = [{ cap: "←", text: "back" }, { cap: "space", text: "run / pause" }];
  const tones = new Set(Object.values(HINT_TONE).map((colour) => colour.join(",")));
  // Called as every page calls it, and called as Still There used to, with a tone of its
  // own: a plate the colour of its ground. Neither may reach the canvas.
  const ownTone = { plate: [8, 15, 25, 230], ink: [218, 223, 221, 230], cap: [153, 179, 188, 180] };
  for (const extra of [[], [ownTone]]) {
    const sketch = recordingSketch();
    drawKeyHint(sketch, legend, 680, 680, 1, ...extra);
    assert.ok(sketch.colours.length >= 5, "the legend painted nothing to check");
    for (const colour of sketch.colours) {
      assert.ok(tones.has(colour.join(",")), `the legend painted in ${colour.join(",")}`);
    }
    // The plate is painted, and painted first, so the line always has its bar under it.
    assert.deepEqual(sketch.colours[0], HINT_TONE.plate);
  }
});

test("no artwork hands the legend a tone of its own", async () => {
  const artworks = resolve(P5JS_DIRECTORY, "artworks");
  const found = new Map();
  for (const entry of await readdir(artworks, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") {
      continue;
    }
    for (const file of await readdir(resolve(artworks, entry.name))) {
      if (!file.endsWith(".js")) {
        continue;
      }
      const calls = keyHintCalls(await readFile(resolve(artworks, entry.name, file), "utf8"));
      if (calls.length > 0) {
        found.set(entry.name, [...(found.get(entry.name) ?? []), ...calls]);
      }
    }
  }
  // The scan has to reach every legend there is, or a clean result means nothing. These
  // are the nine pages that answer to the reader; a tenth is added here by hand.
  assert.deepEqual([...found.keys()].sort(), [
    "atan2", "electric-fan", "moire-rings", "platonic-duals", "pulse-button",
    "still-there", "troubling-of-a-star", "turn-it-and-turn-it", "windmill"
  ]);
  for (const [id, calls] of found) {
    assert.equal(calls.length, 1, `${id} draws ${calls.length} legends`);
    for (const args of calls) {
      assert.ok(!handsItsOwnTone(args), `${id} hands the legend ${args.join(", ")}`);
    }
  }

  // Still There as it stood when its legend lost its plate, frozen outside artworks/.
  const specimen = await readFile(new URL("./fixtures/legend-own-tone/sketch.js", import.meta.url), "utf8");
  const [specimenCall, ...rest] = keyHintCalls(specimen);
  assert.equal(rest.length, 0);
  assert.deepEqual(specimenCall, ["p", "HINT_LEGEND", "LOGICAL_SIZE", "LOGICAL_SIZE", "HINT.scale", "TONE"]);
  assert.ok(handsItsOwnTone(specimenCall), "the check passes the call it was written against");
  assert.ok(specimen.includes("const TONE = { plate: [8, 15, 25, 230]"), "the specimen is not the faulty sketch");
});

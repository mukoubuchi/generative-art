import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";
import { hintFaceRefusal } from "../lib/render.mjs";
import { cmapCodePoints, isWoff2, nameStrings, woff2Contents } from "../lib/woff2.mjs";
import {
  HINT_FACE,
  HINT_FACE_FILE,
  HINT_FONT,
  drawKeyHint,
  loadHintFace
} from "../artworks/shared/key-hint.js";
import { drawKeyIndicator } from "../artworks/shared/input-indicator.js";
import { KEY_CAPS } from "../artworks/still-there/lattice.js";
// The shared legend as it stood at ffef159, before it named a face: the negative control.
import { drawKeyHint as frozenKeyHint } from "./fixtures/legend-default-face/key-hint.js";
import { drawKeyIndicator as frozenKeyIndicator } from "./fixtures/legend-default-face/input-indicator.js";

/**
 * Every legend, and every key the clips light, is set in the one face the repository
 * serves. Named by nothing but the browser's default, the line came out in each machine's
 * own sans-serif, so the cards drawn on CI did not look like the pages drawn here. Held
 * here: that the face is the repository's own file with its licence beside it, that it
 * has every character the legends set, that every piece of type the legend and the
 * indicator draw is drawn in it, and that a failed load costs the reader nothing but the
 * face.
 */

const ARTWORKS = resolve(P5JS_DIRECTORY, "artworks");
const FACE_PATH = fileURLToPath(HINT_FACE_FILE);
const fontBytes = await readFile(FACE_PATH);

/** The array literal a sketch's drawKeyHint call is handed, read from its own source. */
function legendOf(source, name) {
  const start = source.indexOf(`const ${name} = [`);
  assert.ok(start >= 0, `no ${name} in the sketch`);
  let depth = 0;
  let index = source.indexOf("[", start);
  const open = index;
  for (; index < source.length; index += 1) {
    if (source[index] === "[") depth += 1;
    if (source[index] === "]" && --depth === 0) break;
  }
  return Function(`"use strict"; return ${source.slice(open, index + 1)};`)();
}

/** Every artwork's legend, and every artwork's key indicator labels, from the sketches. */
async function legendsAndKeys() {
  const legends = new Map();
  const keys = new Map();
  for (const entry of await readdir(ARTWORKS, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const source = await readFile(resolve(ARTWORKS, entry.name, "sketch.js"), "utf8").catch(() => "");
    const call = source.match(/^(?!\s*(?:\/\/|\*|import\b)).*\bdrawKeyHint\([^,]+,\s*([A-Z_]+)/mu);
    if (call) legends.set(entry.name, legendOf(source, call[1]));
    const labels = [];
    for (const label of source.matchAll(/drawKeyIndicator\(p, \[\{ label: ([^,]+),/gu)) {
      // A label is a literal, or Still There's caps looked up by key.
      labels.push(...(label[1] === "KEY_CAPS[pressedKey]" ? Object.values(KEY_CAPS) : [JSON.parse(label[1])]));
    }
    if (labels.length > 0) keys.set(entry.name, [...new Set(labels)]);
  }
  return { legends, keys };
}

/**
 * A stand-in for p5 that keeps the font as p5 does, across push and pop, and remembers
 * the font every piece of type was measured and drawn in. It starts in the face an
 * artwork might have left set — atan2 sets monospace for its readouts — so a legend that
 * names no face of its own shows up as drawn in somebody else's.
 */
function recordingSketch() {
  const typed = [];
  const stack = [];
  let font = "monospace";
  return {
    typed,
    RGB: "rgb", LEFT: "left", BOTTOM: "bottom",
    push: () => stack.push(font),
    pop: () => { font = stack.pop(); },
    textFont: (family) => { font = family; },
    colorMode() {}, noStroke() {}, noFill() {}, textAlign() {}, textSize() {}, strokeWeight() {},
    rect() {}, fill() {}, stroke() {},
    textWidth: (text) => { typed.push({ call: "textWidth", text, font }); return String(text).length * 7; },
    text: (text) => typed.push({ call: "text", text, font })
  };
}

/** Every legend and every indicator drawn the way the pages, the cards and the clips draw them. */
function drawEverything(hint, indicator, legends, keys) {
  const drawn = [];
  for (const [id, segments] of legends) {
    for (const scale of [1, 1.7]) {
      const sketch = recordingSketch();
      hint(sketch, segments, 680, 680, scale);
      drawn.push({ id, kind: "legend", typed: sketch.typed });
    }
  }
  for (const [id, labels] of keys) {
    for (const active of [false, true]) {
      const sketch = recordingSketch();
      indicator(sketch, labels.map((label) => ({ label, active })), 680, 680);
      drawn.push({ id, kind: "indicator", typed: sketch.typed });
    }
  }
  return drawn;
}

/** The type that was not set in the face, as "id kind call text (font)". */
function outsideTheFace(drawn) {
  return drawn.flatMap(({ id, kind, typed }) => typed
    .filter(({ font }) => font !== HINT_FONT)
    .map(({ call, text, font }) => `${id} ${kind} ${call} ${JSON.stringify(text)} (${font})`));
}

const { legends, keys } = await legendsAndKeys();

test("the face is the repository's own file, with its licence beside it", async () => {
  // Served from beside the module that asks for it, so no other host is involved.
  assert.equal(HINT_FACE_FILE.protocol, "file:");
  assert.equal(FACE_PATH, resolve(ARTWORKS, "shared/fonts/inter-legend.woff2"));
  assert.ok(isWoff2(fontBytes), "the face is not a WOFF2 font");
  const source = await readFile(resolve(ARTWORKS, "shared/key-hint.js"), "utf8");
  assert.doesNotMatch(source, /https?:\/\//u, "the legend module names another host");
  // Inter 4.001, as its own name table says, under the licence that sits next to it.
  const { tables } = woff2Contents(fontBytes);
  const names = new Map(nameStrings(tables.find(({ tag }) => tag === "name").data)
    .map(({ nameId, text }) => [nameId, text]));
  assert.equal(names.get(1), "Inter");
  assert.equal(names.get(5), "Version 4.001;git-66647c0bb");
  const licence = await readFile(resolve(ARTWORKS, "shared/fonts/OFL.txt"), "utf8");
  assert.ok(licence.startsWith("Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)\n"));
  assert.match(licence, /SIL OPEN FONT LICENSE Version 1\.1 - 26 February 2007/u);
  // And the family it is registered under is what every legend asks for first.
  assert.equal(HINT_FONT, `${HINT_FACE}, sans-serif`);
});

test("the scan reaches every legend and every lit key there is", () => {
  // A clean result over nothing would mean nothing: these are the nine pages that answer to
  // the reader and the three clips that light a key; a tenth is added here by hand.
  assert.deepEqual([...legends.keys()].sort(), [
    "atan2", "electric-fan", "moire-rings", "platonic-duals", "pulse-button",
    "still-there", "troubling-of-a-star", "turn-it-and-turn-it", "windmill"
  ]);
  assert.deepEqual(Object.fromEntries([...keys].sort()), {
    "electric-fan": ["K"],
    "still-there": ["←", "→", "space", "R"],
    windmill: ["K"]
  });
});

test("every piece of type a legend or a lit key sets is set in the face", () => {
  const drawn = drawEverything(drawKeyHint, drawKeyIndicator, legends, keys);
  // Each legend's text calls: its caps, its clauses and the dots between them. Each
  // indicator's: one per key.
  for (const { id, kind, typed } of drawn) {
    const texts = typed.filter(({ call }) => call === "text").length;
    const expected = kind === "legend" ? legends.get(id).length * 3 - 1 : keys.get(id).length;
    assert.equal(texts, expected, `${id} ${kind} set ${texts} pieces of type`);
  }
  assert.equal(drawn.flatMap(({ typed }) => typed).filter(({ call }) => call === "text").length, 78);
  assert.deepEqual(outsideTheFace(drawn), []);
});

test("the check catches the legend as it was before it named a face", () => {
  // ffef159's legend and indicator, frozen outside artworks/, set their type in whatever
  // the artwork had left set. The check has to see every piece of it.
  const drawn = drawEverything(frozenKeyHint, frozenKeyIndicator, legends, keys);
  const outside = outsideTheFace(drawn);
  assert.equal(outside.length, drawn.flatMap(({ typed }) => typed).length);
  assert.ok(outside.length >= 78, `only ${outside.length} pieces of type were checked`);
  assert.ok(outside.every((line) => line.endsWith("(monospace)")));
});

test("the face has every character a legend or a lit key sets", () => {
  const characters = new Set();
  for (const { typed } of drawEverything(drawKeyHint, drawKeyIndicator, legends, keys)) {
    for (const { text } of typed) for (const character of String(text)) characters.add(character);
  }
  // The thirty the legends set today: twenty-two lower-case letters (no j, q, x or z), K
  // and R, space, slash, semicolon, the middle dot between controls and the two arrows.
  assert.equal(characters.size, 30);
  const { tables } = woff2Contents(fontBytes);
  const mapped = cmapCodePoints(tables.find(({ tag }) => tag === "cmap").data);
  const missing = [...characters].filter((character) => !mapped.has(character.codePointAt(0)));
  assert.deepEqual(missing, []);
  // And the margin it was cut with: printable ASCII, the middle dot and four arrows.
  assert.equal(mapped.size, 100);
  for (let point = 0x20; point <= 0x7e; point += 1) assert.ok(mapped.has(point), `U+${point.toString(16)}`);
  for (const point of [0xb7, 0x2190, 0x2191, 0x2192, 0x2193]) assert.ok(mapped.has(point), `U+${point.toString(16)}`);
});

test("a face that fails to load leaves the page running, in the browser's sans-serif", async () => {
  const errors = [];
  const added = [];
  const fonts = { add: (face) => added.push(face) };
  const page = { fonts };
  const log = { error: (message) => errors.push(message) };
  class Refusing {
    constructor(family, source) {
      this.family = family;
      this.source = source;
    }
    load() {
      return Promise.reject(new Error("NetworkError"));
    }
  }
  // Resolves rather than throws, so the module's own await never stops the sketch.
  assert.equal(await loadHintFace({ FontFace: Refusing, document: page, console: log }), "failed");
  assert.equal(added.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /sans-serif/u);
  // A face that cannot even be constructed fails the same way.
  class Unbuildable {
    constructor() {
      throw new SyntaxError("bad source");
    }
  }
  assert.equal(await loadHintFace({ FontFace: Unbuildable, document: page, console: log }), "failed");
  assert.equal(errors.length, 2);

  // The legend still draws, asking for the face and then the sans-serif it falls back to.
  const sketch = recordingSketch();
  const bounds = drawKeyHint(sketch, legends.get("still-there"), 680, 680);
  assert.ok(sketch.typed.length > 0);
  assert.ok(sketch.typed.every(({ font }) => font === HINT_FONT));
  assert.equal(HINT_FONT.split(",").at(-1).trim(), "sans-serif");
  // Outside a browser there is nothing to load into, and the legend says so.
  assert.equal(bounds.face, "absent");

  // A face that loads is added under the family every legend asks for, from the file here.
  class Loading extends Refusing {
    load() {
      return Promise.resolve(this);
    }
  }
  assert.equal(await loadHintFace({ FontFace: Loading, document: page, console: log }), "loaded");
  assert.equal(added.length, 1);
  assert.equal(added[0].family, HINT_FACE);
  assert.equal(added[0].source, `url("${HINT_FACE_FILE.href}")`);
});

test("a card or a clip is never written in a fallback face", () => {
  assert.equal(hintFaceRefusal("still-there", "loaded"), null);
  // A page without a legend module records nothing and is asked nothing.
  assert.equal(hintFaceRefusal("lorenz", undefined), null);
  for (const status of ["failed", "absent", "unrecorded"]) {
    assert.match(hintFaceRefusal("still-there", status), new RegExp(`^still-there: .*${status}`, "u"));
  }
});

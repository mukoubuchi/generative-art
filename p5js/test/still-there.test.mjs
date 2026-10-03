import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SIZE, HALF, COUNT, STEP_SECONDS, FPS, TOTAL_FRAMES, DEMO_KEYS, KEY_CAPS,
  initialPositions, permute, movingPoint, Loom, demoAt, keydownAction, tessera
} from "../artworks/still-there/lattice.js";
import { loadCatalog } from "../lib/catalog.mjs";
import { eligibleArtworks } from "../lib/selection.mjs";

const INITIAL = initialPositions();

// This witness multiplies the combined matrices in centred residues -63..63. It neither
// calls the artwork's wrap helper nor performs its sequential shear updates.
function matrixWitness(positions, [a, b, c, d]) {
  const out = new Int16Array(positions.length);
  for (let i = 0; i < out.length; i += 2) {
    const x = positions[i];
    const y = positions[i + 1];
    const u = a * x + b * y;
    const v = c * x + d * y;
    out[i] = u - SIZE * Math.floor((u + HALF) / SIZE);
    out[i + 1] = v - SIZE * Math.floor((v + HALF) / SIZE);
  }
  return out;
}

function assertPermutation(positions) {
  const occupants = new Uint8Array(COUNT);
  for (let i = 0; i < positions.length; i += 2) {
    const [x, y] = positions.subarray(i, i + 2);
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
    assert.ok(x >= -HALF && x <= HALF && y >= -HALF && y <= HALF);
    occupants[(y + HALF) * SIZE + x + HALF] += 1;
  }
  assert.ok(occupants.every((count) => count === 1));
}

test("both integer shears agree with independent matrix multiplication over every cell", () => {
  assert.equal(COUNT, 16129);
  // Each step's determinant, read off what the shears do to the two unit vectors: 1 mod 127.
  for (const direction of [1, -1]) {
    const [a, c] = permute(Int16Array.of(1, 0), direction);
    const [b, d] = permute(Int16Array.of(0, 1), direction);
    assert.equal(((a * d - b * c) % SIZE + SIZE) % SIZE, 1);
  }
  assert.deepEqual(permute(INITIAL, 1), matrixWitness(INITIAL, [1, 1, 1, 2]));
  assert.deepEqual(permute(INITIAL, -1), matrixWitness(INITIAL, [2, -1, -1, 1]));
  assertPermutation(permute(INITIAL, 1));
  assertPermutation(permute(INITIAL, -1));
});

test("the inverse restores every labelled cell in either order without saved states", () => {
  for (const direction of [-1, 1]) {
    let positions = INITIAL;
    for (let i = 0; i < 513; i += 1) positions = permute(positions, direction);
    assert.notDeepEqual(positions, INITIAL);
    for (let i = 0; i < 513; i += 1) positions = permute(positions, -direction);
    assert.deepEqual(positions, INITIAL);
  }
});

test("a step shows the row shear first and the column shear second; the inverse, the other way", () => {
  // Forward: rows slide horizontally in the first half, columns vertically in the second.
  // The inverse undoes them in the opposite order: columns first, then rows.
  const sample = [[-63, 5], [0, 0], [12, -40], [63, 63], [-7, 31]];
  for (const [x, y] of sample) {
    const [forwardX] = [...permute(Int16Array.of(x, y), 1)];
    const [, inverseY] = [...permute(Int16Array.of(x, y), -1)];
    for (const progress of [0.05, 0.2, 0.35, 0.5]) {
      assert.equal(movingPoint(x, y, 1, progress)[1], y, `forward ${x},${y} moved vertically at ${progress}`);
      assert.equal(movingPoint(x, y, -1, progress)[0], x, `inverse ${x},${y} moved horizontally at ${progress}`);
    }
    for (const progress of [0.5, 0.65, 0.8, 0.95, 1]) {
      assert.equal(movingPoint(x, y, 1, progress)[0], forwardX, `forward ${x},${y} still moving horizontally at ${progress}`);
      assert.equal(movingPoint(x, y, -1, progress)[1], inverseY, `inverse ${x},${y} still moving vertically at ${progress}`);
    }
  }
  // And in each half something does move, for a point off the axes.
  assert.notEqual(movingPoint(12, -40, 1, 0.25)[0], 12);
  assert.notEqual(movingPoint(12, -40, 1, 0.75)[1], -40);
});

test("the displayed shears reach the exact integer endpoints", () => {
  const positions = permute(INITIAL, 1);
  for (const direction of [-1, 1]) {
    const destination = matrixWitness(positions, direction === 1 ? [1, 1, 1, 2] : [2, -1, -1, 1]);
    for (let i = 0; i < positions.length; i += 2) {
      assert.deepEqual(movingPoint(positions[i], positions[i + 1], direction, 0), [...positions.subarray(i, i + 2)]);
      assert.deepEqual(movingPoint(positions[i], positions[i + 1], direction, 1), [...destination.subarray(i, i + 2)]);
    }
  }
});

test("rapid presses and direction changes keep every command and finish on the lattice", () => {
  const loom = new Loom();
  const keys = [...Array(12).fill("ArrowRight"), ...Array(12).fill("ArrowLeft")];
  for (const key of keys) { loom.key(key); loom.advance(0.03); }
  // Every press is one whole step: twelve out, then twelve back, one after another.
  const visited = [loom.steps];
  for (let time = 0; time < STEP_SECONDS * keys.length; time += 0.05) {
    loom.advance(0.05);
    if (loom.steps !== visited.at(-1)) visited.push(loom.steps);
  }
  assert.deepEqual(visited, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.equal(loom.steps, 0);
  assert.equal(loom.active, false);
  assert.equal(loom.queue.length, 0);
  assert.deepEqual(loom.positions, INITIAL);
});

test("pausing repetition completes the current permutation and stays still", () => {
  const loom = new Loom();
  loom.key(" ");
  loom.advance(STEP_SECONDS * 2.4);
  loom.key(" ");
  loom.advance(STEP_SECONDS);
  assert.equal(loom.steps, 3);
  assert.equal(loom.active, false);
  assert.equal(loom.running, false);
  assertPermutation(loom.positions);
  const stopped = loom.positions.slice();
  loom.advance(100);
  assert.deepEqual(loom.positions, stopped);
});

test("reset cancels a partial shear, repetition, and queued commands", () => {
  const loom = new Loom();
  loom.key(" "); loom.advance(0.73); loom.key("ArrowLeft"); loom.key("R");
  loom.advance(9);
  assert.deepEqual(loom.positions, INITIAL);
  assert.equal(loom.steps, 0);
  assert.equal(loom.active, false);
  assert.equal(loom.running, false);
  assert.deepEqual(loom.queue, []);
});

test("R or r after whole steps restores the original lattice and its count", () => {
  for (const reset of ["R", "r"]) {
    const loom = new Loom();
    loom.key("ArrowRight"); loom.key("ArrowRight"); loom.key("ArrowLeft");
    loom.advance(STEP_SECONDS * 2.5);
    assert.equal(loom.steps, 2);
    assert.notDeepEqual(loom.positions, INITIAL);
    assert.equal(loom.key(reset), true);
    assert.deepEqual(loom.positions, INITIAL);
    assert.equal(loom.steps, 0);
    assert.equal(loom.active, false);
    assert.deepEqual(loom.queue, []);
  }
});

test("all film frames retain a permutation and the inverse returns before reset", () => {
  let scattered = false;
  let restored = null;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const { loom } = demoAt(frame);
    assertPermutation(loom.positions);
    if (loom.steps === 4) scattered = true;
    if (scattered && restored === null && loom.steps === 0 && loom.positions.every((value, index) => value === INITIAL[index])) {
      restored = frame;
    }
    if (frame >= 517 && frame < 570) {
      assert.equal(loom.steps, 0);
      assert.equal(loom.active, false);
      assert.deepEqual(loom.positions, INITIAL);
    }
  }
  assert.ok(scattered);

  // The return is the inverse's, not the reset's. The film presses reset once, last, and
  // only after the lattice is already whole again ...
  const resets = DEMO_KEYS.filter(([, key]) => key === "r" || key === "R");
  assert.equal(resets.length, 1);
  assert.equal(DEMO_KEYS.at(-1), resets[0]);
  assert.ok(restored !== null && restored / FPS < resets[0][0], `whole again at frame ${restored}, reset at ${resets[0][0]} s`);
  // ... and the same presses with the reset taken out leave it whole all the same.
  const loom = new Loom();
  let time = 0;
  for (const [at, key] of DEMO_KEYS.filter((entry) => entry !== resets[0])) {
    loom.advance(at - time);
    loom.key(key);
    time = at;
  }
  loom.advance((TOTAL_FRAMES - 1) / FPS - time);
  assert.equal(loom.steps, 0);
  assert.deepEqual(loom.positions, INITIAL);
});

test("the film marks each pressed key with the cap the page's legend sets it in", () => {
  // The legend's caps, as the sketch writes them.
  const sketch = readFileSync(new URL("../artworks/still-there/sketch.js", import.meta.url), "utf8");
  const legend = sketch.slice(sketch.indexOf("const HINT_LEGEND"), sketch.indexOf("];", sketch.indexOf("const HINT_LEGEND")));
  const caps = [...legend.matchAll(/cap: "([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(caps, ["←", "→", "space", "R"]);
  // Every key the loom answers to, and only those, has a cap, and every cap is the legend's.
  const answered = ["ArrowLeft", "ArrowRight", " ", "r", "R", "ArrowUp", "Enter", "x"].filter((key) => new Loom().key(key));
  assert.deepEqual(Object.keys(KEY_CAPS).sort(), answered.sort());
  assert.deepEqual([...new Set(Object.values(KEY_CAPS))].sort(), [...caps].sort());
  assert.equal(KEY_CAPS[" "], "space");
  // And the sketch labels the mark from this table rather than from a guess of its own.
  assert.match(sketch, /drawKeyIndicator\(p, \[\{ label: KEY_CAPS\[pressedKey\], active: true \}\]/u);
});

test("the page leaves shortcuts to the browser, swallows held-key repeats, and steps both ways", () => {
  for (const key of ["ArrowLeft", "ArrowRight", " ", "r", "R"]) {
    assert.equal(keydownAction({ key }), "press", key);
    assert.equal(keydownAction({ key, repeat: true }), "swallow", key);
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      assert.equal(keydownAction({ key, [modifier]: true }), "ignore", `${modifier}+${key}`);
    }
  }
  for (const key of ["ArrowUp", "ArrowDown", "Enter", "Tab", "x", "PageDown"]) assert.equal(keydownAction({ key }), "ignore", key);
  // Left steps back and Right forward, from wherever the loom is.
  const loom = new Loom();
  loom.key("ArrowLeft"); loom.advance(STEP_SECONDS);
  assert.equal(loom.steps, -1);
  loom.key("ArrowRight"); loom.advance(STEP_SECONDS);
  loom.key("ArrowRight"); loom.advance(STEP_SECONDS);
  assert.equal(loom.steps, 1);
  // And the page's handler is this decision and nothing else.
  const sketch = readFileSync(new URL("../artworks/still-there/sketch.js", import.meta.url), "utf8");
  assert.match(sketch, /const action = keydownAction\(event\);\n {4}if \(action === "ignore"\) return;\n {4}event\.preventDefault\(\);\n {4}if \(action === "swallow"\) return;\n {4}loom\.key\(event\.key\);/u);
});

test("a tile keeps its own colour wherever the shears carry it", () => {
  // The colours belong to the tiles' original places: all 16,129 of them, pinned.
  const colours = Array.from({ length: COUNT }, (_, index) => tessera(index).colour);
  assert.equal(createHash("sha256").update(colours.join(";")).digest("hex"), "2b62beadadc2d1e4f7d89b298987e7c0267875b50c0870f976a1e1d40978cebc");
  // And the sketch draws tile i in tile i's colour at tile i's position, whatever the step.
  const sketch = readFileSync(new URL("../artworks/still-there/sketch.js", import.meta.url), "utf8");
  assert.match(sketch, /const TESSERAE = Array\.from\(\{ length: COUNT \}, \(_, index\) => tessera\(index\)\);/u);
  assert.match(sketch, /const tile = TESSERAE\[i\];\n {6}let x = state\.positions\[i \* 2\];\n {6}let y = state\.positions\[i \* 2 \+ 1\];/u);
  assert.match(sketch, /ctx\.fillStyle = tile\.colour;/u);
});

test("the legend says what each key does, and the notes print the same line", () => {
  const sketch = readFileSync(new URL("../artworks/still-there/sketch.js", import.meta.url), "utf8");
  const legend = sketch.slice(sketch.indexOf("const HINT_LEGEND"), sketch.indexOf("];", sketch.indexOf("const HINT_LEGEND")));
  const entries = [...legend.matchAll(/\{ cap: "([^"]+)", text: "([^"]+)" \}/gu)].map(([, cap, text]) => [cap, text]);
  assert.deepEqual(entries, [["←", "back"], ["→", "forward"], ["space", "run / pause"], ["R", "reset"]]);
  // Each word is what its key does to the loom.
  const step = (key) => { const loom = new Loom(); loom.key(key); loom.advance(STEP_SECONDS); return loom; };
  assert.equal(step("ArrowLeft").steps, -1);
  assert.equal(step("ArrowRight").steps, 1);
  const running = new Loom(); running.key(" "); assert.equal(running.running, true);
  running.key(" "); assert.equal(running.running, false);
  // The README's row prints the legend's own line.
  const notes = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const line = entries.map(([cap, text]) => `\`${cap}\` ${text}`).join(" · ");
  assert.ok(notes.includes(`| \`still-there\` | arrow keys, Space, R | ${line} |`), line);
});

test("Still There uses FitzGerald's sourced first-edition quatrain, with public-domain eligibility", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const artwork = manifest.artworks.find((entry) => entry.id === "still-there");
  assert.deepEqual(artwork.quoteIds, ["khayyam-moving-finger"]);
  const quote = quoteCatalog.quotes.find((entry) => entry.id === artwork.quoteIds[0]);
  assert.equal(quote.text, "The Moving Finger writes; and, having writ,\nMoves on: nor all thy Piety nor Wit\nShall lure it back to cancel half a Line,\nNor all thy Tears wash out a Word of it.");
  assert.equal(quote.author, "Omar Khayyam");
  assert.equal(quote.source, "Rubaiyat");
  assert.equal(quote.year, null);
  assert.equal(quote.sourceUrl, "https://www.gutenberg.org/files/246/246-h/246-h.htm");
  assert.equal(quote.publicDomain, true);
  assert.ok(eligibleArtworks(manifest, quoteCatalog).some(({ artwork }) => artwork.id === "still-there"));
  const rejected = eligibleArtworks({ artworks: [artwork] }, {
    quotes: [{ ...quote, publicDomain: false }]
  }, () => {});
  assert.deepEqual(rejected, []);
});

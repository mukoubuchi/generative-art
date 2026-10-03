import assert from "node:assert/strict";
import test from "node:test";
import {
  SIZE, HALF, COUNT, STEP_SECONDS, FPS, TOTAL_FRAMES, DEMO_KEYS,
  initialPositions, permute, movingPoint, Loom, demoAt
} from "../artworks/still-there/lattice.js";
import { loadCatalog } from "../lib/catalog.mjs";
import { eligibleArtworks } from "../lib/selection.mjs";

const INITIAL = initialPositions();

// This witness multiplies the combined matrices in residues 0..126. It neither
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
  assert.equal(1 * 2 - 1 * 1, 1);
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

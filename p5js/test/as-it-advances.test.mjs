import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SIZE, FPS, DURATION, FRAMES, GROWTH_FRAMES, POINTS, GRID,
  makeWorld, cloneWorld, advance, makeHistory, pageFrame, growthFrame
} from "../artworks/as-it-advances/growth.js";

const { contours } = makeHistory();
function distance(a, b) {
  let sum = 0, maximum = 0;
  for (let i = 0; i < POINTS; i += 1) {
    const d = Math.hypot(a[2 * i] - b[2 * i], a[2 * i + 1] - b[2 * i + 1]);
    sum += d * d;
    maximum = Math.max(maximum, d);
  }
  return { rms: Math.sqrt(sum / POINTS), maximum };
}

/** Compare drawn shapes, regardless of which material label occupies a position. */
function distanceToContour(points, contour) {
  let sum = 0, maximum = 0;
  for (let i = 0; i < POINTS; i += 1) {
    const x = points[2 * i], y = points[2 * i + 1];
    let nearest = Infinity;
    for (let j = 0; j < POINTS; j += 1) {
      const k = (j + 1) % POINTS;
      const ax = contour[2 * j], ay = contour[2 * j + 1];
      const dx = contour[2 * k] - ax, dy = contour[2 * k + 1] - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    sum += nearest * nearest;
    maximum = Math.max(maximum, nearest);
  }
  return { rms: Math.sqrt(sum / POINTS), maximum };
}

test("the entire growth fits, stays finite, and moves continuously", () => {
  assert.equal(contours.length, GROWTH_FRAMES + 1);
  for (let f = 0; f < contours.length; f += 1) {
    assert.equal(contours[f].length, 2 * POINTS);
    for (const value of contours[f]) {
      assert.ok(Number.isFinite(value));
      assert.ok(value > 40 && value < SIZE - 40, `frame ${f}: ${value}`);
    }
    if (f > 0) assert.ok(distance(contours[f], contours[f - 1]).maximum <= 0.7500000001);
  }
});

test("the deposited history persists in its finite field, without overwriting old contours", () => {
  const world = makeWorld();
  const first = world.points.slice();
  for (let i = 0; i < 300; i += 1) advance(world);
  const memory = world.memory.slice();
  assert.equal(memory.length, GRID * GRID);
  assert.ok(memory.some((value) => value > 1));
  for (let i = 0; i < 100; i += 1) advance(world);
  for (let i = 0; i < memory.length; i += 1) assert.ok(world.memory[i] >= memory[i]);
  assert.deepEqual(contours[0], first);
});

test("identical fronts with different histories develop materially different geometry", () => {
  const lived = makeWorld();
  for (let i = 0; i < 300; i += 1) advance(lived);
  const same = cloneWorld(lived);
  const erased = cloneWorld(lived, { eraseMemory: true });
  assert.deepEqual(lived.points, erased.points);
  assert.equal(lived.step, erased.step);
  for (let i = 0; i < 200; i += 1) {
    advance(lived); advance(same); advance(erased);
  }
  assert.deepEqual(lived.points, same.points);
  const difference = distance(lived.points, erased.points);
  assert.ok(difference.rms > 10, JSON.stringify(difference));
  assert.ok(difference.maximum > 50, JSON.stringify(difference));
  for (const [a, b] of [[lived.points, erased.points], [erased.points, lived.points]]) {
    const shapeDifference = distanceToContour(a, b);
    assert.ok(shapeDifference.rms > 5, JSON.stringify(shapeDifference));
    assert.ok(shapeDifference.maximum > 25, JSON.stringify(shapeDifference));
  }
  // Relabelling an unchanged curve must not pass the geometric difference check.
  const shifted = Float64Array.from([
    ...lived.points.slice(128), ...lived.points.slice(0, 128)
  ]);
  assert.ok(distance(lived.points, shifted).rms > 10);
  assert.ok(distanceToContour(lived.points, shifted).maximum < 1e-10);
});

test("removing memory's force defeats the history experiment", () => {
  const lived = makeWorld();
  for (let i = 0; i < 300; i += 1) advance(lived);
  const erased = cloneWorld(lived, { eraseMemory: true });
  // This is the negative intervention: deposit still exists, but cannot drive motion.
  for (let i = 0; i < 200; i += 1) {
    advance(lived, { memoryStrength: 0 });
    advance(erased, { memoryStrength: 0 });
  }
  assert.deepEqual(lived.points, erased.points);
});

test("growth is deterministic and the presentation holds instead of erasing its past", () => {
  const again = makeHistory().contours;
  assert.deepEqual(again, contours);
  assert.equal(FRAMES, FPS * DURATION);
  assert.equal(pageFrame(0), 0);
  assert.equal(pageFrame(10), 300);
  assert.equal(pageFrame(24), FRAMES - 1);
  assert.equal(pageFrame(10000), FRAMES - 1);
  for (let f = GROWTH_FRAMES; f < FRAMES; f += 1) assert.equal(growthFrame(f), GROWTH_FRAMES);
});

test("the catalog pairs the work with the verified Bergson passage", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url)));
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url)));
  const artwork = manifest.artworks.find(({ id }) => id === "as-it-advances");
  const quote = catalog.quotes.find(({ id }) => id === "bergson-duration");
  assert.deepEqual(artwork.quoteIds, [quote.id]);
  assert.equal(artwork.render.durationSeconds, DURATION);
  assert.deepEqual(artwork.canvas, { width: SIZE, height: SIZE });
  assert.equal(quote.text, "Duration is the continuous progress of the past which gnaws into the future and which swells as it advances.");
  assert.equal(quote.author, "Henri Bergson");
  assert.equal(quote.year, 1907);
  const notes = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(notes, /Arthur Mitchell/);
  assert.match(notes, /artistic extension/);
});

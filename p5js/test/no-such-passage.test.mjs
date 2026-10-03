import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  BRIDGES, EXTENDED_BRIDGES, FAILED_TRAILS, COMPLETE_TRAIL,
  THREADS, SOLO_INDICES, EYELETS, TOTAL_FRAMES, LOGICAL_SIZE,
  degrees, enumerateTrails, traceEdges, pointAt, sceneAt
} from "../artworks/no-such-passage/network.js";

/** Independent oracle: permute edge labels first, then try each starting region. */
function countCompletePermutations(edges) {
  let count = 0;
  const permutation = Array.from({ length: edges.length }, (_, index) => index);
  function permute(at) {
    if (at === permutation.length) {
      for (let start = 0; start < 4; start += 1) {
        let current = start;
        let legal = true;
        for (const id of permutation) {
          const [a, b] = edges[id];
          if (current === a) current = b;
          else if (current === b) current = a;
          else { legal = false; break; }
        }
        if (legal) count += 1;
      }
      return;
    }
    for (let other = at; other < permutation.length; other += 1) {
      [permutation[at], permutation[other]] = [permutation[other], permutation[at]];
      permute(at + 1);
      [permutation[at], permutation[other]] = [permutation[other], permutation[at]];
    }
  }
  permute(0);
  return count;
}

test("the seven distinct bridges have four odd regions; the added bridge leaves two", () => {
  assert.deepEqual(degrees(BRIDGES), [5, 3, 3, 3]);
  assert.deepEqual(degrees(EXTENDED_BRIDGES), [5, 4, 4, 3]);
  for (const edges of [BRIDGES, EXTENDED_BRIDGES]) {
    assert.equal(degrees(edges).reduce((sum, degree) => sum + degree, 0), 2 * edges.length);
  }
  assert.deepEqual(EXTENDED_BRIDGES.slice(0, 7), BRIDGES);
  assert.deepEqual(EXTENDED_BRIDGES[7], [1, 2]);
});

test("permuting every edge independently confirms impossibility and the open-trail control", () => {
  assert.equal(countCompletePermutations(BRIDGES), 0);
  assert.equal(countCompletePermutations(EXTENDED_BRIDGES), 416);
  const complete = enumerateTrails(EXTENDED_BRIDGES).filter(trail => trail.edges.length === 8);
  assert.equal(complete.length, 416);
  assert.ok(complete.every(trail => trail.vertices[0] !== trail.vertices.at(-1)));
  assert.ok(complete.every(trail => [0, 3].includes(trail.vertices[0]) && [0, 3].includes(trail.vertices.at(-1))));
});

test("every silver thread is a distinct legal walk, stopped where its end has no unused bridge", () => {
  const histogram = {};
  const signatures = new Set();
  for (const trail of FAILED_TRAILS) {
    const used = new Set();
    assert.equal(trail.vertices.length, trail.edges.length + 1);
    trail.edges.forEach((id, index) => {
      assert.ok(!used.has(id));
      used.add(id);
      assert.deepEqual(new Set(BRIDGES[id]), new Set([trail.vertices[index], trail.vertices[index + 1]]));
    });
    // An unfinished route may not stop while an unused incident bridge remains.
    assert.ok(BRIDGES.every(([a, b], id) => used.has(id) || (a !== trail.vertices.at(-1) && b !== trail.vertices.at(-1))));
    assert.ok(used.size < BRIDGES.length);
    histogram[used.size] = (histogram[used.size] ?? 0) + 1;
    signatures.add(`${trail.vertices[0]}:${trail.edges.join(",")}`);
  }
  assert.deepEqual(histogram, { 3: 4, 4: 24, 5: 88, 6: 256 });
  assert.equal(signatures.size, 372);
  assert.equal(THREADS.length, signatures.size);
  assert.equal(new Set(THREADS.map(thread => thread.lane)).size, 372);
  assert.deepEqual(THREADS.map(thread => thread.trail), FAILED_TRAILS);
});

test("the warm traversal uses eight bridges once and has two different ends", () => {
  assert.deepEqual(COMPLETE_TRAIL.vertices, [0, 1, 0, 2, 0, 3, 1, 2, 3]);
  assert.equal(COMPLETE_TRAIL.mask, 255);
  assert.equal(new Set(COMPLETE_TRAIL.edges).size, 8);
  assert.throws(() => traceEdges(BRIDGES, 0, COMPLETE_TRAIL.edges), /existing/);
  assert.throws(() => traceEdges(EXTENDED_BRIDGES, 0, [0, 0]), /distinct/);
  assert.throws(() => traceEdges(EXTENDED_BRIDGES, 0, [0, 6]), /jump/);
});

test("the first failed walks have a readable hold with an unused bridge elsewhere", () => {
  for (const [index, startFrame, endFrame] of [[SOLO_INDICES[0], 132, 177], [SOLO_INDICES[1], 297, 327]]) {
    const trail = THREADS[index].trail;
    assert.equal(trail.edges.length, 6);
    const omitted = BRIDGES.filter((_, id) => !trail.edges.includes(id));
    assert.equal(omitted.length, 1);
    assert.ok(!omitted[0].includes(trail.vertices.at(-1)));
    for (let frame = startFrame; frame <= endFrame; frame += 1) assert.equal(sceneAt(frame).threadProgress[index], 1);
  }
  assert.ok(sceneAt(144).threadProgress.every((progress, index) => progress === (index === SOLO_INDICES[0] ? 1 : 0)));
  assert.ok(sceneAt(450).threadProgress.every(progress => progress === 1));
});

test("the added bridge is present before the successful traversal; seeking is stateless", () => {
  const last = sceneAt(TOTAL_FRAMES - 1);
  const forward = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scene = sceneAt(frame);
    assert.equal(scene.frameIndex, frame);
    if (scene.crossing > 0) assert.equal(scene.addedBridge, 1);
    if (scene.completed) assert.equal(scene.crossing, 1);
    forward.push(scene);
  }
  assert.equal(last.completed, true);
  // Every frame read again, in the opposite order, is the same scene: what a frame shows
  // depends on its index alone, not on which frames were read before it or how often.
  for (let frame = TOTAL_FRAMES - 1; frame >= 0; frame -= 1) {
    assert.deepEqual(sceneAt(frame), forward[frame]);
  }
  assert.equal(sceneAt(-1).frameIndex, 0);
  assert.equal(sceneAt(TOTAL_FRAMES + 9).frameIndex, TOTAL_FRAMES - 1);
});

test("all embedded silver trails stay continuous and inside the canvas", () => {
  for (const { path, trail } of THREADS) {
    assert.ok(path.length > 0);
    assert.equal(path.lengths[0], 0);
    path.points.forEach((point, index) => {
      assert.ok(point.x > 15 && point.x < LOGICAL_SIZE - 15);
      assert.ok(point.y > 15 && point.y < LOGICAL_SIZE - 15);
      if (index > 0) assert.ok(path.lengths[index] - path.lengths[index - 1] < 16, "a fibre has a disconnected jump");
    });
    for (const [point, vertex] of [[path.points[0], trail.vertices[0]], [path.points.at(-1), trail.vertices.at(-1)]]) {
      const node = EYELETS[vertex];
      assert.ok(Math.abs(Math.hypot(point.x - node.x, point.y - node.y) - node.radius) < 9.1);
    }
    const first = pointAt(path, 0), last = pointAt(path, path.length);
    assert.equal(first.x, path.points[0].x);
    assert.equal(first.y, path.points[0].y);
    assert.ok(Math.hypot(last.x - path.points.at(-1).x, last.y - path.points.at(-1).y) < 1e-10);
  }
});

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));

test("the quotation names Euler's paper by its English title, with no date on the card", () => {
  // The paper is E53, Solutio problematis ad geometriam situs pertinentis. "Geometry of
  // Position" alone named its subject as though it were a title, and a book of that name
  // exists by someone else (Carnot, 1803).
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "no-such-passage");
  const quote = CATALOG.quotes.find((entry) => entry.id === "euler-no-such-passage");
  assert.deepEqual(artwork.quoteIds, ["euler-no-such-passage"]);
  assert.equal(quote.author, "Leonhard Euler");
  assert.equal(quote.source, "Solution of a Problem Relating to the Geometry of Position, §20");
  assert.equal(quote.original.source, "Solutio problematis ad geometriam situs pertinentis, §20");
  assert.equal(quote.year, 1741);

  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">No Such Passage</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<cite class="card__cite">—&nbsp;<b>Leonhard Euler<\/b>, Solution of a Problem Relating to the Geometry of Position, §20<\/cite>/u);
  assert.doesNotMatch(card, /1741/u);

  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 225);
  assert.ok(body.includes("— Leonhard Euler, Solution of a Problem Relating to the Geometry of Position, §20\n"));
  assert.doesNotMatch(body, /1741/u);
});

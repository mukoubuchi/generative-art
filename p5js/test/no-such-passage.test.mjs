import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  BRIDGES, EXTENDED_BRIDGES, FAILED_TRAILS, COMPLETE_TRAIL,
  THREADS, SOLO_INDICES, EYELETS, TOTAL_FRAMES, LOGICAL_SIZE, BRIDGE_PATHS, GOLD_THREADS,
  DURATION_SECONDS, PLAYBACK_FPS,
  bridgePoints, degrees, enumerateTrails, pageFrame, traceEdges, pointAt, sceneAt, soloOpacity
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

test("the warm ribbon is 33 continuous copies of the open trail, the middle one along every bridge", () => {
  const continuousInside = (path) => {
    path.points.forEach((point, index) => {
      assert.ok(point.x > 15 && point.x < LOGICAL_SIZE - 15 && point.y > 15 && point.y < LOGICAL_SIZE - 15);
      if (index > 0) assert.ok(path.lengths[index] - path.lengths[index - 1] < 16, "a gold fibre has a disconnected jump");
    });
  };
  assert.equal(GOLD_THREADS.length, 33);
  GOLD_THREADS.forEach(continuousInside);
  // The middle thread runs the full curve of each of the eight bridges, in the trail's order.
  const heart = GOLD_THREADS[16];
  const at = new Map(heart.points.map((point, index) => [`${point.x},${point.y}`, index]));
  let previous = -1;
  for (const edge of COMPLETE_TRAIL.edges) {
    const indices = bridgePoints(edge, 0).map((point) => at.get(`${point.x},${point.y}`));
    assert.ok(indices.every((index) => index !== undefined), `the heart misses part of bridge ${edge}`);
    assert.ok(Math.min(...indices) > previous, `bridge ${edge} is not crossed after the one before it`);
    previous = Math.max(...indices);
  }
  // And the eight bridges themselves are drawn whole.
  assert.equal(BRIDGE_PATHS.length, 8);
  BRIDGE_PATHS.forEach((path, edge) => {
    continuousInside(path);
    assert.deepEqual(path.points, bridgePoints(edge));
  });
});

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

test("the woven threads all move at 1000 px a second and are whole before the history fades", () => {
  const progress = (frame, index) => sceneAt(frame).threadProgress[index];
  let measured = 0;
  THREADS.forEach(({ path }, index) => {
    if (SOLO_INDICES.includes(index)) return;
    let done = null;
    for (let frame = 0; frame < TOTAL_FRAMES - 1; frame += 1) {
      const now = progress(frame, index);
      const next = progress(frame + 1, index);
      if (now > 0 && next < 1) {
        assert.ok(Math.abs((next - now) * path.length * PLAYBACK_FPS - 1000) < 1e-6, `thread ${index} changes speed`);
        measured += 1;
      }
      if (done === null && now === 1) done = frame;
    }
    // Every woven thread is whole before the history begins to fade at 15 s.
    assert.ok(done !== null && done / PLAYBACK_FPS < 15, `thread ${index} is not whole by 15 s`);
  });
  assert.ok(measured > 3000, "the speed was measured on enough frames to mean something");
});

test("the two solo walks start on opposite sides, finish while whole, then fade by 12.2 s", () => {
  assert.deepEqual(SOLO_INDICES.map((index) => THREADS[index].trail.vertices[0]), [0, 3]);
  const finishes = SOLO_INDICES.map((index) => {
    for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
      if (sceneAt(frame).threadProgress[index] === 1) return frame / PLAYBACK_FPS;
    }
    return null;
  });
  assert.deepEqual(finishes.map((seconds) => seconds.toFixed(2)), ["4.30", "9.80"]);
  // Readable through the walks and their hold, then gone as the weave takes over.
  for (let seconds = 0; seconds <= 11; seconds += 0.25) assert.ok(soloOpacity(seconds) > 1 - 1e-12);
  assert.equal(soloOpacity(12.2), 0);
  for (let seconds = 11; seconds < 12.2; seconds += 0.1) assert.ok(soloOpacity(seconds + 0.1) <= soloOpacity(seconds));
});

test("the open passage is complete by the thumbnail frame and the page holds it", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "no-such-passage");
  const first = Array.from({ length: TOTAL_FRAMES }, (_, frame) => frame).find((frame) => sceneAt(frame).completed);
  assert.equal(first, artwork.thumbnail.frame);
  const drawn = (scene) => ({ ...scene, frameIndex: 0, seconds: 0 });
  assert.deepEqual(drawn(sceneAt(first)), drawn(sceneAt(TOTAL_FRAMES - 1)));
  assert.equal(pageFrame(0), 0);
  assert.equal(pageFrame(1), PLAYBACK_FPS);
  assert.equal(pageFrame(DURATION_SECONDS), TOTAL_FRAMES - 1);
  assert.equal(pageFrame(1000), TOTAL_FRAMES - 1);
  const sketch = readFileSync(new URL("../artworks/no-such-passage/sketch.js", import.meta.url), "utf8");
  assert.match(sketch, /const frame = pageFrame\(\(performance\.now\(\) - startedAt\) \/ 1000\);\n {4}publishState\(drawFrame\(frame\)\);/u);
  assert.match(sketch, /if \(frame === TOTAL_FRAMES - 1\) p\.noLoop\(\);/u);
});

test("the manifest, notes and module agree on the clip", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "no-such-passage");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.render, { kind: "video", artifact: "exports/p5js/NoSuchPassage.mp4", durationSeconds: DURATION_SECONDS, scale: 2 });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.deepEqual(artwork.thumbnail, { frame: 795 });
  const notes = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(notes, /\| `no-such-passage` \| 720×720 \| 1440×1440 MP4 at 30 fps \| 28 seconds,/u);
  assert.match(notes, /No Such Passage turns Euler[\s\S]*?the thumbnail is frame 795\./u);
});

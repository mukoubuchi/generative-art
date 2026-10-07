import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  ACT_ONE_FRAMES, ACT_ONE_STEP_FRAMES, ACT_ONE_STEPS, CENTRE, DURATION_SECONDS, FIELD_RADIUS,
  HISTORY, LINK_COUNT, LOGICAL_SIZE, NODE_COUNT, PLAYBACK_FPS, SEED, SPACING, SWEEPS_PER_FRAME,
  TOTAL_FRAMES, WORLD,
  buildHistory, buildWorld, createRandom, exactStep, hashState, isUnanimous, neighbourLists,
  pageFrame, periodStart, sameState, sceneAt, voterSweep
} from "../artworks/by-misunderstanding/world.js";

/**
 * The numbers the clip is registered under, each measured by the test that holds it. A
 * change of seed, spacing, rule or sweep rate moves one of them, and the test says which.
 */
const REGISTERED = {
  nodes: 740,
  links: 2176,
  settles: 7,
  blinkers: 31,
  consensusSweep: 437,
  landingFrame: 616,
  winner: 0
};

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const ARTWORK = MANIFEST.artworks.find((entry) => entry.id === "by-misunderstanding");
const QUOTE = CATALOG.quotes.find((entry) => entry.id === "baudelaire-malentendu");

/** Whether two segments cross at a point interior to both: a planar drawing has none. */
function segmentsCross(p, q, r, s) {
  const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const o1 = orient(p, q, r), o2 = orient(p, q, s), o3 = orient(r, s, p), o4 = orient(r, s, q);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

test("the world is the registered one: this many nodes, no two closer than the spacing, all inside the field", () => {
  assert.equal(SEED, 117);
  assert.equal(SPACING, 15.5);
  assert.equal(NODE_COUNT, REGISTERED.nodes);
  assert.equal(WORLD.nodes.length, NODE_COUNT);
  let closest = Infinity;
  for (let i = 0; i < NODE_COUNT; i += 1) {
    const a = WORLD.nodes[i];
    assert.ok(Math.hypot(a.x - CENTRE, a.y - CENTRE) <= FIELD_RADIUS, `node ${i} lies outside the field`);
    for (let j = i + 1; j < NODE_COUNT; j += 1) {
      closest = Math.min(closest, Math.hypot(a.x - WORLD.nodes[j].x, a.y - WORLD.nodes[j].y));
    }
  }
  assert.ok(closest >= SPACING, `two nodes are ${closest} apart`);
  assert.ok(closest < 2 * SPACING, "the sweep found no pair at all");
  // The start is the generator's coin, not a pattern: both opinions, neither a sliver.
  const ones = WORLD.initial.reduce((sum, value) => sum + value, 0);
  assert.ok(ones > 0.4 * NODE_COUNT && ones < 0.6 * NODE_COUNT, `${ones} of ${NODE_COUNT} start as gold`);
});

test("the links are a Delaunay triangulation: planar, connected, with triangles, and no one-way link", () => {
  assert.equal(LINK_COUNT, REGISTERED.links);
  assert.equal(WORLD.links.length, LINK_COUNT);
  // Pin 4. The lists each node hears from are read both ways: a link in one list and not
  // the other would be a one-way link. The count is exactly zero, not small.
  const hears = WORLD.neighbours.map((list) => new Set(list));
  let oneWay = 0;
  let degreeSum = 0;
  for (let i = 0; i < NODE_COUNT; i += 1) {
    degreeSum += hears[i].size;
    assert.equal(hears[i].size, WORLD.neighbours[i].length, `node ${i} lists a neighbour twice`);
    assert.ok(!hears[i].has(i), `node ${i} hears itself`);
    for (const j of hears[i]) if (!hears[j].has(i)) oneWay += 1;
  }
  assert.equal(oneWay, 0);
  assert.equal(degreeSum, 2 * LINK_COUNT);
  for (const [a, b] of WORLD.links) {
    assert.ok(a < b, "a link is not stored smaller index first");
    assert.ok(hears[a].has(b) && hears[b].has(a));
  }
  assert.ok(WORLD.neighbours.every((list) => list.length >= 3), "a node with fewer than three neighbours");

  // Delaunay: no node strictly inside any triangle's circumcircle.
  assert.ok(WORLD.triangles.length > NODE_COUNT, "too few triangles for a triangulation of the disc");
  const linkKeys = new Set(WORLD.links.map(([a, b]) => `${a}:${b}`));
  for (const [a, b, c] of WORLD.triangles) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      assert.ok(linkKeys.has(u < v ? `${u}:${v}` : `${v}:${u}`), "a triangle's side is not a link");
    }
    const A = WORLD.nodes[a], B = WORLD.nodes[b], C = WORLD.nodes[c];
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const a2 = A.x ** 2 + A.y ** 2, b2 = B.x ** 2 + B.y ** 2, c2 = C.x ** 2 + C.y ** 2;
    const x = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d;
    const y = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d;
    const r2 = (A.x - x) ** 2 + (A.y - y) ** 2;
    for (let i = 0; i < NODE_COUNT; i += 1) {
      if (i === a || i === b || i === c) continue;
      const inside = (WORLD.nodes[i].x - x) ** 2 + (WORLD.nodes[i].y - y) ** 2;
      assert.ok(inside >= r2 * (1 - 1e-9), `node ${i} lies inside the circumcircle of ${a},${b},${c}`);
    }
  }

  // Planar: no two links cross between their ends.
  for (let p = 0; p < LINK_COUNT; p += 1) {
    const [a, b] = WORLD.links[p];
    for (let q = p + 1; q < LINK_COUNT; q += 1) {
      const [c, d] = WORLD.links[q];
      if (a === c || a === d || b === c || b === d) continue;
      assert.ok(!segmentsCross(WORLD.nodes[a], WORLD.nodes[b], WORLD.nodes[c], WORLD.nodes[d]),
        `links ${a}-${b} and ${c}-${d} cross`);
    }
  }

  // Connected: a walk from node 0 reaches every node. The voter rule's agreement needs this.
  const seen = new Uint8Array(NODE_COUNT);
  const queue = [0];
  seen[0] = 1;
  while (queue.length > 0) {
    const i = queue.pop();
    for (const j of WORLD.neighbours[i]) if (!seen[j]) { seen[j] = 1; queue.push(j); }
  }
  assert.equal(seen.reduce((sum, value) => sum + value, 0), NODE_COUNT);
});

test("exact hearing is a majority with the tie kept, and no vote is ever zero", () => {
  // A path of three: the ends each hear one voice, the middle hears two.
  const path = neighbourLists(3, [[0, 1], [1, 2]]);
  assert.deepEqual([...exactStep(Uint8Array.from([1, 0, 1]), path)], [0, 1, 0]);
  assert.deepEqual([...exactStep(Uint8Array.from([0, 1, 0]), path)], [1, 0, 1]);
  // The middle node hears one of each: a tie, so it keeps its own, whichever it is.
  assert.equal(exactStep(Uint8Array.from([1, 0, 0]), path)[1], 0);
  assert.equal(exactStep(Uint8Array.from([1, 1, 0]), path)[1], 1);
  // On the world, every vote 2 * (for - against) + own is odd, so none is zero.
  const state = WORLD.initial;
  for (let i = 0; i < NODE_COUNT; i += 1) {
    const ones = WORLD.neighbours[i].reduce((sum, j) => sum + state[j], 0);
    const vote = 2 * (2 * ones - WORLD.neighbours[i].length) + (state[i] === 1 ? 1 : -1);
    assert.equal(Math.abs(vote) % 2, 1);
  }
});

test("pin 1: exact hearing settles after a finite transient into a cycle of period at most two, and never agrees", () => {
  const { t0, cycle } = periodStart(WORLD.initial, WORLD.neighbours);
  assert.equal(t0, REGISTERED.settles);
  // The rule is a function F of the state alone, so s(t0 + 2) = s(t0) settles every later
  // step by induction: s(t0 + 3) = F(s(t0 + 2)) = F(s(t0)) = s(t0 + 1). Read literally as
  // well, over the next thousand steps, as exact integer equality.
  let states = [cycle[0], cycle[1]];
  let unanimousSteps = 0;
  for (let t = 0; t < 1000; t += 1) {
    const next = exactStep(states[1], WORLD.neighbours);
    assert.ok(sameState(next, states[0]), `s(t0 + ${t + 2}) differs from s(t0 + ${t})`);
    if (isUnanimous(next)) unanimousSteps += 1;
    states = [states[1], next];
  }
  assert.equal(unanimousSteps, 0);
  // The transient, step by step, is never unanimous either.
  let state = WORLD.initial;
  for (let t = 0; t <= t0 + 1; t += 1) {
    assert.ok(!isUnanimous(state), `step ${t} of exact hearing is unanimous`);
    state = exactStep(state, WORLD.neighbours);
  }
  // Patches freeze and some blink: the two states of the cycle differ at this many nodes.
  let blinkers = 0;
  for (let i = 0; i < NODE_COUNT; i += 1) if (cycle[0][i] !== cycle[1][i]) blinkers += 1;
  assert.equal(blinkers, REGISTERED.blinkers);
  assert.ok(blinkers > 0, "nothing blinks, so period two is not on the page");
  // Act one shows the start and the next steps, and reaches the cycle before it ends.
  assert.equal(HISTORY.actOne.length, ACT_ONE_STEPS);
  assert.ok(sameState(HISTORY.actOne[0], WORLD.initial));
  for (let step = 1; step < ACT_ONE_STEPS; step += 1) {
    assert.ok(sameState(HISTORY.actOne[step], exactStep(HISTORY.actOne[step - 1], WORLD.neighbours)));
    assert.ok(!isUnanimous(HISTORY.actOne[step]), `shown step ${step} is unanimous`);
  }
  assert.ok(t0 + 2 < ACT_ONE_STEPS, "the cycle is not reached within act one");
  assert.ok(sameState(HISTORY.actOne[ACT_ONE_STEPS - 1], HISTORY.actOne[ACT_ONE_STEPS - 3]));
  // A blinking node changes at most twice a second on the page.
  assert.ok(2 * ACT_ONE_STEP_FRAMES >= PLAYBACK_FPS);
  assert.equal(ACT_ONE_STEPS * ACT_ONE_STEP_FRAMES, ACT_ONE_FRAMES);
});

test("pin 2: faulty hearing reaches unanimity at the registered sweep, and the state never changes afterwards", () => {
  assert.equal(SWEEPS_PER_FRAME, 1);
  assert.equal(HISTORY.sweeps, (TOTAL_FRAMES - ACT_ONE_FRAMES) * SWEEPS_PER_FRAME);
  assert.equal(HISTORY.consensusSweep, REGISTERED.consensusSweep);
  assert.equal(HISTORY.landingFrame, REGISTERED.landingFrame);
  assert.equal(HISTORY.landingFrame, ACT_ONE_FRAMES + Math.ceil(REGISTERED.consensusSweep / SWEEPS_PER_FRAME) - 1);
  const landed = HISTORY.states[HISTORY.landingFrame];
  assert.ok(isUnanimous(landed));
  assert.equal(landed[0], REGISTERED.winner);
  const hash = hashState(landed);
  for (let frame = HISTORY.landingFrame; frame < TOTAL_FRAMES; frame += 1) {
    assert.equal(hashState(HISTORY.states[frame]), hash, `frame ${frame} differs from the agreement`);
    assert.ok(sameState(HISTORY.states[frame], landed));
  }
  for (let frame = 0; frame < HISTORY.landingFrame; frame += 1) {
    assert.ok(!isUnanimous(HISTORY.states[frame]), `frame ${frame} is unanimous before the landing`);
  }
  // Reached inside the clip and held for its last one to two seconds.
  assert.ok(HISTORY.landingFrame >= ACT_ONE_FRAMES);
  const held = TOTAL_FRAMES - HISTORY.landingFrame;
  assert.ok(held >= PLAYBACK_FPS && held <= 2 * PLAYBACK_FPS, `held for ${held} frames`);
  // Every voice heard was a neighbour, and the act's first sweep starts from act one's last state.
  for (let frame = ACT_ONE_FRAMES; frame < TOTAL_FRAMES; frame += 1) {
    const heard = HISTORY.heard[frame];
    assert.equal(heard.length, NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i += 1) {
      assert.ok(WORLD.neighbours[i].includes(heard[i]), `frame ${frame}: node ${i} heard ${heard[i]}, not a neighbour`);
    }
  }
  assert.equal(HISTORY.heard[ACT_ONE_FRAMES - 1], null);
});

test("pin 3: with the same graph and the same start, exact hearing continued for ten times the consensus steps never agrees", () => {
  const steps = 10 * REGISTERED.consensusSweep;
  let state = WORLD.initial;
  let agreed = 0;
  for (let t = 0; t < steps; t += 1) {
    state = exactStep(state, WORLD.neighbours);
    if (isUnanimous(state)) agreed += 1;
  }
  assert.equal(agreed, 0);
  assert.ok(steps >= 4000, "the control ran too few steps to mean anything");
  // And it is in its cycle by then, as pin 1 says.
  assert.ok(sameState(exactStep(exactStep(state, WORLD.neighbours), WORLD.neighbours), state));
});

test("pin 5: unanimity is absorbing under faulty hearing, in both colours, under different random orders", () => {
  for (const colour of [0, 1]) {
    for (const seed of [1, 2, 3, SEED]) {
      const random = createRandom(seed);
      const state = new Uint8Array(NODE_COUNT).fill(colour);
      const heard = new Uint16Array(NODE_COUNT);
      for (let sweep = 0; sweep < 5; sweep += 1) {
        voterSweep(state, WORLD.neighbours, random, heard);
        assert.ok(state.every((value) => value === colour));
      }
      for (let i = 0; i < NODE_COUNT; i += 1) assert.ok(WORLD.neighbours[i].includes(heard[i]));
    }
  }
});

test("the clip is reproduced from the seed alone, and a frame depends on its index and nothing else", () => {
  const again = buildHistory(buildWorld());
  assert.equal(again.consensusSweep, HISTORY.consensusSweep);
  assert.equal(again.landingFrame, HISTORY.landingFrame);
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    assert.equal(hashState(again.states[frame]), hashState(HISTORY.states[frame]), `frame ${frame} is not reproduced`);
    if (frame >= ACT_ONE_FRAMES) assert.deepEqual(again.heard[frame], HISTORY.heard[frame]);
  }
  const forward = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scene = sceneAt(frame);
    assert.equal(scene.frameIndex, frame);
    assert.equal(scene.act, frame < ACT_ONE_FRAMES ? 1 : 2);
    forward.push(scene);
  }
  for (let frame = TOTAL_FRAMES - 1; frame >= 0; frame -= 1) assert.deepEqual(sceneAt(frame), forward[frame]);
  assert.equal(sceneAt(-1).frameIndex, 0);
  assert.equal(sceneAt(TOTAL_FRAMES + 9).frameIndex, TOTAL_FRAMES - 1);
  assert.equal(pageFrame(0), 0);
  assert.equal(pageFrame(1), PLAYBACK_FPS);
  assert.equal(pageFrame(DURATION_SECONDS), TOTAL_FRAMES - 1);
  assert.equal(pageFrame(1000), TOTAL_FRAMES - 1);
  // The pulses: a node's age since its last change, zero on the frame it changes.
  for (let frame = 1; frame < TOTAL_FRAMES; frame += 1) {
    const now = HISTORY.states[frame], before = HISTORY.states[frame - 1], ages = HISTORY.pulse[frame];
    for (let i = 0; i < NODE_COUNT; i += 1) {
      if (now[i] !== before[i]) assert.equal(ages[i], 0);
      else assert.ok(ages[i] > 0);
    }
  }
  const sketch = readFileSync(new URL("../artworks/by-misunderstanding/sketch.js", import.meta.url), "utf8");
  assert.match(sketch, /const frame = pageFrame\(\(performance\.now\(\) - startedAt\) \/ 1000\);\n {4}publishState\(drawFrame\(frame\)\);/u);
  assert.match(sketch, /if \(frame === TOTAL_FRAMES - 1\) p\.noLoop\(\);/u);
});

test("the quotation is the three sentences, credited to the book without a date, and fits a post", () => {
  assert.deepEqual(ARTWORK.quoteIds, ["baudelaire-malentendu"]);
  assert.equal(QUOTE.author, "Charles Baudelaire");
  assert.equal(QUOTE.source, "My Heart Laid Bare");
  assert.equal(QUOTE.rendering, "English rendering");
  assert.equal(QUOTE.year, 1887);
  assert.equal(QUOTE.text.match(/\. /gu).length, 2);
  assert.equal(QUOTE.original.lang, "fr");
  assert.equal(QUOTE.original.source, "Mon cœur mis à nu");
  assert.equal(QUOTE.original.text,
    "Le monde ne marche que par le malentendu. C’est par le malentendu universel que tout le monde s’accorde. Car si, par malheur, on se comprenait, on ne pourrait jamais s’accorder.");
  assert.ok(!QUOTE.text.includes("goes round"));
  assert.match(QUOTE.sourceUrl, /^https:\/\/fr\.wikisource\.org\/wiki\/Page:Baudelaire_-_%C5%92uvres_posthumes_1908\.djvu\/129$/u);
  assert.equal(QUOTE.original.sourceUrl, QUOTE.sourceUrl);

  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">By Misunderstanding</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<cite class="card__cite">—&nbsp;<b>Charles Baudelaire<\/b>, My Heart Laid Bare<\/cite>/u);
  assert.doesNotMatch(card, /1887|1908/u);

  const body = buildPostBody(ARTWORK, QUOTE, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 257);
  assert.ok(body.includes("— Charles Baudelaire, My Heart Laid Bare\n"));
  assert.doesNotMatch(body, /1887|1908/u);
});

test("the manifest, notes and module agree on the clip", () => {
  assert.deepEqual(ARTWORK.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(ARTWORK.render, { kind: "video", artifact: "exports/p5js/ByMisunderstanding.mp4", durationSeconds: DURATION_SECONDS, scale: 2 });
  assert.equal(ARTWORK.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.equal(MANIFEST.defaults.fps, PLAYBACK_FPS);
  assert.ok(ARTWORK.thumbnail.frame >= ACT_ONE_FRAMES && ARTWORK.thumbnail.frame < TOTAL_FRAMES);
  const notes = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(notes, /\| `by-misunderstanding` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 22 seconds,/u);
  assert.match(notes, new RegExp(`By Misunderstanding[\\s\\S]*?${REGISTERED.nodes} nodes[\\s\\S]*?${REGISTERED.links.toLocaleString("en-US")} links`, "u"));
  assert.match(notes, new RegExp(`settles at step ${REGISTERED.settles}`, "u"));
  assert.match(notes, new RegExp(`sweep ${REGISTERED.consensusSweep}`, "u"));
  assert.match(notes, new RegExp(`frame ${REGISTERED.landingFrame}`, "u"));
  assert.match(notes, new RegExp(`the thumbnail is frame ${ARTWORK.thumbnail.frame}\\.`, "u"));
});

test("the palette is the dark, lit works' own, All on One Circumference's constants, and the voices leave a web", () => {
  const sketch = readFileSync(new URL("../artworks/by-misunderstanding/sketch.js", import.meta.url), "utf8");
  const reference = readFileSync(new URL("../artworks/all-on-one-circumference/sketch.js", import.meta.url), "utf8");
  const literal = (source, name) => {
    const match = source.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`, "u"));
    assert.ok(match, `${name} is not declared`);
    return JSON.parse(match[1]);
  };
  for (const name of ["GROUND", "BONE", "STEEL_FACE", "STEEL_EDGE", "GOLD_FACE", "GOLD_EDGE", "HEART_WHITE"]) {
    assert.deepEqual(literal(sketch, name), literal(reference, name), name);
  }
  // The lights are added, not painted, as the house stars are.
  assert.match(sketch, /ctx\.globalCompositeOperation = "lighter";\n\s+for \(let i = 0; i < NODE_COUNT; i \+= 1\)/u);
  // The heard links of the seven frames before fade behind the frame's own, older first.
  assert.match(sketch, /const TRAIL_FRAMES = 8;/u);
  assert.match(sketch, /for \(let back = TRAIL_FRAMES - 1; back >= 1; back -= 1\) \{\n\s+const frame = scene\.frameIndex - back;\n\s+if \(frame < ACT_ONE_FRAMES\) continue;/u);
  // And nothing else is drawn: no legend, no key hint, no text.
  assert.doesNotMatch(sketch, /drawKeyHint|fillText|strokeText|__KEY_HINT_BOUNDS__/u);
});

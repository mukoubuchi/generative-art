import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { thumbnailFrame } from "../lib/catalog.mjs";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  BOX,
  DEFAULTS,
  arcsine,
  bulges,
  census,
  createFoam,
  foamFromCells,
  geometry,
  leaving,
  periodicVoronoi,
  seedPoints,
  sidesOf
} from "../artworks/homo-bulla/foam.js";
import {
  DURATION_SECONDS,
  PLAYBACK_FPS,
  STEPS_PER_FRAME,
  TOTAL_FRAMES,
  createRun
} from "../artworks/homo-bulla/homo-bulla.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/homo-bulla/sketch.js", import.meta.url);
const QUOTE_ID = "varro-homo-bulla";

/**
 * The clip is lived through once, and everything the tests hold is read off it on the way:
 * the census at every frame, the angles at every vertex, and each bubble's change of area
 * from one frame to the next.
 */
const RECORD = (() => {
  const run = createRun();
  const foam = run.foam;
  const frames = [];
  const angles = [];
  const changes = [];
  let previous = null;
  let firstAlive = null;
  let births = 0;
  for (let k = 0; k < TOTAL_FRAMES; k += 1) {
    if (k > 0) run.frame(k);
    const tally = census(foam);
    geometry(foam);
    bulges(foam);
    let area = 0;
    let gas = 0;
    const now = new Map();
    for (let f = 0; f < foam.faceAlive.length; f += 1) {
      if (!foam.faceAlive[f]) continue;
      area += foam.area[f];
      gas += foam.gas[f];
      now.set(f, { sides: sidesOf(foam, f), area: foam.area[f] });
    }
    for (let v = 0; v < foam.vertexAlive.length; v += 1) {
      if (!foam.vertexAlive[v]) continue;
      const directions = leaving(foam, v).map((h) => {
        const c = foam.chord[h];
        const ux = foam.dx[h] / c;
        const uy = foam.dy[h] / c;
        const s = foam.sine[h];
        const q = Math.sqrt(1 - s * s);
        return Math.atan2(q * uy - s * ux, q * ux + s * uy);
      }).sort((first, second) => first - second);
      for (const gap of [directions[1] - directions[0], directions[2] - directions[1], 2 * Math.PI - (directions[2] - directions[0])]) {
        angles.push(Math.abs(gap * 180 / Math.PI - 120));
      }
    }
    // A bubble alive now that was not alive at the first frame would be a bubble made.
    if (!firstAlive) firstAlive = new Set(now.keys());
    for (const f of now.keys()) if (!firstAlive.has(f)) births += 1;
    if (previous) {
      for (const [f, current] of now) {
        const before = previous.get(f);
        // Only a bubble that kept its sides from one frame to the next says what its sides do.
        if (before && before.sides === current.sides) changes.push({ sides: current.sides, area: before.area, change: current.area - before.area });
      }
    }
    previous = now;
    frames.push({ ...tally, swaps: foam.swaps, vanished: foam.vanished[2] + foam.vanished[3], area, gas });
  }
  angles.sort((first, second) => first - second);
  return { run, frames, angles, changes, births };
})();

const quantile = (sorted, p) => sorted[Math.floor(p * (sorted.length - 1))];

test("the clip is twelve seconds at thirty frames, ten steps of the foam to a frame", () => {
  assert.equal(TOTAL_FRAMES, 360);
  assert.equal(TOTAL_FRAMES / PLAYBACK_FPS, DURATION_SECONDS);
  assert.equal(STEPS_PER_FRAME, 10);
});

test("the start is a Voronoi foam on the torus: every vertex of three films, V − E + F = 0, and the areas fill the torus", () => {
  const foam = createFoam();
  const tally = census(foam);
  assert.equal(tally.bubbles, DEFAULTS.bubbles);
  assert.equal(tally.trivalent, tally.vertices);
  assert.equal(tally.vertices, 2 * tally.bubbles);
  assert.equal(tally.films, 3 * tally.bubbles);
  assert.equal(tally.vertices - tally.films + tally.bubbles, 0);
  let area = 0;
  for (let f = 0; f < foam.faceAlive.length; f += 1) if (foam.faceAlive[f]) area += foam.area[f];
  assert.ok(Math.abs(area - BOX * BOX) < 1e-8, `${area}`);
});

test("at every frame every vertex joins three films, V − E + F = 0, and the sides add up to exactly six a bubble", () => {
  assert.equal(RECORD.frames.length, TOTAL_FRAMES);
  RECORD.frames.forEach((frame, index) => {
    assert.equal(frame.trivalent, frame.vertices, `frame ${index}`);
    assert.equal(frame.vertices - frame.films + frame.bubbles, 0, `frame ${index}`);
    assert.equal(frame.sidesTotal, 6 * frame.bubbles, `frame ${index}`);
  });
});

test("bubbles are only ever lost to a T2, one for each, and the counts are these", () => {
  const { frames } = RECORD;
  for (let k = 1; k < frames.length; k += 1) {
    assert.equal(frames[k - 1].bubbles - frames[k].bubbles, frames[k].vanished - frames[k - 1].vanished, `frame ${k}`);
  }
  assert.equal(frames[0].bubbles, 619);
  assert.equal(frames.at(-1).bubbles, 179);
  // Before the first frame: 52 swaps and 21 vanishings while the start settled.
  assert.equal(frames[0].swaps, 52);
  assert.equal(frames[0].vanished, 21);
  assert.equal(frames.at(-1).swaps - frames[0].swaps, 627);
  assert.equal(frames.at(-1).vanished - frames[0].vanished, 440);
  assert.equal(frames[0].bubbles - frames.at(-1).bubbles, 440);
});

test("fewer than half the bubbles are hexagons at any frame, yet the mean is six at every one", () => {
  const shares = RECORD.frames.map((frame) => frame.sides.get(6) / frame.bubbles);
  assert.ok(Math.max(...shares) < 0.45, `${Math.max(...shares)}`);
  assert.ok(Math.min(...shares) < 0.3, `${Math.min(...shares)}`);
  assert.equal(shares[0].toFixed(3), "0.422");
  assert.equal(shares.at(-1).toFixed(3), "0.318");
  for (const frame of RECORD.frames) {
    let total = 0;
    for (const [sides, count] of frame.sides) total += sides * count;
    assert.equal(total / frame.bubbles, 6);
  }
});

test("the films meet at 120 degrees, measured at every vertex of every frame", () => {
  const { angles } = RECORD;
  assert.ok(angles.length > 700000, `${angles.length}`);
  // Half of all angles within 1.6 degrees, nine in ten within 5; the rest are the vertices a
  // swap or a vanishing has just made, which have not had time to settle.
  assert.ok(quantile(angles, 0.5) < 1.6, `median ${quantile(angles, 0.5)}`);
  assert.ok(quantile(angles, 0.9) < 5, `p90 ${quantile(angles, 0.9)}`);
  assert.ok(quantile(angles, 0.99) < 20, `p99 ${quantile(angles, 0.99)}`);
});

test("a bubble grows or shrinks as n − 6, which the rule of the leak never says", () => {
  const bySides = new Map();
  let agree = 0;
  let disagree = 0;
  for (const { sides, change } of RECORD.changes) {
    const entry = bySides.get(sides) ?? { total: 0, count: 0 };
    entry.total += change;
    entry.count += 1;
    bySides.set(sides, entry);
    if (sides !== 6) {
      if (Math.sign(change) === Math.sign(sides - 6)) agree += 1;
      else disagree += 1;
    }
  }
  // Shrinking below six, growing above, in all but half a per cent of bubble-frames (0.36 measured).
  assert.ok(agree / (agree + disagree) > 0.995, `${agree} to ${disagree}`);
  // The rate per side short of or past six is one number, from five sides to ten.
  const perSide = [5, 7, 8, 9, 10].map((n) => bySides.get(n).total / bySides.get(n).count / (n - 6));
  assert.ok(Math.max(...perSide) / Math.min(...perSide) < 1.05, `${perSide}`);
  // And a hexagon neither grows nor shrinks, to within a twenty-fifth of that rate.
  const hexagon = bySides.get(6).total / bySides.get(6).count;
  assert.ok(Math.abs(hexagon) < Math.min(...perSide) / 25, `${hexagon}`);
  // The quasi-static law would give P·π/3 a step; the vertices lag the balance at this pace
  // and the measured constant is a little short of it.
  const ideal = DEFAULTS.permeability * Math.PI / 3 * STEPS_PER_FRAME;
  const measured = perSide.reduce((sum, value) => sum + value, 0) / perSide.length;
  assert.ok(measured / ideal > 0.8 && measured / ideal < 0.9, `${measured / ideal}`);
});

test("a bubble's size does not decide whether it grows or shrinks; it only slows the smallest", () => {
  // The bubbles of each side count, split into fifths by size: in every fifth, from the
  // smallest to the largest, the sign of the change is the sign of n − 6. The pace is not
  // quite size-free: the smallest bubbles have the shortest films, their vertices lag the
  // balance most, and they change more slowly than the largest of their kind.
  for (const n of [4, 5, 7, 8]) {
    const sorted = RECORD.changes.filter(({ sides }) => sides === n).sort((first, second) => first.area - second.area);
    const fifth = Math.floor(sorted.length / 5);
    const rates = [];
    for (let k = 0; k < 5; k += 1) {
      const slice = sorted.slice(k * fifth, (k + 1) * fifth);
      const right = slice.filter(({ change }) => Math.sign(change) === Math.sign(n - 6)).length / slice.length;
      assert.ok(right > 0.99, `${n} sides, fifth ${k}: ${right}`);
      rates.push(slice.reduce((sum, { change }) => sum + change, 0) / slice.length);
    }
    const ratio = rates[0] / rates[4];
    assert.ok(ratio > 0.65 && ratio < 1, `${n} sides: smallest fifth at ${ratio} of the largest`);
  }
});

test("area fills the torus and gas is neither made nor lost, at every frame", () => {
  for (const frame of RECORD.frames) {
    assert.ok(Math.abs(frame.area - BOX * BOX) < 1e-8, `${frame.area}`);
    assert.ok(Math.abs(frame.gas - BOX * BOX) < 1e-8, `${frame.gas}`);
  }
});

test("the foam is the same foam every time: the arcsine is the engine's to within two parts in 10^16, and a second run matches frame for frame", () => {
  let worst = 0;
  for (let k = -800; k <= 800; k += 1) worst = Math.max(worst, Math.abs(arcsine(k / 1000) - Math.asin(k / 1000)));
  assert.ok(worst < 4e-16, `${worst}`);
  const again = createRun();
  for (const k of [0, 90, 180]) {
    const first = RECORD.run.frames[k];
    const second = again.frame(k);
    assert.equal(second.count, first.count);
    assert.deepEqual(second.films, first.films);
  }
});

/** The Voronoi start again, but in a square with walls: cells cut to the square, no images. */
function walledVoronoi(points) {
  const cells = points.map((p, i) => {
    let polygon = [[0, 0], [BOX, 0], [BOX, BOX], [0, BOX]];
    points.forEach((q, j) => {
      if (j === i) return;
      const nx = q.x - p.x;
      const ny = q.y - p.y;
      const limit = (nx * (p.x + q.x) + ny * (p.y + q.y)) / 2;
      const out = [];
      for (let k = 0; k < polygon.length; k += 1) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        const aIn = nx * a[0] + ny * a[1] <= limit;
        const bIn = nx * b[0] + ny * b[1] <= limit;
        if (aIn) out.push(a);
        if (aIn !== bIn) {
          const sa = nx * a[0] + ny * a[1] - limit;
          const sb = nx * b[0] + ny * b[1] - limit;
          const t = sa / (sa - sb);
          out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
      }
      polygon = out;
    });
    return polygon;
  });
  const key = ([x, y]) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
  const vertices = new Set();
  const edges = new Set();
  let sides = 0;
  for (const polygon of cells) {
    sides += polygon.length;
    polygon.forEach((corner, k) => {
      vertices.add(key(corner));
      const other = polygon[(k + 1) % polygon.length];
      edges.add([key(corner), key(other)].sort().join("|"));
    });
  }
  return { vertices: vertices.size, edges: edges.size, faces: cells.length, sides };
}

test("the six belongs to the torus: in a square with walls the same start has V − E + F = 1 and fewer than six sides a bubble", () => {
  const points = seedPoints(160, DEFAULTS.seed, DEFAULTS.lloyd, 3.5 * BOX / Math.sqrt(160));
  const walled = walledVoronoi(points);
  assert.equal(walled.vertices - walled.edges + walled.faces, 1);
  assert.ok(walled.sides / walled.faces < 6, `${walled.sides / walled.faces}`);
  // The same points on the torus: nought, and exactly six.
  const periodic = census(foamFromCells(periodicVoronoi(points, 3.5 * BOX / Math.sqrt(160))));
  assert.equal(periodic.vertices - periodic.films + periodic.bubbles, 0);
  assert.equal(periodic.sidesTotal, 6 * periodic.bubbles);
});

test("the six belongs to vertices of three: close one film to make a vertex of four and the sides fall two short", () => {
  const foam = createFoam({ bubbles: 160 });
  const { twin, next, prev, origin, out, faceHalf, face } = foam;
  // Contract the film h: its end b is merged into its origin a.
  const h = foam.films[0];
  const t = twin[h];
  const a = origin[h];
  const b = origin[t];
  for (let e = 0; e < origin.length; e += 1) if (foam.halfAlive[e] && origin[e] === b) origin[e] = a;
  next[prev[h]] = next[h];
  prev[next[h]] = prev[h];
  next[prev[t]] = next[t];
  prev[next[t]] = prev[t];
  if (faceHalf[face[h]] === h) faceHalf[face[h]] = next[h];
  if (faceHalf[face[t]] === t) faceHalf[face[t]] = next[t];
  if (out[a] === h) out[a] = next[t];
  foam.halfAlive[h] = 0;
  foam.halfAlive[t] = 0;
  foam.vertexAlive[b] = 0;
  const tally = census(foam);
  assert.equal(tally.vertices - tally.films + tally.bubbles, 0);
  assert.equal(tally.trivalent, tally.vertices - 1);
  assert.equal(tally.sidesTotal, 6 * tally.bubbles - 2);
});

test("no bubble is ever made: every bubble on the screen has been there since the first frame", () => {
  // A swap changes which bubbles touch and a vanishing takes one out; neither makes one. So
  // every bubble alive at any frame was alive at the first, and all of them are one age.
  assert.equal(RECORD.births, 0);
  for (let k = 1; k < RECORD.frames.length; k += 1) {
    assert.ok(RECORD.frames[k].bubbles <= RECORD.frames[k - 1].bubbles, `frame ${k}`);
  }
});

test("the archived original: the clause as Goetz and Keil print it", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === QUOTE_ID);
  assert.equal(quote.text, "If, as the saying goes, man is a bubble, all the more so is an old man.");
  assert.equal([...quote.text].length, 71);
  assert.equal(quote.lang, "en");
  assert.equal(quote.author, "Varro");
  assert.equal(quote.source, "On Agriculture I.1.1");
  assert.equal(quote.rendering, "English rendering");
  const original = quote.original;
  assert.equal(original.text, "ut dicitur, si est homo bulla, eo magis senex.");
  assert.equal(original.text, original.text.normalize("NFC"));
  assert.equal([...original.text].length, 46);
  assert.equal(original.lang, "la");
  assert.equal(original.author, "M. Terentius Varro");
  assert.equal(original.source, "Rerum rusticarum I.1.1");
  assert.equal(original.year, null);
  assert.equal(original.publicDomain, true);
  // The viewer's page index counts from nought: n29 is Goetz's page 7.
  assert.equal(original.sourceUrl, "https://archive.org/details/rerumrusticaruml00varruoft/page/n29/mode/1up");
  assert.equal(quote.sourceUrl, original.sourceUrl);
  assert.equal(CATALOG.quotes.filter((entry) => (entry.original ?? entry).lang === "la").length, 10);
});

test("the notes keep the proverb's claim and the project's reading apart, and give the numbers the foam gives", () => {
  const start = NOTES.indexOf("Homo Bulla starts from");
  const section = NOTES.slice(start, NOTES.indexOf("## Install"));
  assert.ok(start > 0 && section.length > 0);
  assert.match(section, /The proverb is not his; he quotes it as a saying/u);
  assert.match(section, /Erasmus later collected it among his adages as \*Homo bulla\*, number 1248 of the \*Adagia\*/u);
  assert.match(section, /Those readings are this project's\. Varro and Erasmus describe a bubble, not a foam, and nothing here is attributed to them\./u);
  // Age is said as a fact of the structure, not as something measured.
  assert.match(section, /never make a bubble, so every bubble on the screen has been there since the first frame and all of them are the same age/u);
  assert.doesNotMatch(section, /measured[^.]*age|age[^.]*measured/u);
  // 120 degrees is the balance the vertices move towards, and the notes say how far they are from it.
  assert.match(section, /The vertices move towards the balance of the three tensions/u);
  assert.match(section, /one in a hundred is off by more than 18\.4 and the largest by 119\.8/u);
  // Von Neumann's law as a consequence, with its measured constant and the reason it falls short.
  assert.match(section, /Von Neumann's law[^.]*is written nowhere in the code/u);
  assert.match(section, /The constant is 0\.85 of the quasi-static value, because at this pace the vertices lag behind their balance/u);
  // Hexagons in numbers, not in words.
  assert.match(section, /Hexagons are 42\.2 per cent of the bubbles at the first frame, 27\.3 at the fewest and 31\.8 at the last/u);
  assert.doesNotMatch(section, /almost no hexagon|hardly any hexagon/u);
  // The counts the notes give are the counts the clip gives.
  const { frames } = RECORD;
  assert.match(section, new RegExp(`${frames[0].bubbles} at the first frame and ${frames.at(-1).bubbles} at the last, after ${frames.at(-1).swaps - frames[0].swaps} swaps and ${frames.at(-1).vanished - frames[0].vanished} vanishings`, "u"));
  const shares = frames.map((frame) => (100 * frame.sides.get(6) / frame.bubbles).toFixed(1));
  assert.deepEqual([shares[0], [...shares].sort((a, b) => a - b)[0], shares.at(-1)], ["42.2", "27.3", "31.8"]);
  // The two editions, the variant in Erasmus, and the pages.
  assert.match(section, /\[page 7\]\(https:\/\/archive\.org\/details\/rerumrusticaruml00varruoft\/page\/n29\/mode\/1up\)/u);
  assert.match(section, /\[page 119\]\(https:\/\/archive\.org\/details\/mporcicatonisdea01keil\/page\/n145\/mode\/1up\)/u);
  assert.match(section, /`quod, ut dicitur, si est homo bulla, eo magis senex`/u);
  assert.match(section, /`quod si, vt dicitur, homo est bulla, eo magis et senex`/u);
  // The drawn liquid is said to be drawn, and its one size on the screen is given as an
  // estimate with its assumption, in the foam's own numbers: twice as many junctions as bubbles.
  assert.match(section, /It is drawn, not simulated; the model's films have no thickness and hold no liquid\./u);
  assert.match(section, /that is an estimate under one assumption\. If the foam's liquid is conserved/u);
  const junctions = (bubbles) => (2 * bubbles).toLocaleString("en-US");
  assert.match(section, new RegExp(`${junctions(frames[0].bubbles)} at the first frame and ${junctions(frames.at(-1).bubbles)} at the last`, "u"));
  const pulled = Math.sqrt(frames[0].bubbles / frames.at(-1).bubbles);
  assert.equal(pulled.toFixed(2), "1.86");
  assert.match(section, /grows as the square root of its share, 1\.86 times, which is how far the camera stands back/u);
  assert.match(section, /A bubble's sides are shown as light\./u);
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "homo-bulla");
  const shown = thumbnailFrame(MANIFEST, artwork);
  assert.match(section, new RegExp(`The thumbnail is frame ${shown}, half-way through`, "u"));
  assert.equal(shown, TOTAL_FRAMES / 2);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "homo-bulla");
  const quote = CATALOG.quotes.find((entry) => entry.id === QUOTE_ID);
  assert.equal(artwork.title, "Homo Bulla");
  assert.equal(artwork.entry, "p5js/artworks/homo-bulla/index.html");
  assert.equal(artwork.interactivePath, "homo-bulla/");
  assert.deepEqual(artwork.canvas, { width: 680, height: 680 });
  assert.deepEqual(artwork.quoteIds, [QUOTE_ID]);
  // Half-way is the default, so the manifest names no frame.
  assert.equal(artwork.thumbnail, undefined);
  assert.equal(thumbnailFrame(MANIFEST, artwork), 180);
  assert.deepEqual(artwork.render, { kind: "video", artifact: "exports/p5js/HomoBulla.mp4", durationSeconds: 12, scale: 2 });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `homo-bulla` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 12 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 142);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Homo Bulla</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
});

test("the sketch draws the one look, with no switch left to choose another", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), ["background", "createCanvas", "frameRate", "noLoop", "pixelDensity", "pop", "push", "scale"]);
  // The page answers to capture and scale and to nothing else.
  const asked = [...source.matchAll(/PARAMETERS\.get\("([a-zA-Z]+)"\)/gu)].map((match) => match[1]).sort();
  assert.deepEqual(asked, ["capture", "renderScale"]);
  // The look the user chose: the pale ground, the slate films, the light for the sides, the borders.
  assert.match(source, /const GROUND = \[234, 240, 244\];/u);
  assert.match(source, /const FILM = \[64, 88, 108\];/u);
  assert.match(source, /const FILM_ALPHA = 0\.85;/u);
  assert.match(source, /const FILM_WIDTH = 0\.7;/u);
  assert.match(source, /const DARKER_ALPHA = 0\.12;/u);
  assert.match(source, /const LIGHTER_ALPHA = 0\.6;/u);
  assert.match(source, /const BORDER_REACH = 5;/u);
});

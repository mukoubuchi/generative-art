import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { thumbnailFrame } from "../lib/catalog.mjs";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  AIR,
  COSINE_STEPS,
  OPD_LIMIT,
  OPD_STEP,
  WATER,
  WAVELENGTHS,
  airy,
  colourOf,
  colourTable,
  cosInside,
  film,
  filmColour,
  fresnel,
  lookUp,
  pathDifference
} from "../artworks/stains-the-white/film.js";
import {
  BLACK_FILM,
  BLACK_ONSET,
  BLOWING,
  AIR_WAVES,
  BUBBLE_COUNT,
  BURST_ANGLE,
  DRAINAGE,
  DURATION_SECONDS,
  HOLD,
  LIFETIMES,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  QUARTERS,
  RADII,
  START_THICKNESS,
  SWIRL,
  TILT,
  TOTAL_FRAMES,
  WAVE_SLOPE,
  airAt,
  blackeningOf,
  centreAt,
  createBubbles,
  lightAt,
  pixelAt,
  sceneAt,
  thicknessAt,
  thicknessSeen,
  upright
} from "../artworks/stains-the-white/bubbles.js";
import * as UNIFORM from "./fixtures/stains-the-white-uniform-columns/film.js";
import * as DRAFT from "./fixtures/stains-the-white-first-draft/draft.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/stains-the-white/sketch.js", import.meta.url);
const QUOTE_ID = "shelley-dome-of-many-coloured-glass";

const TABLE = colourTable();
const BUBBLES = createBubbles();
/** Every sixth bubble, for the checks that draw pixels: ten of the sixty. */
const SAMPLE = BUBBLES.filter((unused, k) => k % 6 === 0);

/** Viewing cosines from grazing to face-on: the table's columns and the points between them. */
const COSINES = Array.from({ length: 65 }, (unused, k) => Math.max(1e-3, (k / 64) * (k / 64)));

/**
 * Points of a bubble's unit sphere in its upright frame, y down: 13 latitudes from the top
 * (ψ = 0) to the bottom (ψ = π), 24 longitudes on each but the two poles.
 */
const SPHERE = (() => {
  const points = [];
  for (let i = 0; i <= 12; i += 1) {
    const psi = Math.PI * i / 12;
    const longitudes = i === 0 || i === 12 ? 1 : 24;
    for (let j = 0; j < longitudes; j += 1) {
      const phi = 2 * Math.PI * j / 24;
      points.push({ psi, x: Math.sin(psi) * Math.cos(phi), y: -Math.cos(psi), z: Math.sin(psi) * Math.sin(phi) });
    }
  }
  return points;
})();

/** The cosine at which the eye sees a point of the upright sphere: upright turned back. */
const viewingCosine = ({ y, z }) => Math.abs(-Math.sin(TILT) * y + Math.cos(TILT) * z);

/** The ages a bubble is looked at: its life from blowing to bursting in 240 steps. */
const agesOf = (bubble) => Array.from({ length: 241 }, (unused, k) => bubble.lifetime * k / 240);

const colourAt = (bubble, u, v, z) => {
  const cosAir = Math.abs(z);
  return lookUp(TABLE, pathDifference(thicknessSeen(bubble, u, v, z, bubble.age), cosAir), cosAir);
};

const chromaticity = ([r, g, b]) => [r / (r + g + b), g / (r + g + b)];

/** The first draft's picture of a bubble: its field, the table's colours, its saturation and print. */
const draftColour = (bubble, u, v, z) => {
  const cosAir = Math.abs(z);
  return lookUp(TABLE, pathDifference(DRAFT.thicknessAt(bubble, u, v, z, bubble.age), cosAir), cosAir);
};

test("the clip is twelve seconds at thirty frames and closes on itself: across the seam every bubble ages one frame, as across any other", () => {
  assert.equal(PLAYBACK_FPS, 30);
  assert.equal(DURATION_SECONDS, 12);
  assert.equal(TOTAL_FRAMES, 360);
  // A bubble lives less than the loop, so it never meets itself across the seam.
  for (const bubble of BUBBLES) assert.ok(bubble.lifetime < DURATION_SECONDS);
  let carried = 0;
  for (const [before, after] of [[TOTAL_FRAMES - 1, 0], [179, 180]]) {
    const earlier = sceneAt(BUBBLES, before);
    const later = sceneAt(BUBBLES, after);
    for (const bubble of earlier) {
      const next = later.find((other) => other.born === bubble.born);
      if (!next) {
        // Gone only by bursting in between.
        assert.ok(bubble.age + 1 / PLAYBACK_FPS >= bubble.lifetime);
        continue;
      }
      assert.ok(Math.abs(next.age - bubble.age - 1 / PLAYBACK_FPS) < 1e-9);
      // And it moves on along its own path, a small step.
      const [x, y] = centreAt(bubble, bubble.age + 1 / PLAYBACK_FPS);
      assert.ok(Math.abs(next.cx - x) < 1e-9 && Math.abs(next.cy - y) < 1e-9);
      assert.ok(Math.hypot(next.cx - bubble.cx, next.cy - bubble.cy) < 5);
      carried += 1;
    }
    // And any bubble new after the step was blown within it.
    for (const bubble of later) {
      if (!earlier.some((other) => other.born === bubble.born)) assert.ok(bubble.age < 1 / PLAYBACK_FPS);
    }
  }
  assert.equal(carried, 31);
});

test("a film of no thickness reflects nothing, exactly, at every wavelength and angle; with its inner reflection not turned over it would", () => {
  let cases = 0;
  for (const cosAir of COSINES) {
    const cosWater = cosInside(cosAir);
    const outer = fresnel(AIR, cosAir, WATER, cosWater);
    const inner = fresnel(WATER, cosWater, AIR, cosAir);
    // The inner face is the outer one run backwards: the same amplitudes, turned over, to the bit.
    assert.equal(inner.s, -outer.s);
    assert.equal(inner.p, -outer.p);
    for (const wavelength of WAVELENGTHS) {
      assert.equal(film(0, wavelength, cosAir).reflectance, 0);
      // The control: the same two faces with the inner reflection not turned over.
      const unturned = (airy(outer.s, outer.s, 0).reflectance + airy(outer.p, outer.p, 0).reflectance) / 2;
      assert.ok(unturned > 0.07);
      cases += 1;
    }
    assert.ok(filmColour(0, cosAir).every((value) => value === 0));
  }
  assert.equal(cases, COSINES.length * WAVELENGTHS.length);
  assert.equal(WAVELENGTHS.length, 81);
});

test("a lossless film lets through all it does not reflect, R + T = 1, so the colour let through is white less the colour reflected", () => {
  let worst = 0;
  let worstColour = 0;
  let cases = 0;
  for (let thickness = 0; thickness <= 1600; thickness += 7.3) {
    for (const cosAir of COSINES) {
      const reflected = [];
      const through = [];
      for (const wavelength of WAVELENGTHS) {
        const { reflectance, transmittance } = film(thickness, wavelength, cosAir);
        worst = Math.max(worst, Math.abs(reflectance + transmittance - 1));
        reflected.push(reflectance);
        through.push(transmittance);
        cases += 1;
      }
      const shown = colourOf(reflected);
      const passed = colourOf(through);
      worstColour = Math.max(worstColour, ...shown.map((value, i) => Math.abs(passed[i] - (1 - value))));
    }
  }
  assert.ok(cases > 1e6);
  // To rounding, which 1 − r² near grazing, where r nears one, magnifies.
  assert.ok(worst < 2e-12, `R + T misses 1 by ${worst}`);
  assert.ok(worstColour < 1e-12, `the colour let through misses white less the reflected by ${worstColour}`);
  // White is what a perfect mirror gives.
  const mirror = colourOf(WAVELENGTHS.map(() => 1));
  assert.ok(mirror.every((value) => Math.abs(value - 1) < 1e-12));
});

test("the colour is the path difference's: the phase is 2π·(2nd·cos θ)/λ, and at one path difference two angles differ only by their faces", () => {
  // The phase `film` uses is the path difference's, at every thickness, wavelength and angle.
  let worst = 0;
  for (let thickness = 0; thickness <= 1500; thickness += 37.1) {
    for (const cosAir of COSINES) {
      const cosWater = cosInside(cosAir);
      const outer = fresnel(AIR, cosAir, WATER, cosWater);
      const inner = fresnel(WATER, cosWater, AIR, cosAir);
      for (const wavelength of WAVELENGTHS) {
        const phase = 2 * Math.PI * pathDifference(thickness, cosAir) / wavelength;
        const expected = (airy(outer.s, inner.s, phase).reflectance + airy(outer.p, inner.p, phase).reflectance) / 2;
        worst = Math.max(worst, Math.abs(film(thickness, wavelength, cosAir).reflectance - expected));
      }
    }
  }
  // To rounding, which near grazing the sharp resonance of the Airy sum magnifies.
  assert.ok(worst < 1e-12, `the phase is not the path difference's, by ${worst}`);
  // Face-on and at 40°: films thick enough to have one path difference have one hue, to the
  // small change of the faces' reflections with angle; films of one thickness do not.
  const oblique = Math.cos(40 * Math.PI / 180);
  let samePath = 0;
  let sameThickness = 0;
  let pairs = 0;
  for (let opd = 100; opd <= 3000; opd += 10) {
    const faceOn = opd / (2 * WATER * cosInside(1));
    const slanted = opd / (2 * WATER * cosInside(oblique));
    const seen = chromaticity(filmColour(faceOn, 1));
    const matched = chromaticity(filmColour(slanted, oblique));
    const unmatched = chromaticity(filmColour(faceOn, oblique));
    samePath = Math.max(samePath, Math.hypot(seen[0] - matched[0], seen[1] - matched[1]));
    sameThickness = Math.max(sameThickness, Math.hypot(seen[0] - unmatched[0], seen[1] - unmatched[1]));
    pairs += 1;
  }
  assert.equal(pairs, 291);
  assert.ok(samePath < 0.02, `one path difference, two hues: ${samePath}`);
  assert.ok(sameThickness > 0.5, `the control: one thickness should be two hues, but was ${sameThickness}`);
});

test("the table the page reads colours from is the direct integration: at its nodes to single precision, between them to 0.003", () => {
  let worstNode = 0;
  let nodes = 0;
  for (let row = 0; row < TABLE.rows; row += 7) {
    for (let column = 0; column < TABLE.columns; column += 1) {
      const root = column / COSINE_STEPS;
      const cosAir = Math.max(1e-3, root * root);
      const direct = filmColour(row * OPD_STEP / (2 * WATER * cosInside(cosAir)), cosAir);
      for (let i = 0; i < 3; i += 1) {
        worstNode = Math.max(worstNode, Math.abs(TABLE.table[(row * TABLE.columns + column) * 3 + i] - direct[i]));
      }
      nodes += 1;
    }
  }
  assert.equal(nodes, 143 * 33);
  assert.ok(worstNode < 1e-7, `a node misses by ${worstNode}`);
  // Between the nodes, at every cosine the page can sample: the edge of the largest bubble,
  // taken half a pixel in at twice the size, is the most nearly grazing.
  const inward = 1 - 0.5 / (RADII[1] * 2);
  const leastCosine = Math.sqrt(1 - inward * inward);
  assert.ok(leastCosine > 0.101 && leastCosine < 0.103);
  let worst = 0;
  let worstUniform = 0;
  const uniform = UNIFORM.colourTable();
  for (let k = 0; k < 6000; k += 1) {
    // Points spread evenly over the path differences and cosines by golden-ratio steps.
    const opd = ((k * 0.6180339887498949) % 1) * OPD_LIMIT;
    const cosAir = leastCosine + (1 - leastCosine) * ((k * 0.7548776662466927) % 1);
    const direct = filmColour(opd / (2 * WATER * cosInside(cosAir)), cosAir);
    const read = lookUp(TABLE, opd, cosAir);
    const readUniform = UNIFORM.lookUp(uniform, opd, cosAir);
    worst = Math.max(worst, ...read.map((value, i) => Math.abs(value - direct[i])));
    worstUniform = Math.max(worstUniform, ...readUniform.map((value, i) => Math.abs(value - direct[i])));
  }
  assert.ok(worst < 0.003, `the table misses by ${worst}`);
  // The control: the table this one replaced, with columns even in the cosine, misses by
  // more near grazing, where the faces' reflections change fastest.
  assert.ok(worstUniform > 0.005, `the uniform table should miss by more, but missed by ${worstUniform}`);
});

test("every point of every bubble grows thinner with every moment, so its colour moves down the order of interference colours and never back", () => {
  let checked = 0;
  let wentBlack = 0;
  let stayedClear = 0;
  for (const bubble of BUBBLES) {
    // The bound the pattern's turning is held under, with room to spare.
    assert.ok(SWIRL * WAVE_SLOPE * Math.abs(bubble.turn) < 0.71 * (1 - HOLD) / bubble.timeScale);
    const ages = agesOf(bubble);
    for (const point of SPHERE) {
      const cosAir = viewingCosine(point);
      let previous = Infinity;
      let previousRow = Infinity;
      for (const age of ages) {
        const thickness = thicknessAt(bubble, point.x, point.y, point.z, age);
        if (previous > BLACK_FILM) assert.ok(thickness < previous);
        else assert.equal(thickness, BLACK_FILM);
        const row = pathDifference(thickness, cosAir) / OPD_STEP;
        assert.ok(row <= previousRow);
        previous = thickness;
        previousRow = row;
        checked += 1;
      }
      if (previous === BLACK_FILM) wentBlack += 1;
      else stayedClear += 1;
    }
  }
  assert.equal(BUBBLES.length, BUBBLE_COUNT);
  assert.equal(BUBBLE_COUNT, 60);
  assert.equal(SPHERE.length, 266);
  assert.equal(checked, BUBBLE_COUNT * SPHERE.length * 241);
  // Both ends are reached: some points open into black before the bursting and some do not.
  assert.ok(wentBlack > 4000 && stayedClear > 11000, `${wentBlack} black, ${stayedClear} not`);
});

test("the top is the thinnest point at every age, so the black opens there first, and at the burst it has spread BURST_ANGLE down", () => {
  const top = { x: 0, y: -1, z: 0 };
  for (const bubble of BUBBLES) {
    for (const age of agesOf(bubble)) {
      const least = thicknessAt(bubble, top.x, top.y, top.z, age);
      for (const point of SPHERE) assert.ok(thicknessAt(bubble, point.x, point.y, point.z, age) >= least);
    }
    // Found, not assumed: the first moment any point of the sphere is black, in steps of a
    // five-hundredth of a life, and which points are black then.
    let first = null;
    for (let k = 0; k <= 500 && first === null; k += 1) {
      const age = bubble.lifetime * k / 500;
      const black = SPHERE.filter((point) => thicknessAt(bubble, point.x, point.y, point.z, age) < BLACK_ONSET);
      if (black.length > 0) first = { age, black };
    }
    assert.ok(first !== null);
    assert.deepEqual(first.black.map((point) => point.psi), [0]);
    assert.ok(first.age >= blackeningOf(bubble.timeScale) && first.age < blackeningOf(bubble.timeScale) + bubble.lifetime / 500);
    // At the burst the film without its pattern is just black BURST_ANGLE down; with the
    // pattern the edge wanders a few degrees either side of it.
    const w = (1 - Math.cos(BURST_ANGLE)) / 2;
    const drained = START_THICKNESS * (1 + DRAINAGE * w) * Math.exp(-(1 - HOLD * w) * bubble.lifetime / bubble.timeScale);
    assert.ok(Math.abs(drained / BLACK_ONSET - 1) < 1e-12);
  }
  let reach = 0;
  let clear = Math.PI;
  for (const bubble of BUBBLES) {
    for (let i = 0; i <= 180; i += 1) {
      const psi = Math.PI * i / 180;
      for (let j = 0; j < 96; j += 1) {
        const phi = 2 * Math.PI * j / 96;
        const thickness = thicknessAt(bubble, Math.sin(psi) * Math.cos(phi), -Math.cos(psi), Math.sin(psi) * Math.sin(phi), bubble.lifetime);
        if (thickness === BLACK_FILM) reach = Math.max(reach, psi);
        else clear = Math.min(clear, psi);
      }
    }
  }
  const degrees = (angle) => angle * 180 / Math.PI;
  assert.equal(degrees(BURST_ANGLE), 50);
  assert.ok(degrees(clear) > 45 && degrees(reach) < 55, `black to ${degrees(reach)}°, not black from ${degrees(clear)}°`);
  // The eye looks down on the bubbles by TILT: the top is turned towards it from the outline.
  const seenTop = upright(0, -Math.cos(TILT), Math.sin(TILT));
  assert.ok(Math.abs(seenTop[0]) < 1e-15 && Math.abs(seenTop[1] + 1) < 1e-15 && Math.abs(seenTop[2]) < 1e-15);
});

test("the black film prints black where the eye sees black film behind it across a pixel, its edge rises within two pixels, and the first draft printed it grey", () => {
  let pixels = 0;
  let worst = 0;
  let leastRise = Infinity;
  for (const base of SAMPLE) {
    const bubble = { ...base, radius: 100, cx: 200, cy: 200, age: base.lifetime * 0.999 };
    for (let y = 100; y < 300; y += 1) {
      for (let x = 100; x < 300; x += 1) {
        // Black film seen through black film at all four points the pixel reads.
        const black = QUARTERS.every(([dx, dy]) => {
          const u = (x + 0.5 + dx - 200) / 100;
          const v = (y + 0.5 + dy - 200) / 100;
          const distance = Math.hypot(u, v);
          if (distance > 0.95) return false;
          const z = Math.sqrt(1 - distance * distance);
          return thicknessSeen(bubble, u, v, z, bubble.age) === BLACK_FILM && thicknessSeen(bubble, u, v, -z, bubble.age) === BLACK_FILM;
        });
        if (!black) continue;
        worst = Math.max(worst, ...pixelAt([bubble], x + 0.5, y + 0.5, colourAt, 1));
        pixels += 1;
      }
    }
    // Down the middle, below the rim: the black's edge rises within two pixels.
    const column = [];
    for (let y = 110; y < 300; y += 1) column.push(Math.max(...pixelAt([bubble], 200.5, y + 0.5, colourAt, 1)));
    let rise = 0;
    for (let k = 2; k < column.length; k += 1) rise = Math.max(rise, column[k] - column[k - 2]);
    leastRise = Math.min(leastRise, rise);
  }
  assert.equal(SAMPLE.length, 10);
  assert.ok(pixels > 14000, `only ${pixels} pixels see black film through black film`);
  assert.ok(worst < 3, `black film printed at ${worst}`);
  assert.ok(leastRise > 30, `an edge of only ${leastRise} over two pixels`);
  // And the edge is shared out, not stepped: across many columns through the black's far
  // edge, the pixel between the two sides of the steepest two-pixel rise often takes a
  // level between them. Read at one point a pixel, it seldom does.
  let crossings = 0;
  let shared = 0;
  for (const base of SAMPLE) {
    const bubble = { ...base, radius: 100, cx: 200, cy: 200, age: base.lifetime * 0.999 };
    for (let x = 150; x <= 250; x += 5) {
      const column = [];
      for (let y = 100; y < 200; y += 1) column.push(Math.max(...pixelAt([bubble], x + 0.5, y + 0.5, colourAt, 1)));
      let steepest = null;
      for (let k = 2; k < column.length; k += 1) {
        const rise = column[k] - column[k - 2];
        if (!steepest || rise > steepest.rise) steepest = { k, rise };
      }
      if (steepest.rise < 20) continue;
      const between = (column[steepest.k - 1] - column[steepest.k - 2]) / steepest.rise;
      crossings += 1;
      if (between > 0.1 && between < 0.9) shared += 1;
    }
  }
  assert.equal(crossings, 210);
  assert.ok(shared / crossings > 0.3, `only ${shared} of ${crossings} edges share a pixel`);
  // The ground behind the bubbles prints black to the bit.
  assert.deepEqual(pixelAt([], 10.5, 10.5, colourAt, 1), [0, 0, 0]);
  // The frozen draft, edge-on, with its film thinning smoothly and printed without a toe:
  // wherever its film had thinned past its black, the pixel is a grey.
  let draftDarkest = Infinity;
  let draftPixels = 0;
  for (const base of SAMPLE) {
    const burst = base.timeScale * Math.log(DRAFT.START_THICKNESS * (1 + DRAFT.DRAINAGE * (1 - Math.cos(24 * Math.PI / 180)) / 2) / DRAFT.BLACK_THICKNESS);
    const bubble = { ...base, radius: 100, cx: 200, cy: 200, age: burst * 0.999 };
    for (let y = 105; y < 300; y += 1) {
      const v = (y + 0.5 - 200) / 100;
      const z = Math.sqrt(Math.max(0, 1 - v * v));
      if (DRAFT.thicknessAt(bubble, 0, v, z, bubble.age) >= DRAFT.BLACK_THICKNESS) continue;
      draftDarkest = Math.min(draftDarkest, Math.max(...DRAFT.printLight(lightAt([bubble], 200.5, y + 0.5, draftColour, 1, 0.75))));
      draftPixels += 1;
    }
  }
  assert.ok(draftPixels >= 30);
  assert.ok(draftDarkest > 80, `the draft's black film printed at ${draftDarkest}`);
});

test("no film the bubbles reach runs off the end of the table, as the first draft's did", () => {
  // The thickest film there can be: the bottom of a bubble just blown, under the pattern's crest.
  assert.ok(2 * WATER * START_THICKNESS * (1 + DRAINAGE) * Math.exp(SWIRL) < OPD_LIMIT);
  let largest = 0;
  let draftLargest = 0;
  let draftOver = 0;
  let points = 0;
  for (const bubble of BUBBLES) {
    for (const age of agesOf(bubble).filter((unused, k) => k % 4 === 0)) {
      for (const point of SPHERE) {
        largest = Math.max(largest, pathDifference(thicknessAt(bubble, point.x, point.y, point.z, age), viewingCosine(point)));
        const draft = pathDifference(DRAFT.thicknessAt(bubble, point.x, point.y, point.z, age), Math.abs(point.z));
        draftLargest = Math.max(draftLargest, draft);
        if (age === 0 && draft > OPD_LIMIT) draftOver += 1;
        points += 1;
      }
    }
  }
  assert.equal(points, BUBBLE_COUNT * 61 * SPHERE.length);
  assert.ok(largest > 2000 && largest < OPD_LIMIT, `the largest path difference is ${largest}`);
  // The control: the draft's young bubbles lay mostly past the table's end.
  assert.ok(draftLargest > 4 * OPD_LIMIT, `the draft's largest path difference is ${draftLargest}`);
  assert.ok(draftOver > 0.5 * BUBBLE_COUNT * SPHERE.length, `${draftOver} of the draft's young points past the table`);
});

test("the bubbles keep to the canvas, thirteen to eighteen at once and of different ages at every frame", () => {
  let least = Infinity;
  let most = 0;
  let narrowest = Infinity;
  let bubbleFrames = 0;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scene = sceneAt(BUBBLES, frame);
    for (const bubble of scene) {
      assert.ok(bubble.cx - bubble.radius >= 0 && bubble.cx + bubble.radius <= LOGICAL_SIZE);
      assert.ok(bubble.cy - bubble.radius >= 0 && bubble.cy + bubble.radius <= LOGICAL_SIZE);
      bubbleFrames += 1;
    }
    least = Math.min(least, scene.length);
    most = Math.max(most, scene.length);
    const ages = scene.map((bubble) => bubble.age);
    narrowest = Math.min(narrowest, Math.max(...ages) - Math.min(...ages));
  }
  assert.equal(least, 13);
  assert.equal(most, 18);
  // At every frame the eldest is more than two seconds older than the youngest.
  assert.ok(narrowest > 2, `ages ${narrowest} s apart at the narrowest`);
  assert.ok(bubbleFrames > TOTAL_FRAMES * least);
  // Lives are 2.4 to 3.6 seconds, so the loop holds four of them end to end.
  assert.deepEqual(LIFETIMES, [2.4, 3.6]);
  assert.equal(DURATION_SECONDS / ((LIFETIMES[0] + LIFETIMES[1]) / 2), 4);
  for (const bubble of BUBBLES) assert.ok(bubble.lifetime >= LIFETIMES[0] - 1e-9 && bubble.lifetime <= LIFETIMES[1] + 1e-9);
});

test("nothing makes a bubble swing: the air it rides has no sources, comes back with the loop, and carries nearby bubbles alike", () => {
  // The air is the curl of a stream function: its divergence is nought, to rounding.
  let worstDivergence = 0;
  let worstReturn = 0;
  const h = 1e-3;
  for (let k = 0; k < 400; k += 1) {
    const x = ((k * 0.6180339887498949) % 1) * LOGICAL_SIZE;
    const y = ((k * 0.7548776662466927) % 1) * LOGICAL_SIZE;
    const t = ((k * 0.5698402909980532) % 1) * DURATION_SECONDS;
    const divergence = (airAt(x + h, y, t)[0] - airAt(x - h, y, t)[0] + airAt(x, y + h, t)[1] - airAt(x, y - h, t)[1]) / (2 * h);
    worstDivergence = Math.max(worstDivergence, Math.abs(divergence));
    const [u, v] = airAt(x, y, t);
    const [u2, v2] = airAt(x, y, t + DURATION_SECONDS);
    worstReturn = Math.max(worstReturn, Math.abs(u2 - u), Math.abs(v2 - v));
  }
  assert.equal(AIR_WAVES.length, 4);
  assert.ok(worstDivergence < 1e-6, `divergence ${worstDivergence}`);
  assert.ok(worstReturn < 1e-9, `the air misses itself after a loop by ${worstReturn}`);
  // Sideways speeds along every path, frame to frame.
  const series = new Map();
  const pairs = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const now = sceneAt(BUBBLES, frame);
    const next = sceneAt(BUBBLES, frame + 1);
    const moving = [];
    for (const bubble of now) {
      const later = next.find((other) => other.born === bubble.born);
      if (!later || later.age < bubble.age) continue;
      const u = (later.cx - bubble.cx) * PLAYBACK_FPS;
      if (!series.has(bubble.born)) series.set(bubble.born, []);
      series.get(bubble.born).push(u);
      moving.push({ bubble, u });
    }
    if (frame % 3 === 0) {
      for (let i = 0; i < moving.length; i += 1) {
        for (let j = i + 1; j < moving.length; j += 1) {
          const apart = Math.hypot(moving[i].bubble.cx - moving[j].bubble.cx, moving[i].bubble.cy - moving[j].bubble.cy);
          if (apart < 150) pairs.push([moving[i].u, moving[j].u]);
        }
      }
    }
  }
  const all = [...series.values()].flat();
  const mean = all.reduce((sum, u) => sum + u, 0) / all.length;
  const correlation = (lag) => {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (const us of series.values()) {
      for (let k = 0; k + lag < us.length; k += 1) {
        xy += (us[k] - mean) * (us[k + lag] - mean);
        xx += (us[k] - mean) ** 2;
        yy += (us[k + lag] - mean) ** 2;
      }
    }
    return xy / Math.sqrt(xx * yy);
  };
  // Half a second on, a bubble is still going the way it was; a second on, it has not
  // turned round, as a bubble swung on a sine does.
  assert.ok(correlation(15) > 0.8, `half a second: ${correlation(15)}`);
  assert.ok(correlation(30) > 0.5, `a second: ${correlation(30)}`);
  // Bubbles within 150 pixels of each other go sideways together.
  const together = pairs.reduce((sum, [a, b]) => sum + a * b, 0)
    / Math.sqrt(pairs.reduce((sum, [a]) => sum + a * a, 0) * pairs.reduce((sum, [, b]) => sum + b * b, 0));
  assert.ok(pairs.length > 1000);
  assert.ok(together > 0.5, `neighbours: ${together}`);
  const speeds = all.map(Math.abs).sort((a, b) => a - b);
  assert.equal(Math.round(speeds[speeds.length >> 1]), 14);
  // The notes give these numbers, and they are these.
  const section = NOTES.slice(NOTES.indexOf("Stains the White starts from"), NOTES.indexOf("## Install"));
  assert.match(section, new RegExp(`a typical ${Math.round(speeds[speeds.length >> 1])} pixels a second, correlate ${together.toFixed(2)} between bubbles within 150 pixels`, "u"));
  assert.match(section, new RegExp(`correlates ${correlation(15).toFixed(2)} with itself half a second later and ${correlation(30).toFixed(2)} a second later`, "u"));
  assert.match(section, /The breeze is a smooth field, not a solved flow/u);
});

test("a bubble grows to its size in its first BLOWING seconds, from nothing, and never shrinks", () => {
  const bubble = BUBBLES[0];
  const radiusAt = (age) => {
    const frame = Math.round((bubble.born + age) * PLAYBACK_FPS);
    return sceneAt([bubble], frame).find((entry) => entry.born === bubble.born);
  };
  let previous = -1;
  let grown = 0;
  for (let frame = Math.ceil(bubble.born * PLAYBACK_FPS); frame < Math.ceil((bubble.born + bubble.lifetime) * PLAYBACK_FPS); frame += 1) {
    const entry = sceneAt([bubble], frame)[0];
    if (!entry) continue;
    assert.ok(entry.radius >= previous);
    assert.ok(entry.radius <= bubble.radius);
    if (entry.age >= BLOWING) {
      assert.equal(entry.radius, bubble.radius);
      grown += 1;
    }
    previous = entry.radius;
  }
  assert.ok(grown > 60);
  assert.ok(radiusAt(0) === undefined || radiusAt(0).radius < bubble.radius);
  assert.equal(BLOWING, 0.25);
});

test("the registered lines: the three of the dome, from the Pisa edition of 1821", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === QUOTE_ID);
  assert.equal(quote.text, "Life, like a dome of many-coloured glass,\nStains the white radiance of Eternity,\nUntil Death tramples it to fragments.");
  assert.equal(quote.text.split("\n").length, 3);
  assert.equal([...quote.text].length, 118);
  assert.equal(quote.lang, "en");
  assert.equal(quote.author, "Percy Bysshe Shelley");
  assert.equal(quote.source, "Adonais, stanza LII");
  assert.equal(quote.year, 1821);
  assert.equal(quote.publicDomain, true);
  // The viewer's page index counts from nought: n35 is page 24 of the Pisa edition.
  assert.equal(quote.sourceUrl, "https://archive.org/details/shelleyadonias/page/n35/mode/1up");
  assert.equal(quote.original, undefined);
});

test("the notes keep the poem's figure and the project's reading apart, and give the numbers the clip gives", () => {
  const start = NOTES.indexOf("Stains the White starts from");
  const section = NOTES.slice(start, NOTES.indexOf("## Install"));
  assert.ok(start > 0 && section.length > 0 && start < NOTES.indexOf("## Install"));
  assert.match(section, /Those readings are this project's\. The poem says nothing of films, and nothing here is attributed to Shelley\./u);
  assert.doesNotMatch(section, /Shelley (?:knew|says|said|saw|meant) (?:that )?(?:the film|a film|R \+ T)/u);
  // Newton is the observer of the process, not the author of its explanation.
  assert.match(section, /The explanation the code uses, two reflections that cancel because one of them is turned over, is the wave theory's, and nothing of it is attributed to Newton\./u);
  assert.match(section, /like so many concentrick Rings incompassing the top of the Bubble/u);
  assert.match(section, /there grew in the Center of the Rings a small round black Spot/u);
  assert.match(section, /by reflexion of the Skies when of a white Colour, whilst a black Substance was placed behind the Bubble/u);
  // The model's choices are named as choices.
  assert.match(section, /The drop and the rule of the burst are this model's choices, made for the picture, not laws\./u);
  assert.match(section, /are choices of how the picture is made, not of what a film does\./u);
  // Numbers the notes give are the numbers the code gives.
  assert.match(section, new RegExp(`the tests follow ${SPHERE.length} points of every bubble through 241 moments`, "u"));
  assert.match(section, /Sixty bubbles of 24 to 48 logical pixels/u);
  assert.deepEqual(RADII, [24, 48]);
  assert.match(section, /between 13 and 18 of them in the air at a time/u);
  const shown = thumbnailFrame(MANIFEST, MANIFEST.artworks.find((entry) => entry.id === "stains-the-white"));
  assert.match(section, new RegExp(`The thumbnail is frame ${shown}, where six of the seventeen bubbles in the air have opened their black`, "u"));
  const scene = sceneAt(BUBBLES, shown);
  const opened = scene.filter((bubble) => thicknessAt(bubble, 0, -1, 0, bubble.age) === BLACK_FILM);
  assert.equal(scene.length, 17);
  assert.equal(opened.length, 6);
  assert.equal(Math.min(...opened.map((bubble) => bubble.radius)).toFixed(1), "24.5");
  // The printings, and what was and was not read.
  assert.match(section, /\[page 24\]\(https:\/\/archive\.org\/details\/shelleyadonias\/page\/n35\/mode\/1up\), in the facsimile Noel Douglas published in London in 1927 from the British Museum's copy, and in no other printing/u);
  assert.match(section, /\[page 20\]\(https:\/\/archive\.org\/details\/opticksortreatis00newt\/page\/n191\/mode\/1up\)/u);
  assert.match(section, /\[page 188\]\(https:\/\/archive\.org\/details\/opticksortreatis1730newt\/page\/n197\/mode\/1up\)/u);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "stains-the-white");
  const quote = CATALOG.quotes.find((entry) => entry.id === QUOTE_ID);
  assert.equal(artwork.title, "Stains the White");
  assert.equal(artwork.entry, "p5js/artworks/stains-the-white/index.html");
  assert.equal(artwork.interactivePath, "stains-the-white/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, [QUOTE_ID]);
  assert.deepEqual(artwork.thumbnail, { frame: 184 });
  assert.deepEqual(artwork.render, { kind: "video", artifact: "exports/p5js/StainsTheWhite.mp4", durationSeconds: 12, scale: 2 });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `stains-the-white` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 12 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 210);
  assert.equal(body.split("\n").slice(0, 3).join("\n"), quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Stains the White</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
});

test("the sketch draws the film and nothing else, with no switch left to choose a look", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), ["createCanvas", "frameRate", "noLoop", "pixelDensity", "pop", "push", "scale"]);
  // The one thing drawn on the p5 canvas is the card's picture of the films.
  assert.equal((source.match(/drawingContext\.drawImage\(/gu) ?? []).length, 1);
  // The page answers to capture and scale and to nothing else.
  const asked = [...source.matchAll(/PARAMETERS\.get\("([a-zA-Z]+)"\)/gu)].map((match) => match[1]).sort();
  assert.deepEqual(asked, ["capture", "renderScale"]);
});

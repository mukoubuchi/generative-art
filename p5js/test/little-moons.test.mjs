import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  CANOPY_LAYOUT,
  CANOPY_MARGIN,
  CANOPY_SIZE,
  CLEAR_SKY,
  CROWN_LAYER,
  DURATION_SECONDS,
  ECLIPSE,
  GUST,
  LAYER_HEIGHTS,
  LOGICAL_SIZE,
  MOON_REACH,
  PLACEMENT_STRIDE,
  PLAYBACK_FPS,
  SHADE_LIGHT,
  SKY_LIGHT,
  SUB_ROWS,
  SUN_ANGULAR_RADIUS,
  TOTAL_FRAMES,
  brightChords,
  buildCanopy,
  buildLeaves,
  canopyAt,
  crownDepth,
  gustAt,
  holePieces,
  layerLight,
  leafPlacement,
  lightAt,
  moonAt,
  rowSums,
  shadeLightAt,
  skyIsBright,
  skyPastCrown,
  sunShowing,
  windAt
} from "../artworks/little-moons/little-moons.js";
import { swayAt as rigidSwayAt } from "./fixtures/little-moons-rigid-sway/sway.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/little-moons/sketch.js", import.meta.url);
const QUOTE_ID = "pseudo-aristoteles-meniskoi";

const CLEAR = CLEAR_SKY;
const LEAVES = buildLeaves();

/** A canopy layer with nothing open but what `open(x, y)` says, in canvas coordinates, sampled 8×8 per cell. */
function layerWith(open) {
  const mask = new Float32Array(CANOPY_SIZE * CANOPY_SIZE);
  for (let row = 0; row < CANOPY_SIZE; row += 1) {
    for (let column = 0; column < CANOPY_SIZE; column += 1) {
      let count = 0;
      for (let sy = 0; sy < 8; sy += 1) {
        for (let sx = 0; sx < 8; sx += 1) {
          const x = column + (sx + 0.5) / 8 - CANOPY_MARGIN;
          const y = row + (sy + 0.5) / 8 - CANOPY_MARGIN;
          if (open(x, y)) count += 1;
        }
      }
      mask[row * CANOPY_SIZE + column] = count / 64;
    }
  }
  return { mask, sums: rowSums(mask, CANOPY_SIZE) };
}

const square = (cx, cy, side) => (x, y) => Math.abs(x - cx) <= side / 2 && Math.abs(y - cy) <= side / 2;
const disk = (cx, cy, radius) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
/** A right triangle with its right angle at the lower left, legs `leg`, centroid at (cx, cy). */
const triangle = (cx, cy, leg) => (x, y) => {
  const u = x - (cx - leg / 3);
  const v = (cy + leg / 3) - y;
  return u >= 0 && v >= 0 && u + v <= leg;
};

/** The light of one layer on the ground around (cx, cy), pixel centres, `reach` pixels each way. */
function lightAround(layer, height, cx, cy, reach, moon) {
  const cells = [];
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y += 1) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x += 1) {
      cells.push({ x: x + 0.5, y: y + 0.5, light: layerLight(layer, CANOPY_SIZE, x + 0.5, y + 0.5, height, moon) });
    }
  }
  return cells;
}

function centroid(cells, weight) {
  let total = 0;
  let sx = 0;
  let sy = 0;
  for (const cell of cells) {
    const w = weight(cell);
    total += w;
    sx += w * cell.x;
    sy += w * cell.y;
  }
  return { x: sx / total, y: sy / total, total };
}

/** Frames at which the moon's offset is a quarter-multiple of a sun radius, so every product below is exact. */
const QUARTER_FRAMES = [126, 144, 216, 234];

test("the clip is twelve seconds at thirty frames, and the moon starts and ends clear of the sun", () => {
  assert.equal(TOTAL_FRAMES, 360);
  assert.equal(TOTAL_FRAMES / PLAYBACK_FPS, 12);
  const first = moonAt(0);
  const last = moonAt(TOTAL_FRAMES - 1);
  const clear = (moon) => Math.hypot(moon.x, moon.y) >= 1 + moon.ratio;
  assert.ok(clear(first) && clear(last));
  // The frame after the last is the first again: the clip closes on the same sky.
  assert.deepEqual(moonAt(TOTAL_FRAMES), first);
  assert.equal(first.x, -MOON_REACH);
});

test("the moon's offset is exact at the quarter frames, and the eclipse is where it should be", () => {
  const partial = ECLIPSE;
  assert.deepEqual(QUARTER_FRAMES.map((frame) => moonAt(frame).x), [-0.75, -0.5, 0.5, 0.75]);
  // The sun is first touched where the centres are one sun plus one moon radius apart.
  const contact = Math.sqrt((1 + partial.moonRatio) ** 2 - partial.impact ** 2);
  const touched = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const moon = moonAt(frame);
    if (Math.hypot(moon.x, moon.y) < 1 + moon.ratio) touched.push(frame);
  }
  assert.equal(touched[0], Math.floor((MOON_REACH - contact) * TOTAL_FRAMES / (2 * MOON_REACH)) + 1);
  assert.equal(touched.at(-1), TOTAL_FRAMES - touched[0]);
});

test("the bright sky is the sun's disk with the moon's taken out, and the renderer's chords are exactly that set", () => {
  // On a lattice of quarter points, every point is decided the same way by the one test of
  // the sky and by the chords the light is summed over. The clip's own moon at the quarter
  // frames, and a smaller one standing inside the sun, whose chord splits the sun's in two.
  const inside = { x: 0.25, y: -0.25, ratio: 0.5 };
  let split = 0;
  for (const height of LAYER_HEIGHTS) {
    for (const moon of [...QUARTER_FRAMES.map((frame) => moonAt(frame)), inside]) {
      for (let qy = -4 * height + 1; qy < 4 * height; qy += 2) {
        const dy = qy / 4;
        const chords = brightChords(dy, height, moon);
        if (chords.length === 2) split += 1;
        for (let qx = -4 * height; qx <= 4 * height; qx += 1) {
          const dx = qx / 4 + 1 / 8;
          const inChord = chords.some(([from, to]) => dx > from && dx < to);
          assert.equal(inChord, skyIsBright({ x: dx, y: dy }, height, moon), `${height} ${moon.x} ${dx} ${dy}`);
        }
      }
    }
  }
  // The split rows were visited: the case of two chords is tested, not only described.
  assert.ok(split > 0);
});

test("a small hole turns the sky through a half turn: the moon's image falls opposite the moon, as an exact identity", () => {
  // The ground point g sees, through a hole at y, the sky point y − g. The dark centre of the
  // image is therefore at y − h·m, on the far side of the hole from where the moon stands,
  // and the point on the moon's own side, y + h·m, is lit.
  const hole = { x: 340, y: 340 };
  for (const height of LAYER_HEIGHTS) {
    for (const frame of QUARTER_FRAMES) {
      const moon = moonAt(frame);
      const biteCentre = { x: hole.x - height * moon.x, y: hole.y - height * moon.y };
      const sameSide = { x: hole.x + height * moon.x, y: hole.y + height * moon.y };
      const seen = (ground) => skyIsBright({ x: hole.x - ground.x, y: hole.y - ground.y }, height, moon);
      assert.equal(seen(biteCentre), false);
      assert.equal(seen(sameSide), true);
      // Both are exact: every product above is of an integer and a quarter-multiple.
      assert.ok(Number.isInteger(4 * biteCentre.x) && Number.isInteger(64 * biteCentre.y));
    }
  }
});

/** Where the light an eclipse takes from an image went, and where the whole image was, around (cx, cy). */
function lossAround(layer, height, cx, cy, reach, moon) {
  const clear = lightAround(layer, height, cx, cy, reach, CLEAR);
  const eclipsed = lightAround(layer, height, cx, cy, reach, moon);
  return {
    lit: centroid(clear, (cell) => cell.light),
    lost: centroid(eclipsed.map((cell, at) => ({ ...cell, lost: clear[at].light - cell.light })), (cell) => cell.lost)
  };
}

/** The angle, in degrees, between where the lost light went and straight away from the moon. */
function bearingOff({ lit, lost }, moon) {
  const bearing = Math.atan2(lost.y - lit.y, lost.x - lit.x);
  const away = Math.atan2(-moon.y, -moon.x);
  return Math.abs(Math.atan2(Math.sin(bearing - away), Math.cos(bearing - away))) * 180 / Math.PI;
}

test("on the drawn light, the part a small hole loses is on the far side from the moon, in every layer", () => {
  for (const height of LAYER_HEIGHTS) {
    const layer = layerWith(square(340, 340, 2));
    for (const frame of [100, 144, 180, 216, 260]) {
      const moon = moonAt(frame);
      const loss = lossAround(layer, height, 340, 340, height + 3, moon);
      // The uneclipsed image is centred on the hole.
      assert.ok(Math.hypot(loss.lit.x - 340, loss.lit.y - 340) < 0.02, `${height}: ${loss.lit.x} ${loss.lit.y}`);
      // Away from the moon to within half a degree. What is left is the rows being read at
      // four heights each rather than continuously: at most 0.16 degrees, at the lowest layer.
      assert.ok(bearingOff(loss, moon) < 0.5, `${height} ${frame}: ${bearingOff(loss, moon)} degrees`);
      // And nowhere near where a shadow cast straight down would put it.
      const shadowSide = { x: 340 + height * moon.x, y: 340 + height * moon.y };
      assert.ok(Math.hypot(loss.lost.x - shadowSide.x, loss.lost.y - shadowSide.y) > height * Math.hypot(moon.x, moon.y));
    }
  }
});

/** How much of the light two maps of the same grid put in different places: L1 over the total. */
function difference(first, second) {
  let apart = 0;
  let total = 0;
  first.forEach((cell, at) => {
    apart += Math.abs(cell.light - second[at].light);
    total += cell.light;
  });
  return apart / total;
}

/** A square, a disk and a right triangle of one area, centred alike: the widest disagreement among their images. */
function shapeSpread(area, height, reach, moon) {
  const side = Math.sqrt(area);
  const holes = [square(340, 340, side), disk(340, 340, side / Math.sqrt(Math.PI)), triangle(340, 340, side * Math.SQRT2)];
  const maps = holes.map((open) => lightAround(layerWith(open), height, 340, 340, reach, moon));
  return Math.max(difference(maps[0], maps[1]), difference(maps[0], maps[2]));
}

test("a small hole's image is the sun's, whatever the hole's shape; a large hole's is the hole's", () => {
  const moon = moonAt(180);
  // Area nine under the highest layer's sun: the three shapes put all but a few hundredths
  // of their light in the same places.
  const small = shapeSpread(9, 21, 24, moon);
  assert.ok(small < 0.1, `small holes disagree on ${small} of their light`);
  // The same holes under a sun a twenty-first the size: now it is their shapes that show.
  const noSun = shapeSpread(9, 1, 4, CLEAR);
  assert.ok(noSun > 0.25 && noSun > 3 * small, `with no sun to speak of the holes still agree, ${noSun}`);
  // Area 3600 under the lowest layer's sun: the hole's shape is what shows.
  const large = shapeSpread(3600, 9, 55, moon);
  assert.ok(large > 0.25, `large holes disagree on only ${large} of their light`);
});

test("the square's image keeps its corners only when the hole is large", () => {
  // Along the diagonal and along the axis, how far the image reaches before it falls to half.
  function reachAtHalf(layer, height, direction, limit) {
    const peak = layerLight(layer, CANOPY_SIZE, 340, 340, height, CLEAR);
    for (let step = 0; step < limit * 8; step += 1) {
      const distance = step / 8;
      if (layerLight(layer, CANOPY_SIZE, 340 + direction.x * distance, 340 + direction.y * distance, height, CLEAR) < peak / 2) {
        return distance;
      }
    }
    return Infinity;
  }
  const diagonal = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  const axis = { x: 1, y: 0 };
  const small = layerWith(square(340, 340, 3));
  const smallRatio = reachAtHalf(small, 21, diagonal, 30) / reachAtHalf(small, 21, axis, 30);
  assert.ok(Math.abs(smallRatio - 1) < 0.05, `the small square's image reaches ${smallRatio} as far along the diagonal`);
  const large = layerWith(square(340, 340, 60));
  const largeRatio = reachAtHalf(large, 9, diagonal, 60) / reachAtHalf(large, 9, axis, 60);
  // Nearer a square's √2 than a disk's 1.
  assert.ok(largeRatio > (1 + Math.SQRT2) / 2, `the large square's image reaches only ${largeRatio} as far along the diagonal`);
});

test("the canopy is laid the same every time and its holes are counted", () => {
  const canopy = buildCanopy();
  assert.equal(canopy.size, CANOPY_SIZE);
  assert.equal(CANOPY_SIZE, LOGICAL_SIZE + 2 * CANOPY_MARGIN);
  assert.equal(canopy.leaves, 12289);
  assert.deepEqual(canopy.layers.map((layer) => holePieces(layer.mask, canopy.size).length), [1098, 643, 543]);
  const again = buildCanopy();
  canopy.layers.forEach((layer, index) => assert.deepEqual(again.layers[index].mask, layer.mask));
});

/** A layer holding one hole of the real canopy and nothing else. */
function layerOfPiece(source, piece) {
  const mask = new Float32Array(CANOPY_SIZE * CANOPY_SIZE);
  for (const index of piece.indices) mask[index] = source.mask[index];
  return { mask, sums: rowSums(mask, CANOPY_SIZE) };
}

/** An image sampled on a grid centred on the hole's own centroid, scaled to one unit of light. */
function imageOf(layer, height, piece, moon, reach) {
  const cells = [];
  for (let j = -reach; j <= reach; j += 1) {
    for (let i = -reach; i <= reach; i += 1) {
      cells.push({ x: i, y: j, light: layerLight(layer, CANOPY_SIZE, piece.x + i, piece.y + j, height, moon) });
    }
  }
  const total = cells.reduce((sum, cell) => sum + cell.light, 0);
  return cells.map((cell) => ({ ...cell, light: cell.light / total }));
}

test("every small hole of one height throws the same image the same way round, and each height its own", () => {
  // The leaves move, so the holes are taken from the canopy as it is laid at five frames of
  // the clip, each under the sky of frame 144.
  const moon = moonAt(144);
  const reach = Math.max(...LAYER_HEIGHTS) + 3;
  const within = LAYER_HEIGHTS.map(() => []);
  let across = Infinity;
  for (const frame of [0, 72, 144, 216, 288]) {
    const canopy = buildCanopy(frame);
    const chosen = LAYER_HEIGHTS.map((height, index) => {
      const small = holePieces(canopy.layers[index].mask, canopy.size).filter((piece) => piece.area >= 1 && piece.cells <= 6
        && piece.x > reach && piece.x < LOGICAL_SIZE - reach && piece.y > reach && piece.y < LOGICAL_SIZE - reach);
      assert.ok(small.length >= 10, `${frame} ${height}: only ${small.length} small holes`);
      return Array.from({ length: 10 }, (unused, k) => small[Math.floor(k * small.length / 10)]);
    });
    const images = chosen.map((pieces, index) => pieces.map((piece) => {
      const layer = layerOfPiece(canopy.layers[index], piece);
      const height = LAYER_HEIGHTS[index];
      // Each hole alone, so no neighbour's light is counted as its own.
      const loss = lossAround(layer, height, piece.x, piece.y, height + 3, moon);
      assert.ok(bearingOff(loss, moon) < 0.5, `${height}: a hole's loss is ${bearingOff(loss, moon)} degrees off`);
      return imageOf(layer, height, piece, moon, reach);
    }));
    images.forEach((sameHeight, index) => within[index].push(Math.max(...sameHeight.map((image) => difference(image, sameHeight[0])))));
    across = Math.min(across, ...[[0, 1], [0, 2], [1, 2]].flatMap(([a, b]) =>
      images[a].flatMap((first) => images[b].map((second) => difference(first, second)))));
  }
  // Within a height the images agree, and the more nearly so the smaller the hole is beside
  // its sun: the lowest layer's small holes are a third of its sun across, the highest's a
  // seventh. Ten holes are few, so the order is asked of the median over the five frames.
  // Across heights they are different suns and disagree on most of their light.
  const median = within.map((values) => [...values].sort((a, b) => a - b)[2]);
  assert.ok(median[2] < median[1] && median[1] < median[0], `${median}`);
  assert.ok(Math.max(...within.flat()) < across / 4, `within ${within}, across ${across}`);
});

test("the light at a point is each layer's light under its own sun, added, through the canopy laid for the frame", () => {
  // This is the reference the graphics card is checked against, so it is pinned by what it
  // is made of rather than by a picture.
  for (const frame of [0, 150, 180, 290]) {
    const canopy = canopyAt(LEAVES, frame);
    const moon = moonAt(frame);
    for (const [x, y] of [[100.5, 200.5], [340.25, 339.75], [611.5, 77.5], [5.5, 674.5]]) {
      const added = canopy.layers.reduce((sum, layer, index) =>
        sum + layerLight(layer, canopy.size, x, y, LAYER_HEIGHTS[index], moon), 0);
      assert.equal(lightAt(canopy, x, y, frame), added);
    }
  }
  // And there is light to add: the check is not passing on darkness.
  const canopy = canopyAt(LEAVES, 0);
  let lit = 0;
  for (let x = 0.5; x < LOGICAL_SIZE; x += 5) lit += lightAt(canopy, x, 340.5, 0) > 0.01;
  assert.ok(lit >= 10, `only ${lit} lit samples`);
});

test("reading each row of cells at several heights leaves no stripes: the light is what a much finer reading gives", () => {
  // Read once, at its middle, a row switches on or off whole as the sun's rim passes it,
  // and the images come out striped across. The fix is only as good as its agreement with
  // a reading eight times finer, around real holes of every layer, on a half-pixel grid.
  assert.equal(SUB_ROWS, 4);
  const canopy = buildCanopy(180);
  const moon = moonAt(180);
  LAYER_HEIGHTS.forEach((height, index) => {
    const small = holePieces(canopy.layers[index].mask, canopy.size).filter((piece) => piece.area >= 1 && piece.cells <= 6
      && piece.x > 40 && piece.x < LOGICAL_SIZE - 40 && piece.y > 40 && piece.y < LOGICAL_SIZE - 40);
    const worst = { once: 0, used: 0 };
    for (const piece of [0, 1, 2].map((k) => small[Math.floor(k * small.length / 3)])) {
      const read = (subRows) => {
        const values = [];
        for (let j = -2 * (height + 2); j <= 2 * (height + 2); j += 1) {
          for (let i = -2 * (height + 2); i <= 2 * (height + 2); i += 1) {
            values.push(layerLight(canopy.layers[index], canopy.size, piece.x + i / 2, piece.y + j / 2, height, moon, subRows));
          }
        }
        return values;
      };
      const fine = read(32);
      const peak = Math.max(...fine);
      const off = (values) => Math.max(...values.map((value, at) => Math.abs(value - fine[at]))) / peak;
      worst.once = Math.max(worst.once, off(read(1)));
      worst.used = Math.max(worst.used, off(read(SUB_ROWS)));
    }
    assert.ok(worst.used < 0.05, `${height}: off by ${worst.used} of the peak`);
    // The control: read once, the same images are off by three times as much or more.
    assert.ok(worst.once > 3 * worst.used, `${height}: a single reading is only ${worst.once} off, against ${worst.used}`);
  });
});

/** A point's motion over the clip, one value a frame. */
function motionAt(x, y, key) {
  return Array.from({ length: TOTAL_FRAMES }, (unused, frame) => windAt(x, y, frame / PLAYBACK_FPS)[key]);
}

function correlation(first, second) {
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const a = mean(first);
  const b = mean(second);
  let across = 0;
  let spreadA = 0;
  let spreadB = 0;
  first.forEach((value, at) => {
    across += (value - a) * (second[at] - b);
    spreadA += (value - a) ** 2;
    spreadB += (second[at] - b) ** 2;
  });
  return across / Math.sqrt(spreadA * spreadB);
}

/**
 * How nearly a motion comes back to where it was once it has gone away: its correlation with
 * itself, round the loop, at the largest lag past the first lag where that falls to nought
 * and short of the clip itself. A sine comes back to one at its period.
 */
function comesBack(series) {
  const at = (lag) => correlation(series, series.map((unused, index) => series[(index + lag) % series.length]));
  let first = 1;
  while (first < series.length && at(first) > 0) first += 1;
  let most = -1;
  for (let lag = first; lag <= series.length - first; lag += 1) most = Math.max(most, at(lag));
  return most;
}

/** Points spread over the canvas, the same every run. */
const SPREAD = Array.from({ length: 36 }, (unused, index) => ({ x: 45 + (index % 6) * 118 + (index % 5) * 7, y: 45 + Math.floor(index / 6) * 118 + (index % 4) * 9 }));

test("a leaf moves with the air where it grows and with nothing of its own: two leaves at one place are moved alike, near ones together", () => {
  // Two leaves at one place, as unlike as the canopy's leaves come: they are shifted, turned
  // and narrowed alike, because the wind is asked only where they are.
  const pair = { ...LEAVES, leaves: [
    { x: 400.3, y: 300.7, length: 7, width: 2.66, angle: 0.2, layer: 0 },
    { x: 400.3, y: 300.7, length: 12, width: 7.2, angle: 2.9, layer: 2 }
  ] };
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  for (const frame of [0, 97, 180, 311]) {
    const placement = leafPlacement(pair, frame / PLAYBACK_FPS);
    const second = PLACEMENT_STRIDE;
    assert.equal(placement[0], placement[second]);
    assert.equal(placement[1], placement[second + 1]);
    const turn = (offset, angle) => Math.atan2(placement[offset + 5], placement[offset + 4]) - angle;
    assert.ok(Math.abs(wrap(turn(0, 0.2) - turn(second, 2.9))) < 1e-6);
    const narrowing = (offset, width) => 1 / placement[offset + 7] / width;
    assert.ok(Math.abs(narrowing(0, 2.66) - narrowing(second, 7.2)) < 1e-6);
  }
  // Leaves a few pixels apart are carried together and nearly turned together; leaves a few
  // hundred pixels apart are not carried as one sheet.
  let near = 1;
  let nearTurn = 1;
  let far = -1;
  for (const { x, y } of SPREAD) {
    const here = motionAt(x, y, "dx");
    near = Math.min(near, correlation(here, motionAt(x + 4, y + 4, "dx")));
    nearTurn = Math.min(nearTurn, correlation(motionAt(x, y, "turn"), motionAt(x + 4, y + 4, "turn")));
    far = Math.max(far, correlation(here, motionAt(x + 300, y - 200, "dx")));
  }
  assert.ok(near > 0.98, `near leaves carried together only to ${near}`);
  assert.ok(nearTurn > 0.6, `near leaves turned together only to ${nearTurn}`);
  assert.ok(far < 0.8, `far leaves carried as one sheet, to ${far}`);
});

test("no leaf comes round again at a fixed period: the rigid sway it replaced did, the wind does not", () => {
  let most = { dx: -1, dy: -1, turn: -1 };
  for (const { x, y } of SPREAD) {
    for (const key of Object.keys(most)) most[key] = Math.max(most[key], comesBack(motionAt(x, y, key)));
  }
  for (const [key, value] of Object.entries(most)) assert.ok(value < 0.9, `${key} comes back to ${value}`);
  // The control: the sway v1.28.0 published, frozen outside the artwork, comes back exactly,
  // across in two of its three layers and up and down in all three.
  const rigid = (layer, key) => comesBack(Array.from({ length: TOTAL_FRAMES }, (unused, frame) => rigidSwayAt(frame, layer)[key]));
  assert.ok(rigid(0, "x") > 0.999 && rigid(1, "x") > 0.999);
  for (const layer of [0, 1, 2]) assert.ok(rigid(layer, "y") > 0.999);
});

test("the wind closes on itself in twelve seconds, with no seam", () => {
  let apart = 0;
  let step = 0;
  let seam = 0;
  for (const { x, y } of SPREAD) {
    const start = windAt(x, y, 0);
    const again = windAt(x, y, DURATION_SECONDS);
    for (const key of ["dx", "dy", "turn", "width"]) apart = Math.max(apart, Math.abs(start[key] - again[key]));
    apart = Math.max(apart, Math.abs(gustAt(x, y, 0) - gustAt(x, y, DURATION_SECONDS)));
    let previous = start;
    for (let frame = 1; frame < TOTAL_FRAMES; frame += 1) {
      const now = windAt(x, y, frame / PLAYBACK_FPS);
      step = Math.max(step, Math.hypot(now.dx - previous.dx, now.dy - previous.dy));
      previous = now;
    }
    seam = Math.max(seam, Math.hypot(start.dx - previous.dx, start.dy - previous.dy));
  }
  assert.ok(apart < 1e-9, `the wind at twelve seconds is ${apart} from the wind at nought`);
  // From the last frame to the first, the leaves move no further than between any two frames.
  assert.ok(seam <= step, `the seam moves ${seam}, against ${step}`);
});

test("gusts cross the crown one way, at the wind's speed, and lean and stir the leaves they reach", () => {
  const peakFrame = (x, y) => {
    let best = -1;
    let at = 0;
    for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
      const strength = gustAt(x, y, frame / PLAYBACK_FPS);
      if (strength > best) {
        best = strength;
        at = frame;
      }
    }
    return at;
  };
  // Along the wind, every 150 pixels, the strongest gust arrives half a second later.
  const along = [-300, -150, 0, 150, 300].map((distance) => peakFrame(365 + distance * Math.cos(GUST.heading), 365 + distance * Math.sin(GUST.heading)));
  const steps = along.slice(1).map((frame, index) => (frame - along[index] + TOTAL_FRAMES) % TOTAL_FRAMES);
  const expected = 150 / GUST.speed * PLAYBACK_FPS;
  for (const stepped of steps) assert.ok(Math.abs(stepped - expected) <= 1, `a gust stepped ${stepped} frames in 150 pixels`);
  // Where a gust is, the branches lean downwind and the leaves turn harder than in the calm.
  let lean = 0;
  let leanCalm = 0;
  const turned = [];
  const turnedCalm = [];
  for (const { x, y } of SPREAD) {
    for (let frame = 0; frame < TOTAL_FRAMES; frame += 3) {
      const t = frame / PLAYBACK_FPS;
      const strength = gustAt(x, y, t);
      const wind = windAt(x, y, t);
      const downwind = wind.dx * Math.cos(GUST.heading) + wind.dy * Math.sin(GUST.heading);
      if (strength > 0.5) {
        lean += downwind;
        turned.push(Math.abs(wind.turn));
      }
      if (strength < 0.1) {
        leanCalm += downwind;
        turnedCalm.push(Math.abs(wind.turn));
      }
    }
  }
  assert.ok(turned.length > 200 && turnedCalm.length > 200, `${turned.length} in gusts, ${turnedCalm.length} calm`);
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  assert.ok(lean / turned.length - leanCalm / turnedCalm.length > 3, `leaning ${lean / turned.length} in gusts and ${leanCalm / turnedCalm.length} in the calm`);
  assert.ok(median(turned) > 2 * median(turnedCalm), `turning ${median(turned)} in gusts and ${median(turnedCalm)} in the calm`);
});

test("the light in the shade is the sky's and the canopy's glow, and the eclipse dims it with the sun", () => {
  // The share of the sun left showing, against a count on a fine grid of the sun's disk.
  for (const frame of [0, 100, 150, 180]) {
    const moon = moonAt(frame);
    const steps = 1200;
    let inside = 0;
    let bright = 0;
    for (let i = 0; i < steps; i += 1) {
      for (let j = 0; j < steps; j += 1) {
        const x = -1 + (i + 0.5) * 2 / steps;
        const y = -1 + (j + 0.5) * 2 / steps;
        if (x * x + y * y >= 1) continue;
        inside += 1;
        if ((x - moon.x) ** 2 + (y - moon.y) ** 2 >= moon.ratio ** 2) bright += 1;
      }
    }
    assert.ok(Math.abs(sunShowing(moon) - bright / inside) < 1e-3, `${frame}: ${sunShowing(moon)} against ${bright / inside}`);
  }
  assert.equal(sunShowing(moonAt(0)), 1);
  for (const [x, y] of [[100, 300], [480, 420], [600, 120]]) {
    const sky = skyPastCrown(crownDepth(CANOPY_LAYOUT.crown, x, y));
    const whole = shadeLightAt(x, y, 1);
    assert.ok(Math.abs(whole - (SHADE_LIGHT * (1 - sky) + SKY_LIGHT * sky)) < 1e-15);
    // At the deepest point of the eclipse the shade has a quarter of its light, as the sun has.
    const deepest = sunShowing(moonAt(TOTAL_FRAMES / 2));
    assert.ok(Math.abs(shadeLightAt(x, y, deepest) / whole - deepest) < 1e-12);
    assert.ok(Math.abs(deepest - 0.25) < 0.001);
  }
  // Deeper under the crown, less of the sky past its edge reaches the ground.
  const at = (depth) => SHADE_LIGHT * (1 - skyPastCrown(depth)) + SKY_LIGHT * skyPastCrown(depth);
  assert.ok(at(500) < at(0) && at(0) < at(-500) && at(500) > SHADE_LIGHT);
});

test("the sky past the crown's edge is the share a straight edge leaves, weighed as it lights the ground", () => {
  // A crown at height H, its edge a straight line at distance s from the ground point (s > 0
  // under the crown). A direction at zenith angle θ and azimuth φ from the edge's outward
  // normal passes the edge when H tan θ cos φ > s; its weight on level ground is cos θ.
  const H = LAYER_HEIGHTS[CROWN_LAYER] / SUN_ANGULAR_RADIUS;
  for (const s of [-2000, -300, 0, 300, 2000]) {
    const steps = 100000;
    let share = 0;
    for (let i = 0; i < steps; i += 1) {
      const zenith = (i + 0.5) * (Math.PI / 2) / steps;
      const bound = s / (H * Math.tan(zenith));
      const around = bound >= 1 ? 0 : bound <= -1 ? 1 : Math.acos(bound) / Math.PI;
      share += around * 2 * Math.cos(zenith) * Math.sin(zenith) * (Math.PI / 2) / steps;
    }
    assert.ok(Math.abs(skyPastCrown(s) - share) < 1e-5, `${s}: ${skyPastCrown(s)} against ${share}`);
  }
  assert.equal(skyPastCrown(0), 0.5);
});

test("past the crown's edge the ground is open and lit by one sun", () => {
  for (const frame of [0, 180, 359]) {
    const canopy = canopyAt(LEAVES, frame);
    const moon = moonAt(frame);
    let points = 0;
    let off = 0;
    for (let y = 5; y < LOGICAL_SIZE; y += 10) {
      for (let x = 5; x < LOGICAL_SIZE; x += 10) {
        // Further out than a leaf, carried by the strongest wind, and the widest sun can reach.
        if (crownDepth(CANOPY_LAYOUT.crown, x, y) >= -60) continue;
        points += 1;
        canopy.layers.forEach((layer, index) => {
          const light = layerLight(layer, canopy.size, x, y, LAYER_HEIGHTS[index], moon);
          if (index !== CROWN_LAYER) assert.equal(light, 0);
        });
        off = Math.max(off, Math.abs(lightAt(canopy, x, y, frame) - sunShowing(moon)));
      }
    }
    assert.ok(points >= 500, `only ${points} points past the edge`);
    // With the sun whole the light is one; eclipsed, the share of the sun that shows, to the
    // reading of the rows at four heights.
    assert.ok(frame === 180 ? off < 1e-3 : off < 1e-12, `${frame}: off by ${off}`);
  }
});

test("the wind carries no leaf further than the grid's leaves reach, nor bares ground of another height at the crown's edge", () => {
  // The largest shift of any leaf, at every third frame; between those frames a leaf moves
  // by less than the largest move between two frames, which the seam test bounds.
  let shift = 0;
  let move = 0;
  LEAVES.leaves.forEach((leaf, index) => {
    let previous = null;
    for (let frame = 0; frame < TOTAL_FRAMES; frame += index % 10 === 0 ? 1 : 3) {
      const wind = windAt(leaf.x, leaf.y, frame / PLAYBACK_FPS);
      shift = Math.max(shift, Math.hypot(wind.dx, wind.dy));
      if (index % 10 === 0 && previous) move = Math.max(move, Math.hypot(wind.dx - previous.dx, wind.dy - previous.dy));
      previous = wind;
    }
  });
  const reach = shift + 1.5 * move;
  assert.ok(reach < 25, `a leaf can be carried ${reach}`);
  // A leaf that can reach a cell the canvas reads was laid: the canvas reads cells down to
  // the margin less the widest sun, and a leaf reaches half its longest length past its centre.
  const longest = Math.max(...CANOPY_LAYOUT.leafLength);
  assert.ok(reach + longest - (CANOPY_MARGIN - Math.max(...LAYER_HEIGHTS)) <= CANOPY_LAYOUT.pad);
  // Where the wind can bare the ground at the crown's edge, the sheet is at the crown's one height.
  assert.ok(reach <= CANOPY_LAYOUT.rim);
  let rim = 0;
  for (let row = 0; row < CANOPY_SIZE; row += 1) {
    for (let column = 0; column < CANOPY_SIZE; column += 1) {
      if (crownDepth(CANOPY_LAYOUT.crown, column + 0.5 - CANOPY_MARGIN, row + 0.5 - CANOPY_MARGIN) >= CANOPY_LAYOUT.rim) continue;
      rim += 1;
      assert.equal(LEAVES.layerOf[row * CANOPY_SIZE + column], CROWN_LAYER);
    }
  }
  assert.ok(rim > 100000, `only ${rim} cells at the edge or past it`);
});

test("the archived original: the question as Bekker prints it, with the omission marked", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === QUOTE_ID);
  const original = quote.original;
  assert.equal(original.text, "Διὰ τί ἐν ταῖς τοῦ ἡλίου ἐκλείψεσιν, ἐάν τις θεωρῇ διὰ κοσκίνου ἢ φύλλων, οἷον πλατάνου … μηνίσκοι αἱ αὐγαὶ ἐπὶ τῆς γῆς γίνονται;");
  assert.equal(original.text, original.text.normalize("NFC"));
  assert.equal([...original.text].length, 129);
  // Bekker sets no comma after the sieve; Didot does, and the catalog follows the page it links.
  assert.match(original.text, /κοσκίνου ἢ/u);
  // The question mark is the semicolon, which is what NFC makes of the Greek question mark.
  assert.ok(original.text.endsWith(";"));
  assert.equal(original.lang, "grc");
  assert.equal(original.author, "[Ἀριστοτέλης]");
  assert.equal(original.source, "Problemata XV.11, 912b11–20");
  assert.equal(original.year, null);
  assert.equal(original.publicDomain, true);
  // The viewer's page index counts from nought: n130 is page 912. The download path does not.
  assert.equal(original.sourceUrl, "https://archive.org/details/b33521311_0002/page/n130/mode/1up");
  assert.equal(quote.rendering, "English rendering");
  assert.equal(quote.author, "Pseudo-Aristotle");
  assert.equal(quote.source, "Problems XV.11");
  assert.equal(quote.sourceUrl, original.sourceUrl);
  assert.equal([...quote.text].length, 153);
  // The same omission, marked in both.
  assert.equal((quote.text.match(/…/gu) ?? []).length, 1);
  assert.equal((original.text.match(/…/gu) ?? []).length, 1);
  assert.equal(CATALOG.quotes.filter((entry) => (entry.original ?? entry).lang === "grc").length, 11);
});

test("the notes keep the book's claim and the project's reading apart", () => {
  const section = NOTES.slice(NOTES.indexOf("Little Moons starts from"), NOTES.indexOf("## Install"));
  assert.ok(section.length > 0 && NOTES.indexOf("Little Moons starts from") < NOTES.indexOf("## Install"));
  assert.match(section, /transmitted under Aristotle's name and put together in his school/u);
  assert.match(section, /The word is μηνίσκοι, little moons, and the title is that word/u);
  // The half turn is the geometry's and the project's; the book goes as far as the far side.
  assert.match(section, /Those three readings are this project's\. The book says only that the crescent is on the other side from the light\./u);
  assert.doesNotMatch(section, /(?:Aristotle|the book|the Problems) (?:says|knew|describes) (?:that )?the (?:image|crescent) is (?:turned|inverted|reversed)/u);
  assert.match(section, /It names no dark room, no screen and no instrument/u);
  // The model's reach, said once.
  assert.match(section, /geometric optics and nothing more/u);
  assert.match(section, /there is no diffraction/u);
  // The two printings, the one difference inside the range, and the translation the sense was checked against.
  assert.match(section, /Bekker's Berlin edition of 1831, volume 2, \[page 912\]\(https:\/\/archive\.org\/details\/b33521311_0002\/page\/n130\/mode\/1up\)/u);
  assert.match(section, /the Didot edition, \*Aristotelis opera omnia\* IV, Paris 1878, page 196/u);
  assert.match(section, /`κοσκίνου ἢ\] Bekker : κοσκίνου, ἢ Didot`/u);
  assert.match(section, /E\. S\. Forster's translation in the Oxford \*Works of Aristotle\*, volume VII, 1927/u);
  // Numbers the notes give are the numbers the code and the canopy give.
  assert.match(section, /which is 9, 14 and 21 logical pixels/u);
  assert.deepEqual(LAYER_HEIGHTS, [9, 14, 21]);
  assert.match(section, /The leaves are 12,289 ellipses fourteen to twenty-four pixels long/u);
  assert.equal(LEAVES.leaves.length, 12289);
  assert.deepEqual(CANOPY_LAYOUT.leafLength, [7, 12]);
  assert.match(section, /1,556 of them beyond the grid/u);
  assert.equal(LEAVES.leaves.filter((leaf) => leaf.x < 0 || leaf.x >= CANOPY_SIZE || leaf.y < 0 || leaf.y >= CANOPY_SIZE).length, 1556);
  assert.match(section, /2,003 of them inside the canvas at the first frame/u);
  const canopy = buildCanopy();
  const inside = canopy.layers.map((layer) => holePieces(layer.mask, canopy.size)
    .filter((piece) => piece.x >= 0 && piece.x < LOGICAL_SIZE && piece.y >= 0 && piece.y < LOGICAL_SIZE).length);
  assert.equal(inside.reduce((sum, count) => sum + count, 0), 2003);
  assert.match(section, /each of seventeen patches/u);
  const shown = MANIFEST.artworks.find((entry) => entry.id === "little-moons").thumbnail.frame;
  assert.match(section, new RegExp(`The thumbnail is frame ${shown}, a second before the deepest point`, "u"));
  assert.equal(TOTAL_FRAMES / 2 - shown, PLAYBACK_FPS);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "little-moons");
  const quote = CATALOG.quotes.find((entry) => entry.id === QUOTE_ID);
  assert.equal(artwork.title, "Little Moons");
  assert.equal(artwork.entry, "p5js/artworks/little-moons/index.html");
  assert.equal(artwork.interactivePath, "little-moons/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, [QUOTE_ID]);
  assert.deepEqual(artwork.thumbnail, { frame: 150 });
  assert.deepEqual(artwork.render, {
    kind: "video", artifact: "exports/p5js/LittleMoons.mp4", durationSeconds: 12, scale: 2
  });
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `little-moons` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 12 seconds,/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 230);
  assert.equal(body.split("\n")[0], quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Little Moons</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<blockquote class="card__quote" lang="en">/u);
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
});

test("the sketch draws one image of the light and nothing else, with no variant left to choose", () => {
  const source = readFileSync(SKETCH_URL, "utf8");
  const called = new Set([...source.matchAll(/\bp\.([a-zA-Z]+)\(/gu)].map((match) => match[1]));
  assert.deepEqual([...called].sort(), ["createCanvas", "frameRate", "noLoop", "pixelDensity", "pop", "push", "scale"]);
  // No letter, numeral, arrow or figure of the sun can reach the frame: the one thing drawn
  // on the p5 canvas is the light field.
  assert.equal((source.match(/drawingContext\.drawImage\(/gu) ?? []).length, 1);
  // The previews' switches are gone: the page answers to capture and scale and to nothing else.
  const asked = [...source.matchAll(/PARAMETERS\.get\("([a-zA-Z]+)"\)/gu)].map((match) => match[1]).sort();
  assert.deepEqual(asked, ["capture", "renderScale"]);
  assert.doesNotMatch(source, /annular|woven|wicker/iu);
});

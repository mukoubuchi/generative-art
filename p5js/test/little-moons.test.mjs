import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  CANOPY_MARGIN,
  CANOPY_SIZE,
  CLEAR_SKY,
  ECLIPSE,
  LAYER_HEIGHTS,
  LOGICAL_SIZE,
  MOON_REACH,
  PLAYBACK_FPS,
  SUB_ROWS,
  TOTAL_FRAMES,
  brightChords,
  buildCanopy,
  holePieces,
  layerLight,
  lightAt,
  moonAt,
  rowSums,
  skyIsBright,
  swayAt
} from "../artworks/little-moons/little-moons.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SKETCH_URL = new URL("../artworks/little-moons/sketch.js", import.meta.url);
const QUOTE_ID = "pseudo-aristoteles-meniskoi";

const STILL = { x: 0, y: 0 };
const CLEAR = CLEAR_SKY;

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
      cells.push({ x: x + 0.5, y: y + 0.5, light: layerLight(layer, CANOPY_SIZE, x + 0.5, y + 0.5, height, moon, STILL) });
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
  for (let layer = 0; layer < LAYER_HEIGHTS.length; layer += 1) {
    const start = swayAt(0, layer);
    const again = swayAt(TOTAL_FRAMES, layer);
    assert.ok(Math.abs(start.x - again.x) < 1e-12 && Math.abs(start.y - again.y) < 1e-12);
  }
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
    const peak = layerLight(layer, CANOPY_SIZE, 340, 340, height, CLEAR, STILL);
    for (let step = 0; step < limit * 8; step += 1) {
      const distance = step / 8;
      if (layerLight(layer, CANOPY_SIZE, 340 + direction.x * distance, 340 + direction.y * distance, height, CLEAR, STILL) < peak / 2) {
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
  assert.equal(canopy.leaves, 16869);
  assert.deepEqual(canopy.layers.map((layer) => holePieces(layer.mask, canopy.size).length), [526, 136, 138]);
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
      cells.push({ x: i, y: j, light: layerLight(layer, CANOPY_SIZE, piece.x + i, piece.y + j, height, moon, STILL) });
    }
  }
  const total = cells.reduce((sum, cell) => sum + cell.light, 0);
  return cells.map((cell) => ({ ...cell, light: cell.light / total }));
}

test("every small hole of one height throws the same image the same way round, and each height its own", () => {
  const canopy = buildCanopy();
  const moon = moonAt(144);
  const reach = Math.max(...LAYER_HEIGHTS) + 3;
  const chosen = LAYER_HEIGHTS.map((height, index) => {
    const small = holePieces(canopy.layers[index].mask, canopy.size).filter((piece) => piece.area >= 1 && piece.cells <= 6
      && piece.x > reach && piece.x < LOGICAL_SIZE - reach && piece.y > reach && piece.y < LOGICAL_SIZE - reach);
    assert.ok(small.length >= 10, `${height}: only ${small.length} small holes`);
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
  // Within a height the images agree, and the more nearly so the smaller the hole is beside
  // its sun: the lowest layer's small holes are a third of its sun across, the highest's a
  // seventh. Across heights they are different suns and disagree on most of their light.
  const within = images.map((sameHeight) => Math.max(...sameHeight.map((image) => difference(image, sameHeight[0]))));
  const across = Math.min(...[[0, 1], [0, 2], [1, 2]].flatMap(([a, b]) =>
    images[a].flatMap((first) => images[b].map((second) => difference(first, second)))));
  assert.ok(within[2] < within[1] && within[1] < within[0], `${within}`);
  assert.ok(Math.max(...within) < across / 4, `within ${within}, across ${across}`);
});

test("the light at a point is each layer's light under its own sun and its own wind, added", () => {
  // This is the reference the graphics card is checked against, so it is pinned by what it
  // is made of rather than by a picture.
  const canopy = buildCanopy();
  for (const frame of [0, 150, 180, 290]) {
    const moon = moonAt(frame);
    for (const [x, y] of [[100.5, 200.5], [340.25, 339.75], [611.5, 77.5], [5.5, 674.5]]) {
      const added = canopy.layers.reduce((sum, layer, index) =>
        sum + layerLight(layer, canopy.size, x, y, LAYER_HEIGHTS[index], moon, swayAt(frame, index)), 0);
      assert.equal(lightAt(canopy, x, y, frame), added);
    }
  }
  // And there is light to add: the check is not passing on darkness.
  let lit = 0;
  for (let x = 0.5; x < LOGICAL_SIZE; x += 5) lit += lightAt(canopy, x, 340.5, 0) > 0.01;
  assert.ok(lit >= 10, `only ${lit} lit samples`);
});

test("reading each row of cells at several heights leaves no stripes: the light is what a much finer reading gives", () => {
  // Read once, at its middle, a row switches on or off whole as the sun's rim passes it,
  // and the images come out striped across. The fix is only as good as its agreement with
  // a reading eight times finer, around real holes of every layer, on a half-pixel grid.
  assert.equal(SUB_ROWS, 4);
  const canopy = buildCanopy();
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
            values.push(layerLight(canopy.layers[index], canopy.size, piece.x + i / 2, piece.y + j / 2, height, moon, STILL, subRows));
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
    // The control: read once, the same images are off by a tenth of their peak or more.
    assert.ok(worst.once > 0.1, `${height}: a single reading is only ${worst.once} off`);
  });
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
  assert.match(section, /The leaves are 16,869 ellipses/u);
  assert.match(section, /652 of them inside the canvas/u);
  const canopy = buildCanopy();
  const inside = canopy.layers.map((layer) => holePieces(layer.mask, canopy.size)
    .filter((piece) => piece.x >= 0 && piece.x < LOGICAL_SIZE && piece.y >= 0 && piece.y < LOGICAL_SIZE).length);
  assert.equal(inside.reduce((sum, count) => sum + count, 0), 652);
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

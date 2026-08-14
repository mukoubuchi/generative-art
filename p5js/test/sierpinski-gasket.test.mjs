import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  boundingBox,
  buildGasket,
  countTriangles,
  flattenTriangles,
  gasketDepth
,
  BUILD_FRAMES,
  DROP_FRAMES,
  DROP_STRIDE,
  HOLD_FRAMES,
  RAIN_FRAMES,
  RAIN_POINTS,
  RAIN_SEED,
  RIPPLE_FRAMES,
  TOTAL_FRAMES,
  chaosPoints,
  deepestCellOf,
  deepestCells,
  deepestContainment,
  dropFallAt,
  fallenAt,
  isDrawnFalling,
  landingFrameOf,
  pointInTriangle,
  rippleAt,
  triangleVertices,
  wetting
} from "../artworks/sierpinski-gasket/geometry.js";

// The Processing sketch: an 800 px canvas, radius 800 * 0.48 and a cutoff of 10.
const PROCESSING_ROOT = { center: { x: 400, y: 400 }, radius: 384, minimumRadius: 10 };
// The p5.js port: a 680 px canvas with both constants kept as the same ratios.
const PORTED_ROOT = { center: { x: 340, y: 340 }, radius: 680 * 0.48, minimumRadius: 680 * 0.0125 };

function build({ center, radius, minimumRadius }) {
  return buildGasket(center, radius, minimumRadius);
}

test("the port keeps the generation count and triangle total of the Processing artwork", () => {
  const original = build(PROCESSING_ROOT);
  const ported = build(PORTED_ROOT);

  // Radii 384, 192, 96, 48, 24, 12, 6 stop once a radius no longer exceeds the cutoff.
  assert.equal(gasketDepth(original), 7);
  assert.equal(countTriangles(original), 1093);
  assert.equal(gasketDepth(ported), gasketDepth(original));
  assert.equal(countTriangles(ported), countTriangles(original));
});

test("every node either branches three ways or terminates", () => {
  const gasket = build(PORTED_ROOT);
  const pending = [gasket];
  let leaves = 0;

  while (pending.length > 0) {
    const node = pending.pop();
    assert.ok(node.children.length === 3 || node.children.length === 0);
    if (node.children.length === 0) {
      leaves += 1;
    }
    pending.push(...node.children);
  }

  assert.equal(leaves, 3 ** 6);
});

test("each child places its outward vertex on the parent vertex it grew from", () => {
  const gasket = build(PORTED_ROOT);
  const parent = flattenTriangles(gasket)[0];

  gasket.children.forEach((child, index) => {
    const childVertex = flattenTriangles(child)[0][index];
    assert.ok(Math.hypot(childVertex.x - parent[index].x, childVertex.y - parent[index].y) < 1e-9);
    assert.equal(child.radius, gasket.radius / 2);
  });
});

test("the gasket stays inside the logical canvas with equal side margins", () => {
  // The sketch shifts the anchor left by a quarter radius to centre the bounding box.
  const radius = PORTED_ROOT.radius;
  const bounds = boundingBox(buildGasket(
    { x: 340 - radius / 4, y: 340 },
    radius,
    PORTED_ROOT.minimumRadius
  ));

  assert.ok(bounds.left >= 0 && bounds.right <= 680);
  assert.ok(bounds.top >= 0 && bounds.bottom <= 680);
  assert.ok(Math.abs(bounds.left - (680 - bounds.right)) < 1e-9);
  assert.ok(Math.abs(bounds.top - (680 - bounds.bottom)) < 1e-9);
});

test("the chaos game agrees with the built skeleton without ever consulting it", async () => {
  const { mulberry32 } = await import("../artworks/shared/random.js");
  const gasket = buildGasket({ x: 0, y: 0 }, 1, 1 / 64);
  const depth = gasketDepth(gasket);
  const rain = chaosPoints({ x: 0, y: 0 }, 1, 500, mulberry32(RAIN_SEED));

  // Every raindrop can be followed to the bottom of the tree, or within one level of
  // it when it falls on a boundary edge shared between children.
  for (const point of rain) {
    assert.ok(deepestContainment(gasket, point) >= depth - 1);
  }
  // Negative control: uniform rain over the box is orphaned early and often.
  const random = mulberry32(99);
  let orphaned = 0;
  for (let index = 0; index < 500; index += 1) {
    const point = { x: random() * 2 - 1, y: random() * 2 - 1 };
    if (deepestContainment(gasket, point) < 3) {
      orphaned += 1;
    }
  }
  assert.ok(orphaned > 350);
});

test("the dimension is measured from the construction: triangles triple as the radius halves", () => {
  const gasket = buildGasket({ x: 0, y: 0 }, 1, 1 / 64);
  const perLevel = [];
  (function tally(node, depth) {
    perLevel[depth] = (perLevel[depth] ?? 0) + 1;
    for (const child of node.children) {
      tally(child, depth + 1);
    }
  })(gasket, 0);

  for (let level = 1; level < perLevel.length; level += 1) {
    assert.equal(perLevel[level] / perLevel[level - 1], 3);
  }
  const dimension = Math.log(3) / Math.log(2);
  assert.ok(Math.abs(dimension - 1.585) < 0.001);
});

test("the clip's plan lands on three hundred frames and the manifest agrees", async () => {
  assert.equal(BUILD_FRAMES + RAIN_FRAMES + HOLD_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, 300);
  assert.ok(RAIN_POINTS >= 3000);
  const { readFileSync } = await import("node:fs");
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "sierpinski-gasket");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});

const FIGURE = buildGasket({ x: 0, y: 0 }, 1, 1 / 64);
const { mulberry32 } = await import("../artworks/shared/random.js");
const FALLING = chaosPoints({ x: 0, y: 0 }, 1, RAIN_POINTS, mulberry32(RAIN_SEED));
const CELLS = deepestCells(FIGURE);
const WETTED = wetting(FIGURE, FALLING);

test("the film stands exactly where the rain fell, cell by cell", () => {
  // What the water leaves is not a scatter of grains but the smallest triangles it
  // landed in, which is why the accumulation reads as one film in the figure's shape.
  // Two things have to hold for that to be evidence rather than decoration: the cell
  // a landing wets must be a cell that actually holds it, and no cell may be wet that
  // nothing landed in.
  assert.equal(CELLS.length, 3 ** (gasketDepth(FIGURE) - 1));
  assert.equal(CELLS.length, 729);
  WETTED.forEach((landing, index) => {
    assert.notEqual(landing.cell, -1, `landing ${index} wet no cell`);
    const cell = CELLS[landing.cell];
    assert.ok(
      pointInTriangle(FALLING[index], triangleVertices(cell.center, cell.radius)),
      `landing ${index} wet a cell that does not hold it`
    );
    assert.equal(cell.radius, 1 / 64);
  });

  // Followed down a second time, by the function that counts depth rather than
  // address, every landing reaches the bottom. The two never mention each other.
  for (const point of FALLING) {
    assert.equal(deepestContainment(FIGURE, point), gasketDepth(FIGURE) - 1);
  }

  // Nine of the seven hundred and twenty-nine cells are never touched. That is the
  // sample talking, not the figure -- and it is also what keeps this test honest: a
  // film that covered every cell would pass the checks above and mean nothing.
  const wet = new Set(WETTED.map((landing) => landing.cell));
  assert.equal(wet.size, 720);
  assert.equal(CELLS.length - wet.size, 9);

  // Negative control: rain that falls anywhere lands mostly in the middles that were
  // taken out, and those points have no deepest cell to wet at all.
  const random = mulberry32(99);
  let homeless = 0;
  for (let index = 0; index < 500; index += 1) {
    const point = { x: random() * 2 - 1, y: random() * 2 - 1 };
    if (deepestCellOf(FIGURE, point) === -1) {
      homeless += 1;
    }
  }
  assert.ok(homeless > 450, `only ${homeless} of 500 stray points were homeless`);
});

test("a ring is a cell being found, so the rain grows quieter as the figure fills", () => {
  // Only the landing that first wets a cell rings. That makes the ring a report of
  // somewhere new rather than of another drop, and it is why the sound thins out.
  const rings = WETTED.filter((landing) => landing.first);
  assert.equal(rings.length, new Set(WETTED.map((landing) => landing.cell)).size);
  assert.equal(rings.length, 720);
  const seen = new Set();
  WETTED.forEach((landing, index) => {
    assert.equal(landing.first, !seen.has(landing.cell), `landing ${index} rang wrongly`);
    seen.add(landing.cell);
  });

  // Measured: the first tenth of the rain rings two hundred and seventy-two times,
  // the last tenth eight. The claim is the fall, not the exact counts.
  const tenths = Array.from({ length: 10 }, () => 0);
  WETTED.forEach((landing, index) => {
    if (landing.first) {
      tenths[Math.min(9, Math.floor((index / RAIN_POINTS) * 10))] += 1;
    }
  });
  assert.equal(tenths[0], 272);
  assert.equal(tenths.at(-1), 8);
  assert.ok(tenths[0] > 20 * tenths.at(-1), "the rain does not grow quieter");

  // And no ring is still open when the clip ends, so the loop closes on a still figure.
  const last = WETTED.reduce(
    (latest, landing, index) => (landing.first ? index : latest), 0);
  assert.ok(landingFrameOf(last) + RIPPLE_FRAMES < TOTAL_FRAMES);
  assert.equal(rippleAt(last, TOTAL_FRAMES - 1), null);
});

test("every landing wets, and one in eight is drawn falling", () => {
  // The rain arrives at nineteen and a third landings a frame. Drawing all of them
  // falling is a sheet of water with no drops in it, so only a uniform one in eight is
  // drawn on its way down -- and the thinning touches the drawing alone. All three
  // thousand two hundred still wet their cell, which is where the evidence lives.
  assert.equal(WETTED.filter((landing) => landing.hits > 0).length, RAIN_POINTS);
  const drawn = FALLING.filter((unused, index) => isDrawnFalling(index)).length;
  assert.equal(drawn, RAIN_POINTS / DROP_STRIDE);
  assert.equal(drawn, 400);
  assert.ok(Math.abs(RAIN_POINTS / RAIN_FRAMES - 19.39) < 0.01);

  // A drop is released DROP_FRAMES before its own landing and arrives exactly on it,
  // so thinning the drawing cannot move the accumulation the artwork always counted.
  for (const index of [0, 8, 800, 1600, RAIN_POINTS - 8]) {
    const landing = landingFrameOf(index);
    assert.equal(dropFallAt(index, landing - DROP_FRAMES), 0);
    assert.ok(Math.abs(dropFallAt(index, landing - 1e-9) - 1) < 1e-9);
    assert.equal(dropFallAt(index, landing), null);
    assert.equal(dropFallAt(index, landing - DROP_FRAMES - 1e-9), null);
  }
  // The first drop is released after the clip has started, and the last has landed
  // before it ends.
  assert.ok(landingFrameOf(0) - DROP_FRAMES > 0);
  assert.equal(landingFrameOf(RAIN_POINTS - 1), BUILD_FRAMES + RAIN_FRAMES);

  // The count in the air, which is what a viewer reads as a rate of dripping.
  let busiest = 0;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    let flying = 0;
    for (let index = 0; index < RAIN_POINTS; index += 1) {
      if (isDrawnFalling(index) && dropFallAt(index, frame) !== null) {
        flying += 1;
      }
    }
    busiest = Math.max(busiest, flying);
  }
  assert.ok(busiest >= 15 && busiest <= 25, `${busiest} drops in the air at once`);

  // The count of landings by a frame is the count the accumulation has always used,
  // frozen here as the numbers the artwork counted before the rain was ever drawn
  // falling. Restating the formula would pass whatever the formula became.
  assert.equal(fallenAt(BUILD_FRAMES - 1), 0);
  assert.equal(fallenAt(BUILD_FRAMES + RAIN_FRAMES), RAIN_POINTS);
  assert.equal(fallenAt(TOTAL_FRAMES - 1), RAIN_POINTS);
  assert.deepEqual(
    [110, 150, 200, 260].map(fallenAt),
    [96, 872, 1842, 3006]
  );
});

test("the rings the sketch draws stand on the landings themselves", async () => {
  // The ring is the one mark whose position carries the argument: every ring opening
  // on the figure and nowhere else is what makes the attractor visible. So the sketch
  // has to draw it at the landing point rather than at any tidied-up version of it.
  const sketch = await readFile(
    new URL("../artworks/sierpinski-gasket/sketch.js", import.meta.url), "utf8");
  assert.equal((sketch.match(/p\.circle\(/gu) ?? []).length, 1);
  assert.match(sketch, /p\.circle\(RAIN\[index\]\.x, RAIN\[index\]\.y,/u);
  // And the water is one colour in all three of its states.
  assert.equal((sketch.match(/\.\.\.WATER/gu) ?? []).length, 3);
  assert.equal((sketch.match(/\.\.\.STONE/gu) ?? []).length, 1);
});

test("the card is taken while it is raining, with rings open and drops in the air", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "sierpinski-gasket");
  const frame = artwork.thumbnail.frame;
  assert.ok(frame > BUILD_FRAMES && frame < BUILD_FRAMES + RAIN_FRAMES,
    "the card is taken while it is raining");

  const openAt = (at) => WETTED
    .filter((landing, index) => landing.first && rippleAt(index, at) !== null).length;
  const flyingAt = (at) => FALLING
    .filter((unused, index) => isDrawnFalling(index) && dropFallAt(index, at) !== null).length;
  assert.ok(openAt(frame) >= 3, `only ${openAt(frame)} rings are open on the card`);
  assert.ok(flyingAt(frame) >= 10, `only ${flyingAt(frame)} drops are in the air`);
  // Some of the figure is wet and some is not, so the card shows the rain at work
  // rather than a finished film.
  const wet = new Set(WETTED.slice(0, fallenAt(frame)).map((landing) => landing.cell));
  assert.ok(wet.size > 400 && wet.size < 700, `${wet.size} cells are wet on the card`);

  // Negative controls, both frozen from what this artwork actually did: frame 262 is
  // the card it used to take, by which time the film has finished spreading and there
  // is nothing left to watch arrive; frame 60 is the build, where nothing rains.
  const wetAt = (at) => new Set(WETTED.slice(0, fallenAt(at)).map((landing) => landing.cell)).size;
  assert.ok(wetAt(262) > 700, `only ${wetAt(262)} cells are wet by the old card frame`);
  assert.equal(openAt(60), 0);
  assert.equal(flyingAt(60), 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  COEFFICIENT_A,
  COEFFICIENT_B,
  COEFFICIENT_C,
  COEFFICIENT_D,
  COLOR_BINS,
  FILL_RATIO,
  HUE_LOW,
  HUE_SPAN,
  POINT_COUNT,
  WARMUP_STEPS,
  binHue,
  calculateOrbit,
  colorBins,
  fitToCanvas,
  nextPoint
} from "../artworks/de-jong-attractor/attractor.js";

const WIDTH = 680;
const HEIGHT = 680;

test("one step is the de Jong map, read from the previous pair", () => {
  const step = nextPoint(0.3, -0.7);

  assert.ok(Math.abs(step.x - (Math.sin(COEFFICIENT_A * -0.7) - Math.cos(COEFFICIENT_B * 0.3))) < 1e-15);
  assert.ok(Math.abs(step.y - (Math.sin(COEFFICIENT_C * 0.3) - Math.cos(COEFFICIENT_D * -0.7))) < 1e-15);
});

test("the orbit cannot leave the square the map's own range allows", () => {
  // Both coordinates are a sine minus a cosine, so neither can exceed two in magnitude
  // however long the map is iterated. The figure is bounded by construction.
  const { xs, ys } = calculateOrbit(0.004, -0.006);
  for (let index = 0; index < POINT_COUNT; index += 977) {
    assert.ok(Math.abs(xs[index]) <= 2);
    assert.ok(Math.abs(ys[index]) <= 2);
  }
});

test("the warmup is discarded, so the kept run is exactly the point count", () => {
  const { xs, ys } = calculateOrbit(0.004, -0.006);

  assert.equal(xs.length, POINT_COUNT);
  assert.equal(ys.length, POINT_COUNT);
  assert.equal(WARMUP_STEPS, 1000);

  // The first kept point is the state after WARMUP_STEPS + 1 applications of the map.
  let x = 0.004;
  let y = -0.006;
  for (let step = 0; step <= WARMUP_STEPS; step += 1) {
    ({ x, y } = nextPoint(x, y));
  }
  assert.equal(xs[0], Math.fround(x));
  assert.equal(ys[0], Math.fround(y));
});

test("the figure is a property of the coefficients, not of where the orbit starts", () => {
  // This is what lets the port use a different random start from the py5 sketch: the
  // warmup pulls any start onto the same attractor, so the picture is unchanged.
  const measure = (startX, startY) => {
    const orbit = calculateOrbit(startX, startY);
    const bins = colorBins(orbit.ys);
    const histogram = new Float64Array(COLOR_BINS);
    for (const bin of bins) {
      histogram[bin] += 1 / POINT_COUNT;
    }
    const cloud = fitToCanvas(orbit, WIDTH, HEIGHT);
    return { histogram, scale: cloud.scale };
  };
  const first = measure(0.004, -0.006);
  const second = measure(-0.0093, 0.0071);

  assert.ok(Math.abs(first.scale - second.scale) / first.scale < 0.01);
  for (let bin = 0; bin < COLOR_BINS; bin += 1) {
    assert.ok(
      Math.abs(first.histogram[bin] - second.histogram[bin]) < 0.004,
      `band ${bin} holds a different share of the cloud: `
        + `${first.histogram[bin]} against ${second.histogram[bin]}`
    );
  }
});

test("the same start replays the same orbit exactly", () => {
  const first = calculateOrbit(0.004, -0.006);
  const second = calculateOrbit(0.004, -0.006);

  for (let index = 0; index < POINT_COUNT; index += 613) {
    assert.equal(first.xs[index], second.xs[index]);
    assert.equal(first.ys[index], second.ys[index]);
  }
});

test("the cloud is centred on the canvas and fills the fraction it is given", () => {
  const orbit = calculateOrbit(0.004, -0.006);
  const cloud = fitToCanvas(orbit, WIDTH, HEIGHT);

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (let index = 0; index < POINT_COUNT; index += 1) {
    left = Math.min(left, cloud.xs[index]);
    right = Math.max(right, cloud.xs[index]);
    top = Math.min(top, cloud.ys[index]);
    bottom = Math.max(bottom, cloud.ys[index]);
  }

  assert.ok(Math.abs((left + right) / 2 - WIDTH / 2) < 0.5);
  assert.ok(Math.abs((top + bottom) / 2 - HEIGHT / 2) < 0.5);
  const filled = Math.max(right - left, bottom - top);
  assert.ok(Math.abs(filled - Math.min(WIDTH, HEIGHT) * FILL_RATIO) < 1);
  assert.ok(left >= 0 && top >= 0 && right <= WIDTH && bottom <= HEIGHT);
});

test("colour bands run bottom to top and cover the whole cloud", () => {
  const orbit = calculateOrbit(0.004, -0.006);
  const bins = colorBins(orbit.ys);

  let lowestIndex = 0;
  let highestIndex = 0;
  for (let index = 1; index < POINT_COUNT; index += 1) {
    if (orbit.ys[index] < orbit.ys[lowestIndex]) lowestIndex = index;
    if (orbit.ys[index] > orbit.ys[highestIndex]) highestIndex = index;
  }

  assert.equal(bins[lowestIndex], 0);
  assert.equal(bins[highestIndex], COLOR_BINS - 1, "the topmost point is clipped into the last band");
  const used = new Set(bins);
  assert.equal(used.size, COLOR_BINS, "every band holds at least one point");
});

test("the hue ramp spans its whole range across the bands", () => {
  assert.equal(binHue(0), HUE_LOW);
  assert.ok(Math.abs(binHue(COLOR_BINS - 1) - (HUE_LOW + HUE_SPAN)) < 1e-12);
  for (let bin = 1; bin < COLOR_BINS; bin += 1) {
    assert.ok(binHue(bin) > binHue(bin - 1));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  PHI,
  SECTION_COUNT,
  buildSections,
  convergence,
  fibonacciNumbers,
  goldenRectangle,
  sectionCorners
} from "../artworks/fibonacci-spiral/geometry.js";

const sections = buildSections();

test("the tiling is fifteen integer rectangles whose sides are consecutive Fibonacci numbers", () => {
  const fibonacci = fibonacciNumbers();

  assert.equal(fibonacci.length, SECTION_COUNT + 1);
  for (let index = 2; index < fibonacci.length; index += 1) {
    assert.equal(fibonacci[index], fibonacci[index - 1] + fibonacci[index - 2]);
  }
  assert.equal(sections.length, SECTION_COUNT);
  assert.equal(sections[0].width, 987);
  assert.equal(sections[0].height, 610);
  assert.equal(sections.at(-1).width, 1);
  assert.equal(sections.at(-1).height, 1);
});

test("the recurrence is carpentry: each square split leaves exactly the next rectangle", () => {
  for (let index = 0; index < sections.length - 1; index += 1) {
    // Splitting the height-square off a width-by-height rectangle leaves width minus
    // height across, and that is the next section's height — as integers, with ===.
    assert.equal(sections[index].width - sections[index].height, sections[index + 1].height);
    assert.equal(sections[index].height, sections[index + 1].width);
  }
});

test("each section starts on the last one's far edge, a quarter turn on", () => {
  for (let index = 0; index < sections.length - 1; index += 1) {
    const here = sections[index];
    const next = sections[index + 1];
    assert.ok(Math.abs(next.x - (here.x + here.width * Math.cos(here.rotation))) < 1e-9);
    assert.ok(Math.abs(next.y - (here.y + here.width * Math.sin(here.rotation))) < 1e-9);
    assert.ok(Math.abs(next.rotation - here.rotation - Math.PI / 2) < 1e-12);
    assert.equal(sectionCorners(here).length, 4);
  }
});

test("the convergents close on phi from both sides, the error shrinking by phi squared", () => {
  const errors = sections.map((section) => section.ratio - PHI);

  // Build order runs best convergent first, so read the walk from the rough end.
  const walk = [...errors].reverse();
  for (let index = 1; index < walk.length; index += 1) {
    assert.ok(Math.sign(walk[index]) !== Math.sign(walk[index - 1]));
    assert.ok(Math.abs(walk[index]) < Math.abs(walk[index - 1]));
  }
  for (let index = walk.length - 4; index < walk.length; index += 1) {
    const shrink = Math.abs(walk[index - 1]) / Math.abs(walk[index]);
    assert.ok(Math.abs(shrink - PHI ** 2) < 0.02);
  }
  // The root's own aspect misses phi by about one part in a million.
  assert.ok(Math.abs(sections[0].ratio - PHI) < 1.3e-6);
});

test("the colour key is the convergence: zero at one-to-one, saturated at the root", () => {
  const roughest = sections.at(-1);
  const finest = sections[0];

  assert.equal(convergence(roughest), 0);
  assert.ok(convergence(finest) > 0.95);
  for (let index = 0; index < sections.length - 1; index += 1) {
    assert.ok(convergence(sections[index]) > convergence(sections[index + 1]));
  }
});

test("the exact golden rectangle stays as the skeleton", () => {
  const root = goldenRectangle(946.75, 620);

  assert.ok(Math.abs(root.width / root.height - PHI) < 1e-12);
  assert.ok(root.width <= 946.75 + 1e-9 && root.height <= 620 + 1e-9);
});

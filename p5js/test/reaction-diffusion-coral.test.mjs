import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CENTRE_WEIGHT,
  COLONY_COUNT,
  CORNER_WEIGHT,
  EDGE_WEIGHT,
  SIM_SIZE,
  advance,
  createSimulation,
  laplacian,
  run,
  sampleBilinear,
  seedCircle,
  seedColonies
} from "../artworks/reaction-diffusion-coral/reaction.js";

/** A stand-in for p5's generators, so the simulation can be exercised without a browser. */
function generators(seed) {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  return {
    random: (low, high) => low + (high - low) * next(),
    noise: (x, y) => 0.5 + 0.5 * Math.sin(x * 1.7 + y * 2.3)
  };
}

test("the diffusion kernel sums to zero, so a flat field cannot move", () => {
  assert.ok(Math.abs(CENTRE_WEIGHT + 4 * EDGE_WEIGHT + 4 * CORNER_WEIGHT) < 1e-15);

  const flat = new Float32Array(SIM_SIZE * SIM_SIZE).fill(0.37);
  assert.ok(Math.abs(laplacian(flat, 10, 10)) < 1e-6);
});

test("the kernel measures curvature where a field is not flat", () => {
  const field = new Float32Array(SIM_SIZE * SIM_SIZE);
  field[50 + 50 * SIM_SIZE] = 1;

  assert.ok(laplacian(field, 50, 50) < 0, "a lone peak diffuses away");
  assert.ok(laplacian(field, 51, 50) > 0, "and into its neighbours");
});

test("an untouched grid is all of the first chemical and none of the second", () => {
  const { noise } = generators(1);
  const simulation = createSimulation(noise);

  assert.equal(simulation.chemicalA.length, SIM_SIZE * SIM_SIZE);
  for (let index = 0; index < simulation.chemicalA.length; index += 977) {
    assert.equal(simulation.chemicalA[index], 1);
    assert.equal(simulation.chemicalB[index], 0);
  }
});

test("the feed and kill fields starve the outside of the frame", () => {
  const { noise } = generators(1);
  const { feedField, killField } = createSimulation(noise);
  const centre = Math.floor(SIM_SIZE / 2);
  const centreIndex = centre + centre * SIM_SIZE;
  const cornerIndex = 1 + 1 * SIM_SIZE;

  // The radial terms pull feed down and kill up with distance, which is what keeps the
  // colony away from the edges.
  assert.ok(feedField[cornerIndex] < feedField[centreIndex] + 0.0024);
  assert.ok(killField[cornerIndex] > killField[centreIndex] - 0.0018);
});

test("seeding a disc raises the second chemical inside it and nowhere else", () => {
  const { noise } = generators(1);
  const simulation = createSimulation(noise);
  seedCircle(simulation, 100, 100, 6);

  const inside = 100 + 100 * SIM_SIZE;
  const outside = 130 + 100 * SIM_SIZE;
  assert.ok(simulation.chemicalB[inside] > 0.9);
  assert.ok(simulation.chemicalA[inside] < 0.2);
  assert.equal(simulation.chemicalB[outside], 0);
  assert.equal(simulation.chemicalA[outside], 1);
});

test("the colonies land inside the frame and are spread by the golden angle", () => {
  const { noise, random } = generators(7);
  const simulation = createSimulation(noise);
  seedColonies(simulation, random);

  let seeded = 0;
  for (const value of simulation.chemicalB) {
    if (value > 0) {
      seeded += 1;
    }
  }
  assert.ok(seeded > 0);
  // Every colony centre is within a third of the grid of the middle, so none can be cut
  // off by the border the simulation never updates.
  const margin = Math.floor(SIM_SIZE * 0.5 - SIM_SIZE * 0.33 - 7);
  for (let x = 0; x < margin; x += 1) {
    assert.equal(simulation.chemicalB[x + Math.floor(SIM_SIZE / 2) * SIM_SIZE], 0);
  }
  assert.equal(COLONY_COUNT, 72);
});

test("the same seed gives the same grid, step for step", () => {
  const build = () => {
    const { noise, random } = generators(11);
    const simulation = createSimulation(noise);
    seedColonies(simulation, random);
    for (let step = 0; step < 20; step += 1) {
      advance(simulation);
    }
    return simulation.chemicalB;
  };
  const first = build();
  const second = build();

  assert.equal(first.length, second.length);
  for (let index = 0; index < first.length; index += 613) {
    assert.equal(first[index], second[index]);
  }
});

test("the grid stays inside the bounds the model allows", () => {
  const { noise, random } = generators(3);
  const simulation = createSimulation(noise);
  seedColonies(simulation, random);
  for (let step = 0; step < 60; step += 1) {
    advance(simulation);
  }
  for (const field of [simulation.chemicalA, simulation.chemicalB]) {
    for (let index = 0; index < field.length; index += 379) {
      assert.ok(field[index] >= 0 && field[index] <= 1);
      assert.ok(Number.isFinite(field[index]));
    }
  }
});

test("sampling between grid points interpolates rather than snapping", () => {
  const field = new Float32Array(SIM_SIZE * SIM_SIZE);
  field[10 + 10 * SIM_SIZE] = 0;
  field[11 + 10 * SIM_SIZE] = 1;

  assert.ok(Math.abs(sampleBilinear(field, 10.5, 10) - 0.5) < 1e-6);
  assert.ok(Math.abs(sampleBilinear(field, 10, 10)) < 1e-6);
  assert.ok(Math.abs(sampleBilinear(field, 11, 10) - 1) < 1e-6);
});

test("running the reaction a step at a time is running it all at once", () => {
  // What the clip rests on. The still ran twelve hundred steps in one call before it
  // painted; the clip advances the same field a few steps a frame and paints between them.
  // Those are the same twelve hundred steps only if a step is a step -- if `advance` keeps
  // no state of its own about how many have gone before, and `run` is nothing but a loop
  // over it. Fifty steps is enough to settle that and cheap enough to run every time.
  const steps = 50;
  const together = createSimulation(generators(11).noise);
  seedColonies(together, generators(11).random);
  const apart = createSimulation(generators(11).noise);
  seedColonies(apart, generators(11).random);

  run(together, steps);
  for (let step = 0; step < steps; step += 1) {
    advance(apart);
  }
  assert.deepEqual([...apart.chemicalB], [...together.chemicalB]);
  assert.deepEqual([...apart.chemicalA], [...together.chemicalA]);

  // Not vacuous: one step short is a different field.
  const short = createSimulation(generators(11).noise);
  seedColonies(short, generators(11).random);
  run(short, steps - 1);
  assert.notDeepEqual([...short.chemicalB], [...together.chemicalB]);
});

test("Reaction Diffusion Coral is registered as the reaction running", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "reaction-diffusion-coral");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.artifact, "exports/p5js/ReactionDiffusionCoral.mp4");
  assert.equal(artwork.render.durationSeconds, 10);
  assert.deepEqual(artwork.thumbnail, { frame: 290 });

  const sketch = readFileSync(
    new URL("../artworks/reaction-diffusion-coral/sketch.js", import.meta.url), "utf8");
  // The clip's last painted step is the iteration count the artwork has always settled at.
  assert.match(sketch, /Math\.round\(ITERATIONS \* Math\.min\(frameIndex \/ GROWTH_FRAMES, 1\)\)/u);
  // The loop is stopped for the renderer and nobody else, so the page runs the reaction too.
  assert.match(sketch, /if \(CAPTURE_MODE\) \{\n {6}p\.noLoop\(\);/u);
  assert.equal(sketch.match(/p\.noLoop\(\);/gu).length, 2);
});

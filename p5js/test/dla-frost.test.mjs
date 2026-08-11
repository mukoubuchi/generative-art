import assert from "node:assert/strict";
import test from "node:test";
import { growCluster, mulberry32 } from "../artworks/dla-frost/cluster.js";

/**
 * A grown structure cannot be pinned coordinate by coordinate the way a constructed one
 * can, so what is pinned is what makes it DLA: the growth is reproducible from its
 * seed, connected from its first cell, one particle per cell, and open — measurably
 * emptier towards the rim than a solid disc could be. The last is the physics: tips
 * shadow fjords, so the far field is reached first and the interior starves.
 */
const CLUSTER = growCluster({ particles: 1500, seed: 7 });

test("the generator is the same river twice", () => {
  const first = mulberry32(123);
  const second = mulberry32(123);
  for (let draw = 0; draw < 1000; draw += 1) {
    const value = first();
    assert.equal(value, second());
    assert.ok(value >= 0 && value < 1);
  }
});

test("the same seed grows the same crystal", () => {
  assert.deepEqual(growCluster({ particles: 400, seed: 42 }), growCluster({ particles: 400, seed: 42 }));
});

test("a different seed grows a different one", () => {
  const one = growCluster({ particles: 400, seed: 1 });
  const other = growCluster({ particles: 400, seed: 2 });
  assert.notDeepEqual(one, other);
});

test("the cluster begins at the seed and counts its particles honestly", () => {
  assert.deepEqual(CLUSTER[0], { x: 0, y: 0, index: 0 });
  assert.equal(CLUSTER.length, 1500);
  for (const [position, particle] of CLUSTER.entries()) {
    assert.equal(particle.index, position);
  }
});

test("one particle per cell", () => {
  const cells = new Set(CLUSTER.map(({ x, y }) => `${x},${y}`));
  assert.equal(cells.size, CLUSTER.length);
});

test("every particle froze onto something already there", () => {
  const placed = new Set(["0,0"]);
  for (const { x, y } of CLUSTER.slice(1)) {
    assert.ok(
      placed.has(`${x + 1},${y}`) || placed.has(`${x - 1},${y}`)
      || placed.has(`${x},${y + 1}`) || placed.has(`${x},${y - 1}`),
      `particle at ${x},${y} froze onto nothing`
    );
    placed.add(`${x},${y}`);
  }
});

test("the crystal is branches, not a disc", () => {
  const radii = CLUSTER.map(({ x, y }) => Math.hypot(x, y));
  const maxRadius = Math.max(...radii);
  // A solid disc of this many cells would stop far short of where the branches reach.
  const discRadius = Math.sqrt(CLUSTER.length / Math.PI);
  assert.ok(maxRadius > 2 * discRadius,
    `the cluster hugs the seed like a droplet (reach ${maxRadius}, disc ${discRadius})`);
  // And the openness grows outward: the inner third is denser than the outer third.
  const density = (from, to) => {
    const count = radii.filter((radius) => radius >= from && radius < to).length;
    return count / (Math.PI * (to * to - from * from));
  };
  const inner = density(1, maxRadius / 3);
  const outer = density((2 * maxRadius) / 3, maxRadius);
  assert.ok(inner > 2 * outer,
    `the rim is as packed as the core (inner ${inner}, outer ${outer})`);
});

test("growth reaches outward as it goes", () => {
  // Arrival order and distance correlate: the last tenth of particles land, on
  // average, well beyond the first tenth. This is what colouring by age relies on.
  const tenth = Math.floor(CLUSTER.length / 10);
  const mean = (particles) =>
    particles.reduce((sum, { x, y }) => sum + Math.hypot(x, y), 0) / particles.length;
  const early = mean(CLUSTER.slice(1, 1 + tenth));
  const late = mean(CLUSTER.slice(-tenth));
  assert.ok(late > 3 * early, `age does not read as radius (early ${early}, late ${late})`);
});

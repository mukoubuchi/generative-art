import assert from "node:assert/strict";
import test from "node:test";
import {
  HUE_HIGH,
  HUE_LOW,
  NOISE_SCALE,
  PARTICLE_COUNT,
  STEP,
  TOTAL_STEPS,
  TURNS,
  advanceParticles,
  createParticles,
  flowAngle,
  isInside,
  spawn
} from "../artworks/clinamen/field.js";

const WIDTH = 960;
const HEIGHT = 640;

/** Stand-ins for p5's generators, so the field can be replayed without a browser. */
function generators(seed) {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  return {
    random: (low, high) => low + (high - low) * next(),
    noise: (x, y) => 0.5 + 0.5 * Math.sin(x * 130 + y * 170)
  };
}

test("the population is the size the artwork is made of, and lands on the canvas", () => {
  const { random } = generators(1);
  const particles = createParticles(WIDTH, HEIGHT, random);

  assert.equal(particles.length, PARTICLE_COUNT);
  for (const particle of particles) {
    assert.ok(isInside(particle.x, particle.y, WIDTH, HEIGHT));
    assert.ok(particle.hue >= HUE_LOW && particle.hue < HUE_HIGH);
  }
});

test("the field can point in every direction", () => {
  // Noise never reaches its bounds, so a single turn would leave a wedge of directions
  // unreachable and the whole field would lean one way. Two turns cover the circle twice.
  const lowest = flowAngle(() => 0, 0, 0);
  const highest = flowAngle(() => 1, 0, 0);

  assert.equal(lowest, 0);
  assert.ok(Math.abs(highest - Math.PI * 2 * TURNS) < 1e-12);
  assert.ok(highest >= Math.PI * 2, "the range covers at least one full turn");
});

test("the angle is read from the particle's own position, scaled into the noise field", () => {
  const samples = [];
  const noise = (x, y) => {
    samples.push([x, y]);
    return 0.25;
  };
  flowAngle(noise, 400, 300);

  assert.deepEqual(samples, [[400 * NOISE_SCALE, 300 * NOISE_SCALE]]);
});

test("a step moves a particle exactly one step length", () => {
  const { random } = generators(2);
  const noise = () => 0.375;
  const particle = { x: 480, y: 320, hue: 200 };
  advanceParticles([particle], WIDTH, HEIGHT, noise, random, () => {});

  const travelled = Math.hypot(particle.x - 480, particle.y - 320);
  assert.ok(Math.abs(travelled - STEP) < 1e-9);
});

test("the segment that carries a particle off the canvas is still drawn", () => {
  const { random } = generators(3);
  // An eighth of two full turns is +PI/2, which points straight down the canvas, so a
  // particle sitting on the bottom edge is pushed out of it.
  const noise = () => 0.125;
  const particle = { x: 100, y: HEIGHT - 0.5, hue: 200 };
  const segments = [];
  advanceParticles(
    [particle],
    WIDTH,
    HEIGHT,
    noise,
    random,
    (drawn, nextX, nextY) => segments.push([drawn.x, drawn.y, nextX, nextY])
  );

  assert.equal(segments.length, 1);
  assert.equal(segments[0][0], 100);
  assert.ok(segments[0][3] >= HEIGHT, "the drawn endpoint is outside the canvas");
  assert.ok(isInside(particle.x, particle.y, WIDTH, HEIGHT), "the particle was replaced");
  assert.notEqual(particle.y, segments[0][3]);
});

test("a particle that stays on the canvas keeps its hue; a replaced one is given a new one", () => {
  const { random } = generators(5);
  const inward = { x: 480, y: 320, hue: 201.5 };
  const outward = { x: 480, y: HEIGHT - 0.5, hue: 201.5 };
  const noise = () => 0.125;

  advanceParticles([inward], WIDTH, HEIGHT, noise, random, () => {});
  assert.equal(inward.hue, 201.5);

  advanceParticles([outward], WIDTH, HEIGHT, noise, random, () => {});
  assert.notEqual(outward.hue, 201.5);
  assert.ok(outward.hue >= HUE_LOW && outward.hue < HUE_HIGH);
});

test("replacements draw from one shared random stream", () => {
  // The population reads one sequence of random numbers, not one per particle. Two
  // particles replaced in the same step therefore land in different places, and a
  // replacement shifts what every later replacement in the run receives. Pinning this
  // keeps a refactor from quietly giving each particle its own generator.
  const replacementAfter = (leaders) => {
    const { random } = generators(7);
    const leaving = { x: 10, y: HEIGHT - 0.5, hue: 200 };
    advanceParticles([...leaders, leaving], WIDTH, HEIGHT, () => 0.125, random, () => {});
    return leaving.x;
  };

  assert.equal(
    replacementAfter([]),
    replacementAfter([{ x: 480, y: 320, hue: 200 }]),
    "a particle that stays on the canvas consumes nothing"
  );
  assert.notEqual(
    replacementAfter([]),
    replacementAfter([{ x: 30, y: HEIGHT - 0.5, hue: 200 }]),
    "a particle that is replaced shifts the stream for everything after it"
  );
});

test("a whole run is reproducible from the generators alone", () => {
  const replay = () => {
    const { random, noise } = generators(11);
    const particles = createParticles(WIDTH, HEIGHT, random);
    let segments = 0;
    for (let step = 0; step < 12; step += 1) {
      advanceParticles(particles, WIDTH, HEIGHT, noise, random, () => {
        segments += 1;
      });
    }
    return { segments, particles };
  };
  const first = replay();
  const second = replay();

  assert.equal(first.segments, PARTICLE_COUNT * 12);
  for (let index = 0; index < first.particles.length; index += 97) {
    assert.deepEqual(first.particles[index], second.particles[index]);
  }
});

test("the finished image is nine hundred steps of every particle", () => {
  assert.equal(TOTAL_STEPS, 900);
  assert.equal(PARTICLE_COUNT * TOTAL_STEPS, 1_665_000);
});

test("spawning stays inside the canvas at its edges", () => {
  const lowest = spawn(WIDTH, HEIGHT, (low) => low);
  assert.deepEqual(lowest, { x: 0, y: 0, hue: HUE_LOW });
  assert.ok(isInside(lowest.x, lowest.y, WIDTH, HEIGHT));
});

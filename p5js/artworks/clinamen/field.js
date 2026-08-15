export const PARTICLE_COUNT = 1850;
/** How far a particle travels along the field in one step, in canvas pixels. */
export const STEP = 1.4;
/** Noise is sampled at this many units per pixel, so the field's cells are ~360 px across. */
export const NOISE_SCALE = 0.0028;
/**
 * The noise value spans two whole revolutions rather than one. A single turn would leave
 * every direction reachable from only one band of noise values, and the field would drift
 * one way overall; two turns fold the range back on itself, which is what produces the
 * facing pairs of combed streams that meet along a seam.
 */
export const TURNS = 2;
export const TOTAL_STEPS = 900;
export const ART_SEED = 20260808;
/** Trails run from cyan through to indigo. */
export const HUE_LOW = 190;
export const HUE_HIGH = 265;

/** A particle placed anywhere on the canvas, carrying the hue it keeps until it is replaced. */
export function spawn(width, height, random) {
  return {
    x: random(0, width),
    y: random(0, height),
    hue: random(HUE_LOW, HUE_HIGH)
  };
}

/** `random` is injected so a population can be built and replayed without p5. */
export function createParticles(width, height, random) {
  return Array.from({ length: PARTICLE_COUNT }, () => spawn(width, height, random));
}

/** The field's direction at a point: one noise sample stretched over `TURNS` revolutions. */
export function flowAngle(noise, x, y) {
  return noise(x * NOISE_SCALE, y * NOISE_SCALE) * Math.PI * 2 * TURNS;
}

export function isInside(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * One step for every particle: read the field, emit the segment, then either keep the new
 * position or replace the particle.
 *
 * The segment is handed to `drawSegment` before the bounds are tested, so a particle that
 * leaves the canvas still draws the step that took it out. That is what lets the trails run
 * off the edge instead of stopping short of it.
 *
 * Order matters beyond the drawing: a replacement draws three numbers from `random`, so the
 * sequence every later particle sees depends on how many left the canvas before it.
 */
export function advanceParticles(particles, width, height, noise, random, drawSegment) {
  for (const particle of particles) {
    const angle = flowAngle(noise, particle.x, particle.y);
    const nextX = particle.x + Math.cos(angle) * STEP;
    const nextY = particle.y + Math.sin(angle) * STEP;

    drawSegment(particle, nextX, nextY);

    if (isInside(nextX, nextY, width, height)) {
      particle.x = nextX;
      particle.y = nextY;
      continue;
    }
    const replacement = spawn(width, height, random);
    particle.x = replacement.x;
    particle.y = replacement.y;
    particle.hue = replacement.hue;
  }
}

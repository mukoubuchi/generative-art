export const SIM_SIZE = 420;
export const ITERATIONS = 1200;
export const COLONY_COUNT = 72;
/** The seed the Processing sketch fixed so its colony would be reproducible. */
export const ART_SEED = 20260808;
export const DIFFUSION_A = 1.0;
export const DIFFUSION_B = 0.5;
export const BASE_FEED = 0.0545;
export const BASE_KILL = 0.0620;
export const GOLDEN_ANGLE = 2.3999632;

/**
 * The nine-point Laplacian the sketch used. Its weights sum to zero, which is what makes
 * it a diffusion operator rather than a blur — a flat field stays flat.
 */
export const CENTRE_WEIGHT = -1;
export const EDGE_WEIGHT = 0.2;
export const CORNER_WEIGHT = 0.05;

function clamp(value, low, high) {
  return value < low ? low : (value > high ? high : value);
}

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

export function laplacian(field, x, y) {
  const index = x + y * SIM_SIZE;
  return CENTRE_WEIGHT * field[index]
    + EDGE_WEIGHT * (
      field[index - 1] + field[index + 1]
      + field[index - SIM_SIZE] + field[index + SIM_SIZE]
    )
    + CORNER_WEIGHT * (
      field[index - SIM_SIZE - 1] + field[index - SIM_SIZE + 1]
      + field[index + SIM_SIZE - 1] + field[index + SIM_SIZE + 1]
    );
}

/**
 * A grid of the two chemicals plus the feed and kill rates, which vary across space. The
 * noise makes the colony uneven and the radial term starves its outside, so growth stays
 * inside the frame instead of reaching the edges.
 *
 * `noise` is injected so the simulation can be exercised without a p5 instance.
 */
export function createSimulation(noise) {
  const cells = SIM_SIZE * SIM_SIZE;
  const simulation = {
    chemicalA: new Float32Array(cells).fill(1),
    chemicalB: new Float32Array(cells),
    nextA: new Float32Array(cells).fill(1),
    nextB: new Float32Array(cells),
    feedField: new Float32Array(cells),
    killField: new Float32Array(cells)
  };
  const centre = SIM_SIZE * 0.5;
  const radialScale = SIM_SIZE * 0.7;
  for (let y = 0; y < SIM_SIZE; y += 1) {
    for (let x = 0; x < SIM_SIZE; x += 1) {
      const index = x + y * SIM_SIZE;
      const radial = Math.hypot(x - centre, y - centre) / radialScale;
      simulation.feedField[index] = BASE_FEED
        + mix(-0.0024, 0.0024, noise(x * 0.018, y * 0.018))
        - radial * 0.0008;
      simulation.killField[index] = BASE_KILL
        + mix(-0.0018, 0.0018, noise(x * 0.013 + 80, y * 0.013 + 80))
        + radial * 0.0006;
    }
  }
  return simulation;
}

/** Fills a disc with the second chemical, strongest at its centre. */
export function seedCircle(simulation, centreX, centreY, radius) {
  const minimumX = Math.max(1, Math.floor(centreX - radius));
  const maximumX = Math.min(SIM_SIZE - 2, Math.ceil(centreX + radius));
  const minimumY = Math.max(1, Math.floor(centreY - radius));
  const maximumY = Math.min(SIM_SIZE - 2, Math.ceil(centreY + radius));
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const distance = Math.hypot(x - centreX, y - centreY);
      if (distance > radius) {
        continue;
      }
      const index = x + y * SIM_SIZE;
      const edge = clamp(1 - distance / radius, 0, 1);
      simulation.chemicalA[index] = mix(0.42, 0.12, edge);
      simulation.chemicalB[index] = mix(0.64, 1.0, edge);
    }
  }
}

/**
 * One large colony at the centre and COLONY_COUNT smaller ones placed by the golden angle,
 * which spreads them without the rings a constant angle would produce. `random` is
 * injected for the same reason as `noise`.
 */
export function seedColonies(simulation, random) {
  const centre = SIM_SIZE * 0.5;
  seedCircle(simulation, centre, centre, 11);
  for (let index = 0; index < COLONY_COUNT; index += 1) {
    const radius = Math.sqrt(random(0, 1)) * SIM_SIZE * 0.33;
    const angle = index * GOLDEN_ANGLE + random(-0.24, 0.24);
    seedCircle(
      simulation,
      centre + Math.cos(angle) * radius,
      centre + Math.sin(angle) * radius,
      random(2.5, 6.5)
    );
  }
}

/** One Gray-Scott step over the interior, then swap the buffers. */
export function advance(simulation) {
  const { chemicalA, chemicalB, nextA, nextB, feedField, killField } = simulation;
  for (let y = 1; y < SIM_SIZE - 1; y += 1) {
    for (let x = 1; x < SIM_SIZE - 1; x += 1) {
      const index = x + y * SIM_SIZE;
      const a = chemicalA[index];
      const b = chemicalB[index];
      const reaction = a * b * b;
      const feed = feedField[index];
      const kill = killField[index];
      nextA[index] = clamp(
        a + DIFFUSION_A * laplacian(chemicalA, x, y) - reaction + feed * (1 - a),
        0,
        1
      );
      nextB[index] = clamp(
        b + DIFFUSION_B * laplacian(chemicalB, x, y) + reaction - (kill + feed) * b,
        0,
        1
      );
    }
  }
  simulation.chemicalA = nextA;
  simulation.nextA = chemicalA;
  simulation.chemicalB = nextB;
  simulation.nextB = chemicalB;
}

export function run(simulation, iterations) {
  for (let step = 0; step < iterations; step += 1) {
    advance(simulation);
  }
  return simulation;
}

/** The second chemical read at a fractional grid position. */
export function sampleBilinear(field, gridX, gridY) {
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = Math.min(x0 + 1, SIM_SIZE - 1);
  const y1 = Math.min(y0 + 1, SIM_SIZE - 1);
  const fractionX = gridX - x0;
  const fractionY = gridY - y0;
  const top = mix(field[x0 + y0 * SIM_SIZE], field[x1 + y0 * SIM_SIZE], fractionX);
  const bottom = mix(field[x0 + y1 * SIM_SIZE], field[x1 + y1 * SIM_SIZE], fractionX);
  return mix(top, bottom, fractionY);
}

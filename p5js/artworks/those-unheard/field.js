export const LOGICAL_SIZE = 680;
export const PLATE_INSET = 24;
export const PLATE_SIZE = LOGICAL_SIZE - 2 * PLATE_INSET;
export const PLAYBACK_FPS = 30;
export const SUBSTEPS = 4;
export const DURATION_SECONDS = 24;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;
export const ART_SEED = 0x519ea7;
export const GRAIN_COUNT = 120_000;
export const FIELD_GRID_SIZE = 512;
// The integer mode sum: -Delta has the positive eigenvalue MODE_SUM * pi^2.
export const MODE_SUM = 130;
export const MODES = Object.freeze([
  Object.freeze([3, 11]), Object.freeze([7, 9]),
  Object.freeze([9, 7]), Object.freeze([11, 3])
]);

export const STROKE_SECONDS = 6;
export const ONSET = 0.35;
export const CRESCENDO = 1.4;
export const RELEASE = 4;
export const RING_DOWN = 0.2;
export const LIFT_THRESHOLD = 0.025;
export const FRICTION_SECONDS = 0.055;
export const VELOCITY_SCALE = 0.6;
export const DT = 1 / (PLAYBACK_FPS * SUBSTEPS);
const DECAY = Math.exp(-DT / FRICTION_SECONDS);
const KICK = VELOCITY_SCALE * Math.sqrt(1 - DECAY * DECAY);

// These special values are mathematical zeros, not tolerance-based classifications.
function cosMode(m, x) {
  if (x === 0) return 1;
  if (x === 1) return m % 2 === 0 ? 1 : -1;
  if (x === 0.5) return m % 2 === 1 ? 0 : (m % 4 === 0 ? 1 : -1);
  return Math.cos(m * Math.PI * x);
}

function sinMode(m, x) {
  if (x === 0 || x === 1) return 0;
  return Math.sin(m * Math.PI * x);
}

export function basisAt(x, y, modes = MODES) {
  return modes.map(([m, n]) => cosMode(m, x) * cosMode(n, y));
}

/** Choose a direction in the eigenspace, optionally imposing one additional zero. */
export function coefficientsAt(bow, hold = null, modes = MODES) {
  const v = basisAt(...bow, modes);
  if (hold) {
    const w = basisAt(...hold, modes);
    const norm = w.reduce((sum, value) => sum + value * value, 0);
    if (norm > 1e-24) {
      const projection = v.reduce((sum, value, i) => sum + value * w[i], 0) / norm;
      for (let i = 0; i < v.length; i += 1) v[i] -= projection * w[i];
    }
  }
  const length = Math.hypot(...v);
  if (length < 1e-12) throw new Error("The chosen points produce no figure.");
  return v.map((value) => value / length);
}

export const SHAPES = Object.freeze([
  { bow: [0, 0], hold: null },
  { bow: [0.25, 0], hold: null },
  { bow: [1 / 3, 0], hold: [0.25, 0.25] },
  { bow: [0.15, 0], hold: [0.25, 0.25] }
].map((shape) => Object.freeze({
  ...shape,
  coefficients: Object.freeze(coefficientsAt(shape.bow, shape.hold))
})));

export function fieldAt(coefficients, x, y, modes = MODES) {
  let value = 0;
  for (let k = 0; k < modes.length; k += 1) {
    const [m, n] = modes[k];
    value += coefficients[k] * cosMode(m, x) * cosMode(n, y);
  }
  return value;
}

export function gradientAt(coefficients, x, y, modes = MODES) {
  let dx = 0;
  let dy = 0;
  for (let k = 0; k < modes.length; k += 1) {
    const [m, n] = modes[k];
    dx -= coefficients[k] * m * Math.PI * sinMode(m, x) * cosMode(n, y);
    dy -= coefficients[k] * n * Math.PI * cosMode(m, x) * sinMode(n, y);
  }
  return [dx, dy];
}

/** A tabulated spatial envelope; the analytic field above defines the eigenfunction. */
export function createFields(size = FIELD_GRID_SIZE) {
  const side = size + 1;
  const cosines = new Map();
  for (const [m, n] of MODES) {
    for (const index of [m, n]) {
      if (!cosines.has(index)) {
        cosines.set(index, Float64Array.from({ length: side }, (_, k) => cosMode(index, k / size)));
      }
    }
  }
  return SHAPES.map(({ coefficients }) => {
    const samples = new Float64Array(side * side);
    let peak = 0;
    for (let row = 0; row < side; row += 1) {
      for (let column = 0; column < side; column += 1) {
        let value = 0;
        for (let k = 0; k < MODES.length; k += 1) {
          const [m, n] = MODES[k];
          value += coefficients[k] * cosines.get(m)[column] * cosines.get(n)[row];
        }
        samples[row * side + column] = value;
        peak = Math.max(peak, Math.abs(value));
      }
    }
    for (let k = 0; k < samples.length; k += 1) samples[k] /= peak;
    return { size, side, samples, peak, coefficients: coefficients.map((value) => value / peak) };
  });
}

export function sampleField(field, x, y) {
  const gx = Math.min(field.size, Math.max(0, x * field.size));
  const gy = Math.min(field.size, Math.max(0, y * field.size));
  const column = Math.min(field.size - 1, Math.floor(gx));
  const row = Math.min(field.size - 1, Math.floor(gy));
  const fx = gx - column;
  const fy = gy - row;
  const cell = row * field.side + column;
  const a = field.samples[cell] * (1 - fx) + field.samples[cell + 1] * fx;
  const b = field.samples[cell + field.side] * (1 - fx) + field.samples[cell + field.side + 1] * fx;
  return a * (1 - fy) + b * fy;
}

/** Four separate excitations, each with a crescendo and a dissipative ring-down. */
export function excitationAt(time) {
  const index = Math.min(SHAPES.length - 1, Math.max(0, Math.floor(time / STROKE_SECONDS)));
  const local = time - index * STROKE_SECONDS;
  let amplitude = 0;
  if (local >= ONSET && local < STROKE_SECONDS) {
    amplitude = local < RELEASE
      ? Math.min(1, LIFT_THRESHOLD * Math.exp((local - ONSET) / CRESCENDO * Math.log(1 / LIFT_THRESHOLD)))
      : Math.exp(-(local - RELEASE) / RING_DOWN);
  }
  return { index, amplitude };
}

export function agitation(amplitude, value) {
  return Math.max(0, amplitude * Math.abs(value) - LIFT_THRESHOLD) / (1 - LIFT_THRESHOLD);
}

function nextRandom(state) {
  let bits = state.randomState;
  bits ^= bits << 13;
  bits ^= bits >>> 17;
  bits ^= bits << 5;
  state.randomState = bits >>> 0;
  return state.randomState;
}

// Quantized Box-Muller radii and angles avoid transcendental work for each grain.
const RANDOM_BINS = 4096;
const RADII = Float64Array.from({ length: RANDOM_BINS }, (_, k) => Math.sqrt(-2 * Math.log((k + 0.5) / RANDOM_BINS)));
const COSINES = Float64Array.from({ length: RANDOM_BINS }, (_, k) => Math.cos(2 * Math.PI * (k + 0.5) / RANDOM_BINS));
const SINES = Float64Array.from({ length: RANDOM_BINS }, (_, k) => Math.sin(2 * Math.PI * (k + 0.5) / RANDOM_BINS));

export function createGrains({ count = GRAIN_COUNT, seed = ART_SEED, fields = createFields() } = {}) {
  const state = {
    count, fields, seed, randomState: seed >>> 0 || 1, steps: 0,
    x: new Float64Array(count), y: new Float64Array(count),
    vx: new Float64Array(count), vy: new Float64Array(count),
    shutter: Array.from({ length: SUBSTEPS }, () => new Float32Array(2 * count))
  };
  for (let k = 0; k < count; k += 1) {
    state.x[k] = (nextRandom(state) + 0.5) / 0x100000000;
    state.y[k] = (nextRandom(state) + 0.5) / 0x100000000;
    for (const sample of state.shutter) {
      sample[2 * k] = state.x[k];
      sample[2 * k + 1] = state.y[k];
    }
  }
  return state;
}

/** Langevin kicks vanish near nodes; friction then leaves grains there without attraction. */
export function advanceGrains(state, substeps = SUBSTEPS, kickScale = 1) {
  for (let step = 0; step < substeps; step += 1) {
    const drive = excitationAt(state.steps * DT);
    const field = state.fields[drive.index];
    const exposure = state.shutter[state.steps % SUBSTEPS];
    for (let k = 0; k < state.count; k += 1) {
      const intensity = agitation(drive.amplitude, sampleField(field, state.x[k], state.y[k]));
      const bits = nextRandom(state);
      const radius = RADII[(bits >>> 12) & 4095];
      const angle = bits & 4095;
      const impulse = KICK * intensity * kickScale * radius;
      let vx = DECAY * state.vx[k] + impulse * COSINES[angle];
      let vy = DECAY * state.vy[k] + impulse * SINES[angle];
      let x = state.x[k] + vx * DT;
      let y = state.y[k] + vy * DT;
      // A reflecting fence is part of this model; a free Chladni plate has no fence.
      if (x < 0) { x = -x; vx = -vx; }
      if (x > 1) { x = 2 - x; vx = -vx; }
      if (y < 0) { y = -y; vy = -vy; }
      if (y > 1) { y = 2 - y; vy = -vy; }
      state.x[k] = x;
      state.y[k] = y;
      state.vx[k] = vx;
      state.vy[k] = vy;
      exposure[2 * k] = x;
      exposure[2 * k + 1] = y;
    }
    state.steps += 1;
  }
  return state;
}

/** The local linear estimate is used only to measure already-near-node grains. */
export function nearNodeFraction(state, index, pixels = 2) {
  const coefficients = state.fields[index].coefficients;
  let near = 0;
  for (let k = 0; k < state.count; k += 1) {
    const value = Math.abs(fieldAt(coefficients, state.x[k], state.y[k]));
    const gradient = Math.hypot(...gradientAt(coefficients, state.x[k], state.y[k]));
    if (value === 0 || (gradient > 0 && value / gradient * PLATE_SIZE < pixels)) near += 1;
  }
  return near / state.count;
}

/** A periodic complex field: fixed amplitudes, quadratic propagation phases. */
export const SIZE = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
export const GRID = 256;
export const TAU = 2 * Math.PI;

// The ground and gold are Moire Rings' colours. The highlight is the bone of
// By Misunderstanding. This transfer function and its exposure never animate.
export const GROUND = [13, 18, 27];
export const GOLD = [214, 190, 132];
export const BONE = [246, 244, 236];
export const EXPOSURE = 0.66;

/**
 * Two crossing packets. Nearby squared wave numbers keep the interference
 * changes slow even though the threads themselves are fine. Subtracting 50
 * from every propagation frequency removes only a common, invisible phase.
 */
const DIRECTIONS = [[7, -3], [7, -2], [7, -1], [7, 1], [7, 2], [7, 3], [8, -1], [8, 1], [6, -4], [6, 4], [6, -5], [6, 5]];
const raw = DIRECTIONS.flatMap(([m, n]) => [
  { m, n, weight: 1 / (1 + 0.08 * n * n), phase: 0.38 * n * n + 0.11 * m * n },
  { m: -n, n: m, weight: 0.88 / (1 + 0.08 * n * n), phase: -0.29 * n * n + 0.17 * m * n + 0.9 }
]);
const norm = Math.sqrt(raw.reduce((sum, mode) => sum + mode.weight ** 2, 0));
export const MODES = raw.map(({ m, n, weight, phase }) => ({ m, n, amplitude: weight / norm, phase, rate: m * m + n * n - 50 }));

export function frameAt(seconds) {
  return Math.max(0, Math.floor(seconds * FPS)) % FRAMES;
}

/** No endpoint substitution: a full unit of propagation restores each phase. */
export function coefficient(mode, progress) {
  const angle = mode.phase - TAU * mode.rate * progress;
  return { re: mode.amplitude * Math.cos(angle), im: mode.amplitude * Math.sin(angle) };
}

export function fieldAt(x, y, progress, modes = MODES) {
  let re = 0;
  let im = 0;
  for (const mode of modes) {
    const angle = TAU * (mode.m * x + mode.n * y - mode.rate * progress) + mode.phase;
    re += mode.amplitude * Math.cos(angle);
    im += mode.amplitude * Math.sin(angle);
  }
  return { re, im, intensity: re * re + im * im };
}

/**
 * A stationary, invertible pair of shears wraps the torus onto a woven surface.
 * The optical propagation lives in (u,v); this coordinate map is the artwork's
 * spatial interpretation, not a claim that a bent screen solves free-space optics.
 */
export function surfaceAt(x, y) {
  const u = x + 0.145 * Math.sin(TAU * y) + 0.035 * Math.sin(2 * TAU * y + 0.7);
  const v = y + 0.12 * Math.sin(TAU * u + 0.5) + 0.025 * Math.sin(3 * TAU * u);
  return { u, v };
}

export function colourAt(intensity) {
  const light = 1 - Math.exp(-EXPOSURE * Math.max(0, intensity));
  const white = light ** 7;
  return GROUND.map((base, i) => Math.round(base + (GOLD[i] - base) * light + (BONE[i] - GOLD[i]) * white));
}

/**
 * A separable direct Fourier synthesis. Only the short one-dimensional bases
 * are stored; the image is not a cache of frames, nor is a history integrated.
 */
export function makeSampler(size = GRID, modes = MODES) {
  const bases = modes.map((mode) => {
    const xs = new Float64Array(size * 2);
    const ys = new Float64Array(size * 2);
    for (let i = 0; i < size; i += 1) {
      xs[2 * i] = Math.cos(TAU * mode.m * i / size);
      xs[2 * i + 1] = Math.sin(TAU * mode.m * i / size);
      ys[2 * i] = Math.cos(TAU * mode.n * i / size);
      ys[2 * i + 1] = Math.sin(TAU * mode.n * i / size);
    }
    return { xs, ys };
  });
  const re = new Float64Array(size * size);
  const im = new Float64Array(size * size);
  return {
    size, re, im,
    at(progress) {
      re.fill(0); im.fill(0);
      modes.forEach((mode, index) => {
        const c = coefficient(mode, progress);
        const { xs, ys } = bases[index];
        for (let y = 0; y < size; y += 1) {
          const yr = c.re * ys[2 * y] - c.im * ys[2 * y + 1];
          const yi = c.re * ys[2 * y + 1] + c.im * ys[2 * y];
          let offset = y * size;
          for (let x = 0; x < size; x += 1, offset += 1) {
            re[offset] += yr * xs[2 * x] - yi * xs[2 * x + 1];
            im[offset] += yr * xs[2 * x + 1] + yi * xs[2 * x];
          }
        }
      });
      return this;
    }
  };
}

export function sample(sampler, u, v) {
  const n = sampler.size;
  const x = ((u % 1) + 1) % 1 * n;
  const y = ((v % 1) + 1) % 1 * n;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = iy * n + ix, b = iy * n + (ix + 1) % n;
  const c = ((iy + 1) % n) * n + ix, d = ((iy + 1) % n) * n + (ix + 1) % n;
  const interpolate = (values) => (values[a] * (1 - fx) + values[b] * fx) * (1 - fy) + (values[c] * (1 - fx) + values[d] * fx) * fy;
  const re = interpolate(sampler.re), im = interpolate(sampler.im);
  return re * re + im * im;
}

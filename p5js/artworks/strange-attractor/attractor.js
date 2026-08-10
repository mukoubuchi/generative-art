/**
 * Peter de Jong's map. The four coefficients are the artwork: change one and the figure
 * becomes a different creature entirely.
 */
export const COEFFICIENT_A = 1.4;
export const COEFFICIENT_B = -2.3;
export const COEFFICIENT_C = 2.4;
export const COEFFICIENT_D = -2.1;

export const POINT_COUNT = 336_000;
/**
 * Iterations run before any point is kept. The orbit is drawn towards the attractor from
 * wherever it starts, so discarding the approach is what makes the picture a property of
 * the coefficients rather than of the starting point.
 */
export const WARMUP_STEPS = 1_000;
export const COLOR_BINS = 32;
export const ART_SEED = 20260808;
/** The cloud is fitted to this fraction of the shorter side, leaving a margin. */
export const FILL_RATIO = 0.84;
/** Hue runs from cyan at the foot of the figure to magenta at its crown. */
export const HUE_LOW = 182;
export const HUE_SPAN = 144;
/** The highlight layer redraws every third point, nudged off the layer beneath it. */
export const HIGHLIGHT_STRIDE = 3;
export const HIGHLIGHT_OFFSET_X = 0.5;
export const HIGHLIGHT_OFFSET_Y = -0.35;

/** One step of the map. Both coordinates are read from the previous pair, not updated in place. */
export function nextPoint(x, y) {
  return {
    x: Math.sin(COEFFICIENT_A * y) - Math.cos(COEFFICIENT_B * x),
    y: Math.sin(COEFFICIENT_C * x) - Math.cos(COEFFICIENT_D * y)
  };
}

/**
 * Iterates the map and keeps the points after the warmup. Coordinates are held as float32
 * for the same reason the py5 sketch held them that way: the cloud is a third of a million
 * points and only ever used as pixel positions.
 */
export function calculateOrbit(startX, startY) {
  const xs = new Float32Array(POINT_COUNT);
  const ys = new Float32Array(POINT_COUNT);
  let x = startX;
  let y = startY;

  for (let step = 0; step < POINT_COUNT + WARMUP_STEPS; step += 1) {
    const nextX = Math.sin(COEFFICIENT_A * y) - Math.cos(COEFFICIENT_B * x);
    const nextY = Math.sin(COEFFICIENT_C * x) - Math.cos(COEFFICIENT_D * y);
    x = nextX;
    y = nextY;
    if (step >= WARMUP_STEPS) {
      xs[step - WARMUP_STEPS] = x;
      ys[step - WARMUP_STEPS] = y;
    }
  }
  return { xs, ys };
}

function extent(values) {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of values) {
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  // A degenerate orbit would divide by zero; the floor keeps the placement finite.
  return { lowest, highest, span: Math.max(highest - lowest, 1e-6) };
}

/**
 * Centres the cloud's bounding box on the canvas and scales it to `FILL_RATIO` of whichever
 * side constrains it. The vertical axis is not flipped, so the figure sits the way the py5
 * sketch drew it.
 */
export function fitToCanvas(orbit, width, height) {
  const horizontal = extent(orbit.xs);
  const vertical = extent(orbit.ys);
  const scale = Math.min(
    (width * FILL_RATIO) / horizontal.span,
    (height * FILL_RATIO) / vertical.span
  );
  const centreX = (horizontal.lowest + horizontal.highest) * 0.5;
  const centreY = (vertical.lowest + vertical.highest) * 0.5;

  const xs = new Float32Array(POINT_COUNT);
  const ys = new Float32Array(POINT_COUNT);
  for (let index = 0; index < POINT_COUNT; index += 1) {
    xs[index] = (orbit.xs[index] - centreX) * scale + width * 0.5;
    ys[index] = (orbit.ys[index] - centreY) * scale + height * 0.5;
  }
  return { xs, ys, scale, horizontal, vertical };
}

/**
 * Which colour band a point falls in, from its height within the cloud. Colouring by
 * position rather than by iteration order is what makes the bands follow the figure's
 * shape instead of scattering across it.
 */
export function colorBins(ys) {
  const { lowest, span } = extent(ys);
  const bins = new Uint8Array(ys.length);
  for (let index = 0; index < ys.length; index += 1) {
    const position = (ys[index] - lowest) / span;
    bins[index] = Math.min(COLOR_BINS - 1, Math.max(0, Math.floor(position * COLOR_BINS)));
  }
  return bins;
}

export function binHue(index) {
  return HUE_LOW + (index * HUE_SPAN) / (COLOR_BINS - 1);
}

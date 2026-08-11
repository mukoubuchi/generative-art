/**
 * The Hilbert curve, degree by degree.
 *
 * A degree-k curve visits every cell of the 2^k x 2^k grid exactly once, and consecutive
 * cells are always edge-neighbours. Those two facts together are the whole point: the
 * curve is a single unbroken line that fills a square, and points close along the line
 * stay close in the square. The construction is the standard bit-recursion: read the
 * index two bits at a time from the top, and at each level rotate or reflect the
 * quadrant's sub-curve so its ends meet its neighbours' — which is exactly the gluing
 * that keeps consecutive cells adjacent across quadrant boundaries.
 *
 * Everything here works on cell indices and unit coordinates; pixels are the sketch's
 * business.
 */

/** Cell centre of index i on the degree-k curve, in the unit square, y upward. */
export function hilbertPoint(index, degree) {
  const side = 1 << degree;
  let x = 0;
  let y = 0;
  let remaining = index;
  for (let half = 1; half < side; half *= 2) {
    const rx = 1 & (remaining / 2);
    const ry = 1 & (remaining ^ rx);
    // The lower quadrants are entered travelling the other way, so their sub-curves are
    // reflected — without this the line would jump when it crosses into them.
    if (ry === 0) {
      if (rx === 1) {
        x = half - 1 - x;
        y = half - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += half * rx;
    y += half * ry;
    remaining = Math.floor(remaining / 4);
  }
  return [(x + 0.5) / side, (y + 0.5) / side];
}

/**
 * The whole degree-k curve as 4^k points in visiting order. The curve is used as a
 * function of arc length, and this is that function tabulated.
 */
export function hilbertCurve(degree) {
  const points = [];
  for (let index = 0; index < 4 ** degree; index += 1) {
    points.push(hilbertPoint(index, degree));
  }
  return points;
}

/**
 * The curve of `degree`, resampled at `samples` evenly spaced parameters of its arc.
 * Sampling every degree at one common parameter grid is what makes two degrees
 * comparable point-for-point: parameter t of the coarse curve and parameter t of the
 * fine one are "the same moment" of the walk, so a morph between them moves each sample
 * to where its own moment now lives, rather than tearing the line apart.
 */
export function sampledCurve(degree, samples) {
  const points = hilbertCurve(degree);
  const sampled = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const at = (sample / (samples - 1)) * (points.length - 1);
    const before = Math.min(Math.floor(at), points.length - 2);
    const t = at - before;
    const [x0, y0] = points[before];
    const [x1, y1] = points[before + 1];
    sampled.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  }
  return sampled;
}

/**
 * What a frame of the clip shows: which pair of degrees is on stage and how far the
 * morph between them has run, as a pure function of the frame index.
 *
 * The clip walks degrees `first..last`, holding each before easing to the next. The
 * ease is the cubic smoothstep, so the line leaves one degree and arrives at the next
 * with no kick at either end.
 */
export function morphSchedule(frameIndex, { first, last, holdFrames, morphFrames }) {
  const stage = holdFrames + morphFrames;
  const stages = last - first;
  const total = stages * stage + holdFrames;
  const clamped = Math.max(0, Math.min(frameIndex, total - 1));
  if (clamped >= stages * stage) {
    // The tail hold after the last morph: the finished curve, nothing moving.
    return { from: last, to: last, blend: 1, totalFrames: total };
  }
  const within = clamped % stage;
  const step = Math.floor(clamped / stage);
  if (within < holdFrames) {
    return { from: first + step, to: first + step + 1, blend: 0, totalFrames: total };
  }
  const linear = (within - holdFrames + 1) / morphFrames;
  return {
    from: first + step,
    to: first + step + 1,
    blend: linear * linear * (3 - 2 * linear),
    totalFrames: total
  };
}

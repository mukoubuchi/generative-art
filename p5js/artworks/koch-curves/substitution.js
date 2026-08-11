/**
 * One angled substitution, and everything that follows from repeating it.
 *
 * The law replaces a segment with four equal shorter ones — out, up over a peak of
 * eighty-five degrees, down, and on — chosen so the children join the parent's
 * endpoints exactly. Repeating it along every side of a square is the whole artwork.
 * At this angle each generation multiplies the perimeter by about 1.84, so five
 * generations grow the square's rim more than twentyfold while it encloses the same
 * ground; the length is running away, and the clip's rhythm is built to make that
 * felt: each generation erupts faster than the one before, an accelerando paced in
 * step with the divergence. The tests measure the law once and then its consequences
 * — the constant growth ratio, the similarity dimension the angle implies, and the
 * eruption that begins flat on the parent at exactly the old length and ends at
 * exactly the new one.
 */

export const PEAK_ANGLE = (85 * Math.PI) / 180;
export const GENERATIONS = 5;
/** Each child's share of its parent's length: the one number the angle decides. */
export const CHILD_RATIO = 1 / (2 * (1 + Math.cos(PEAK_ANGLE)));

function point(x, y) {
  return { x, y };
}

/** The law, applied once: four children joining the parent's own endpoints. */
export function subdivide(segment) {
  const offsetX = segment.end.x - segment.start.x;
  const offsetY = segment.end.y - segment.start.y;
  const length = Math.hypot(offsetX, offsetY);
  const childLength = length * CHILD_RATIO;
  const unitX = offsetX / length;
  const unitY = offsetY / length;
  const shortX = unitX * childLength;
  const shortY = unitY * childLength;
  const rotatedX = shortX * Math.cos(PEAK_ANGLE) - shortY * Math.sin(PEAK_ANGLE);
  const rotatedY = shortX * Math.sin(PEAK_ANGLE) + shortY * Math.cos(PEAK_ANGLE);

  const a = segment.start;
  const b = point(a.x + shortX, a.y + shortY);
  const c = point(b.x + rotatedX, b.y + rotatedY);
  const d = point(segment.end.x - shortX, segment.end.y - shortY);
  return [
    { start: a, end: b },
    { start: b, end: c },
    { start: c, end: d },
    { start: d, end: segment.end }
  ];
}

/** The unit square the law is repeated on, wound the way the artwork always wound it. */
export function unitSquare() {
  return [
    { start: point(0, 0), end: point(1, 0) },
    { start: point(1, 0), end: point(1, 1) },
    { start: point(1, 1), end: point(0, 1) },
    { start: point(0, 1), end: point(0, 0) }
  ];
}

/** The whole rim at a generation: the square with the law applied that many times. */
export function generationSegments(generation) {
  let segments = unitSquare();
  for (let step = 0; step < generation; step += 1) {
    segments = segments.flatMap(subdivide);
  }
  return segments;
}

export function perimeter(segments) {
  return segments.reduce(
    (sum, segment) => sum + Math.hypot(
      segment.end.x - segment.start.x,
      segment.end.y - segment.start.y
    ),
    0
  );
}

/**
 * A generation caught mid-eruption. Every parent carries its four children flat on its
 * own line — the peak vertex starting at the midpoint between its feet, so the flat
 * children measure exactly the parent — and `blend` raises every peak at once toward
 * its place. At zero this is the parent generation to the last bit of length; at one
 * it is the next generation exactly.
 */
export function eruptionSegments(generation, blend) {
  const eased = blend * blend * (3 - 2 * blend);
  return generationSegments(generation).flatMap((parent) => {
    const [first, second, third, fourth] = subdivide(parent);
    const flatPeak = point(
      (first.end.x + third.end.x) / 2,
      (first.end.y + third.end.y) / 2
    );
    const peak = point(
      flatPeak.x + (second.end.x - flatPeak.x) * eased,
      flatPeak.y + (second.end.y - flatPeak.y) * eased
    );
    return [
      first,
      { start: first.end, end: peak },
      { start: peak, end: third.end },
      fourth
    ];
  });
}

/**
 * The accelerando: each generation's stage — a hold and then its eruption — takes six
 * tenths of the time the previous one took, and the finished rim keeps a final hold.
 * Whole frames are dealt by largest remainder so the plan lands on the clip exactly.
 */
export const STAGE_RATIO = 0.6;
export const FINAL_HOLD_FRAMES = 48;
export const TOTAL_FRAMES = 300;
/** Within a stage, this share is the hold; the rest is the eruption. */
const HOLD_SHARE = 0.42;

export function accelerandoPlan() {
  const weights = Array.from({ length: GENERATIONS }, (unused, generation) =>
    STAGE_RATIO ** generation);
  const available = TOTAL_FRAMES - FINAL_HOLD_FRAMES;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight / total) * available);
  const floored = exact.map(Math.floor);
  let leftover = available - floored.reduce((sum, frames) => sum + frames, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (leftover === 0) {
      break;
    }
    floored[index] += 1;
    leftover -= 1;
  }
  return floored.map((frames, generation) => ({
    generation,
    holdFrames: Math.round(frames * HOLD_SHARE),
    eruptionFrames: frames - Math.round(frames * HOLD_SHARE)
  }));
}

/**
 * Everything a frame shows: which generation stands, and how far its eruption has
 * risen — blend 0 meaning the generation at rest, 1 meaning the next one arrived.
 */
export function sceneAt(frameIndex) {
  let cursor = 0;
  for (const stage of accelerandoPlan()) {
    if (frameIndex < cursor + stage.holdFrames) {
      return { generation: stage.generation, blend: 0 };
    }
    cursor += stage.holdFrames;
    if (frameIndex < cursor + stage.eruptionFrames) {
      return {
        generation: stage.generation,
        blend: (frameIndex - cursor) / stage.eruptionFrames
      };
    }
    cursor += stage.eruptionFrames;
  }
  return { generation: GENERATIONS, blend: 0 };
}

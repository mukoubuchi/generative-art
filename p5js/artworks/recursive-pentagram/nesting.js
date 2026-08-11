/**
 * A pentagram whose centre holds another, forever.
 *
 * The construction is one rule: draw the five diagonals of a pentagon, and the star's
 * own crossings enclose a smaller pentagon — turned half a step, shrunk by the square
 * of the golden ratio — on which the rule repeats. Neither number is placed by hand:
 * the module intersects the diagonals and *finds* the child pentagon, and the tests
 * pin what it finds against phi to twelve decimals. Because the whole nest is
 * invariant under one zoom-and-turn — scale by phi squared, rotate half a step — the
 * clip can dive toward the centre at a constant rate and arrive, after one nesting,
 * exactly where it began: the centre it was diving toward turns out to be the whole
 * again, which is the artwork's sentence from Pascal made structural.
 */

export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
export const POINTS = 5;
/** Half a step of the five: the turn one nesting adds. */
export const NESTING_TURN = Math.PI / POINTS;

/** The five vertices of a pentagon of the given circumradius, points up. */
export function pentagonVertices(radius, rotation) {
  return Array.from({ length: POINTS }, (unused, index) => {
    const angle = rotation - Math.PI / 2 + (index * 2 * Math.PI) / POINTS;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

/** The star: each vertex joined to the second next, five chords. */
export function pentagramSegments(radius, rotation) {
  const vertices = pentagonVertices(radius, rotation);
  return vertices.map((start, index) => ({
    start,
    end: vertices[(index + 2) % POINTS]
  }));
}

function intersect(first, second) {
  const a = first.start;
  const b = first.end;
  const c = second.start;
  const d = second.end;
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * The pentagon the star's crossings enclose, found rather than placed: adjacent chords
 * are intersected and the innermost ring of crossings is returned as the child's
 * vertices. Measuring them gives the child's circumradius and bearing.
 */
export function innerPentagonVertices(radius, rotation) {
  const chords = pentagramSegments(radius, rotation);
  return chords.map((chord, index) => intersect(chord, chords[(index + 1) % POINTS]));
}

/** The one shrink of the nesting, measured from the found child. */
export function measuredShrink() {
  const child = innerPentagonVertices(1, 0);
  return Math.hypot(child[0].x, child[0].y);
}

/**
 * The generations that can touch the screen when generation zero has `baseRadius`
 * pixels at the given zoom: every pentagram whose screen radius lies between a
 * whisper and the corner, consecutive, deepest first.
 */
export function generationRange(zoom, baseRadius, faintestRadius, cornerRadius) {
  const shrink = measuredShrink();
  const generations = [];
  const lowest = Math.floor(
    Math.log(faintestRadius / (baseRadius * zoom)) / Math.log(shrink)
  );
  for (let generation = lowest; generation >= -lowest; generation -= 1) {
    const screenRadius = baseRadius * zoom * shrink ** generation;
    if (screenRadius >= faintestRadius && screenRadius <= cornerRadius) {
      generations.push(generation);
    }
  }
  return generations.sort((a, b) => b - a);
}

/** The dive: one full nesting inward over the clip, exactly. */
export function zoomScale(frameIndex, totalFrames) {
  return (1 / measuredShrink()) ** (frameIndex / totalFrames);
}

export function stageRotation(frameIndex, totalFrames) {
  return -NESTING_TURN * (frameIndex / totalFrames);
}

/** The centre's light fades in over the innermost pixels; the regress has no floor. */
export function fadeAlpha(screenRadius, fadeFrom, fadeTo) {
  if (screenRadius <= fadeFrom) {
    return 0;
  }
  if (screenRadius >= fadeTo) {
    return 1;
  }
  return (screenRadius - fadeFrom) / (fadeTo - fadeFrom);
}

export const TOTAL_FRAMES = 300;

/**
 * A shell that grows forever without changing shape.
 *
 * The construction is the artwork's own: bands of a triangle strip, each sweeping one
 * full turn while its radius runs linearly from the band's start to twice it, each band
 * starting where the last ended. That one rule makes the whole figure self-similar in
 * an exact, discrete way — double every coordinate of band k and you have band k + 1,
 * vertex for vertex, and doubling is exact even in floating point. The clip leans on
 * that identity: the camera pulls back by one doubling over the loop, every generation
 * slides into the place its elder held, and the last frame is the first. Underneath the
 * bands lies the smooth law they sample, r(θ) = 2^(θ/2π), for which scaling is
 * rotation — s · r(θ) = r(θ + 2π · log₂ s) — so the retreat reads as one slow turn of
 * the shell, though nothing rotates anywhere in the code.
 */

export const ANGLE_STEP_DEGREES = 12;
const FULL_TURN_DEGREES = 360;
/** Radius ratio per whole turn: the doubling that defines the shell. */
export const DOUBLING = 2;

function polar(radius, degrees) {
  const angle = degrees * Math.PI / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** The smooth spiral the bands sample: radius 1 at angle zero, doubling every turn. */
export function spiralRadius(theta) {
  return DOUBLING ** (theta / (2 * Math.PI));
}

/**
 * Strip vertices of one band. Generation k starts at radius 2^k and sweeps one turn,
 * its radius linear in the angle, ending exactly on generation k + 1's start. An inner
 * point and the outer point at twice its radius for every sampled angle, in the order
 * the original strip emitted them.
 */
export function bandVertices(generation) {
  const start = DOUBLING ** generation;
  const vertices = [];
  for (let degrees = 0; degrees <= FULL_TURN_DEGREES; degrees += ANGLE_STEP_DEGREES) {
    const radius = start * (1 + degrees / FULL_TURN_DEGREES);
    vertices.push(polar(radius, degrees));
    vertices.push(polar(2 * radius, degrees));
  }
  return vertices;
}

/**
 * The strip read as triangles: one from every three consecutive vertices, drawn
 * explicitly so the lattice does not depend on how a renderer treats strip mode.
 */
export function stripTriangles(vertices) {
  const triangles = [];
  for (let index = 0; index + 2 < vertices.length; index += 1) {
    triangles.push([vertices[index], vertices[index + 1], vertices[index + 2]]);
  }
  return triangles;
}

/** The camera's pull-back: one full doubling outward over the clip, exactly. */
export function zoomScale(frameIndex, totalFrames) {
  return DOUBLING ** (-frameIndex / totalFrames);
}

/**
 * Which generations can touch the screen when generation zero's start radius maps to
 * `baseRadius` pixels at the given zoom. A band is worth drawing while its outermost
 * point is past a whisper and its innermost is short of the canvas corner.
 */
export function generationRange(zoom, baseRadius, faintestRadius, cornerRadius) {
  const screenStart = (generation) => baseRadius * zoom * DOUBLING ** generation;
  const lowest = Math.floor(Math.log2(faintestRadius / (2 * DOUBLING * baseRadius * zoom)));
  const highest = Math.ceil(Math.log2(cornerRadius / (baseRadius * zoom)));
  const generations = [];
  for (let generation = lowest; generation <= highest; generation += 1) {
    if (screenStart(generation) * 2 * DOUBLING >= faintestRadius
      && screenStart(generation) <= cornerRadius) {
      generations.push(generation);
    }
  }
  return generations;
}

/**
 * How much ink a point earns from its distance to the pole, on screen. The spiral is
 * bottomless — infinitely many ever-smaller whorls wait at the centre — so the light
 * fades in over the innermost pixels rather than pretending the regress has a floor.
 * Keyed to screen radius alone, which is what lets one loop's end coincide with the
 * next one's start.
 */
export function fadeAlpha(screenRadius, fadeFrom, fadeTo) {
  if (screenRadius <= fadeFrom) {
    return 0;
  }
  if (screenRadius >= fadeTo) {
    return 1;
  }
  return (screenRadius - fadeFrom) / (fadeTo - fadeFrom);
}

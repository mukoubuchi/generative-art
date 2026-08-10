/** Quads in the strip. The fifth pair of vertices repeats the first, closing the ring. */
export const FACE_COUNT = 4;
export const PAIR_COUNT = FACE_COUNT + 1;
const QUARTER_TURN = Math.PI / 2;
/** The original wrote TWO_PI / 6 for this, which is what makes the projection isometric. */
export const CORNER_ANGLE = Math.PI / 3;
/** Half-width and half-height of the ellipse the near corners travel, against the radius. */
export const X_RATIO = Math.cos(CORNER_ANGLE);
export const Y_RATIO = Math.sin(CORNER_ANGLE);

/**
 * Pointer position to rotation, as the original mapped it: the left edge of the canvas is
 * a half turn one way and the right edge a half turn the other, so crossing the canvas
 * turns the cube once.
 */
export function angleAt(pointerX, width) {
  return Math.PI - (pointerX / width) * 2 * Math.PI;
}

/**
 * Strip vertices in the order the original emitted them. Each pair is a near corner on the
 * projected ellipse and the far corner one radius behind it, and the four pairs are a
 * quarter turn apart.
 */
export function stripVertices(angle, radius) {
  const xLength = radius * X_RATIO;
  const yLength = radius * Y_RATIO;
  const vertices = [];
  for (let index = 0; index < PAIR_COUNT; index += 1) {
    const theta = angle + index * QUARTER_TURN;
    const x = xLength * Math.cos(theta);
    const y = yLength * Math.sin(theta);
    vertices.push({ x, y });
    vertices.push({ x: x - radius, y });
  }
  return vertices;
}

/**
 * The strip read as quads. A QUAD_STRIP makes one quad from every two consecutive pairs,
 * which is what has to be drawn explicitly to be sure the outlines match the original
 * rather than depending on how a renderer treats the strip mode.
 */
export function stripQuads(vertices) {
  const quads = [];
  for (let index = 0; index + 3 < vertices.length; index += 2) {
    quads.push([
      vertices[index],
      vertices[index + 1],
      vertices[index + 3],
      vertices[index + 2]
    ]);
  }
  return quads;
}

/**
 * Bounds of every position the figure passes through, not of one frame. The near corners
 * sweep the whole ellipse and each far corner trails one radius behind, so the envelope
 * reaches a radius further in one direction than the other — which is why the anchor is
 * not the middle of the figure.
 */
export function envelope(radius) {
  const xLength = radius * X_RATIO;
  const yLength = radius * Y_RATIO;
  return {
    left: -(xLength + radius),
    right: xLength,
    top: -yLength,
    bottom: yLength
  };
}

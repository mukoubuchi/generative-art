// The Processing sketch walked five bands of a triangle strip. Each band sweeps a full
// turn while its radius grows from the band radius to twice it, and the next band starts
// where the previous one ended, so the shell is one unbroken spiral.
export const BAND_COUNT = 5;
export const FIRST_BAND_RADIUS = 3;
export const ANGLE_STEP_DEGREES = 12;
const FULL_TURN_DEGREES = 360;

function polar(radius, degrees) {
  const angle = degrees * Math.PI / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/**
 * Strip vertices in the order the original emitted them: an inner point and the outer
 * point twice its radius, for every sampled angle of every band.
 */
export function stripVertices() {
  const vertices = [];
  let bandRadius = FIRST_BAND_RADIUS;
  for (let band = 0; band < BAND_COUNT; band += 1) {
    for (let degrees = 0; degrees <= FULL_TURN_DEGREES; degrees += ANGLE_STEP_DEGREES) {
      // Linear in the angle, so the band ends on exactly the next band's radius.
      const radius = bandRadius * (1 + degrees / FULL_TURN_DEGREES);
      vertices.push(polar(radius, degrees));
      vertices.push(polar(2 * radius, degrees));
    }
    bandRadius *= 2;
  }
  return vertices;
}

/**
 * The strip read as triangles. A TRIANGLE_STRIP makes one triangle from every three
 * consecutive vertices, which is what has to be drawn explicitly to be sure the outlines
 * match the original rather than depending on how a renderer treats the strip mode.
 */
export function stripTriangles(vertices) {
  const triangles = [];
  for (let index = 0; index + 2 < vertices.length; index += 1) {
    triangles.push([vertices[index], vertices[index + 1], vertices[index + 2]]);
  }
  return triangles;
}

export function boundingBox(vertices) {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };
}

/**
 * Scale and offset that centre the shell's bounding box on the canvas. The spiral is not
 * symmetric about the pole it is drawn around, so the pole is not the middle of the figure
 * and the original's centred pole left the shell high and to the right.
 */
export function fitToCanvas(vertices, width, height, fillRatio) {
  const box = boundingBox(vertices);
  const figureWidth = box.right - box.left;
  const figureHeight = box.bottom - box.top;
  const scale = fillRatio * Math.min(width / figureWidth, height / figureHeight);
  return {
    scale,
    offsetX: width / 2 - scale * (box.left + box.right) / 2,
    offsetY: height / 2 - scale * (box.top + box.bottom) / 2
  };
}

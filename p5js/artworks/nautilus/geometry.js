// The Processing sketch drew squares of side r for r running from 200 down to 0 on a
// 600 px canvas. Every constant here is expressed against a start radius of 1 instead,
// so the same figure can be fitted to any canvas without changing its proportions.
const START_RADIUS = 1;
const MINIMUM_STEP = 0.1 / 200;
const MAXIMUM_STEP = 5 / 200;

/** Ten degrees clockwise in model space, which reads as counter-clockwise on screen. */
export const ROTATION_STEP = -Math.PI / 18;

/**
 * How much the radius shrinks before the next square. Large squares step by the full
 * MAXIMUM_STEP and the step eases down to MINIMUM_STEP at the centre, which is what makes
 * the turns crowd together into a shell rather than a plain spiral.
 */
export function shrinkStep(radius) {
  return MINIMUM_STEP + (MAXIMUM_STEP - MINIMUM_STEP) * (radius / START_RADIUS);
}

function rotate(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  };
}

/**
 * One square anchored at the origin, reaching right and up before rotation — the corner
 * placement `rect(0, 0, r, -r)` produces in Processing's default CORNER mode.
 */
export function squareAt(radius, angle) {
  return [
    { x: 0, y: 0 },
    { x: radius, y: 0 },
    { x: radius, y: -radius },
    { x: 0, y: -radius }
  ].map((corner) => rotate(corner, angle));
}

/** Every square of the shell, largest first, in the order the original drew them. */
export function buildSquares() {
  const squares = [];
  let angle = 0;
  for (let radius = START_RADIUS; radius > 0; radius -= shrinkStep(radius)) {
    squares.push(squareAt(radius, angle));
    angle += ROTATION_STEP;
  }
  return squares;
}

export function boundingBox(squares) {
  const corners = squares.flat();
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };
}

/**
 * Scale and offset that put the shell's bounding box in the middle of the canvas, filling
 * `fillRatio` of the shorter side. Every square shares one anchor at the origin, so the
 * anchor is nowhere near the centre of the figure and the offset has to be measured.
 */
export function fitToCanvas(squares, width, height, fillRatio) {
  const box = boundingBox(squares);
  const figureWidth = box.right - box.left;
  const figureHeight = box.bottom - box.top;
  const scale = fillRatio * Math.min(width / figureWidth, height / figureHeight);
  return {
    scale,
    offsetX: width / 2 - scale * (box.left + box.right) / 2,
    offsetY: height / 2 - scale * (box.top + box.bottom) / 2
  };
}

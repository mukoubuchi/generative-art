const FULL_TURN = Math.PI * 2;

/**
 * The point the pointer would be at on a given frame of the capture. Sweeping a full
 * circle takes the reported angle through both branches of atan2, including the jump
 * from +PI to -PI on the negative x axis, which is the behaviour the artwork explains.
 */
export function sweptPoint(frameIndex, totalFrames, radius) {
  const turn = FULL_TURN * frameIndex / totalFrames;
  return { x: radius * Math.cos(turn), y: radius * Math.sin(turn) };
}

export function polarAngle(point) {
  return Math.atan2(point.y, point.x);
}

/**
 * Dots marking the horizontal and vertical projections of the point, stepping outwards
 * from the axis exactly as the Processing loops did.
 */
export function projectionDots(point, spacing) {
  const dots = [];
  const horizontalStep = point.x > 0 ? spacing : -spacing;
  for (let x = 0; Math.abs(x) < Math.abs(point.x); x += horizontalStep) {
    dots.push({ x, y: point.y });
  }
  const verticalStep = point.y > 0 ? spacing : -spacing;
  for (let y = 0; Math.abs(y) < Math.abs(point.y); y += verticalStep) {
    dots.push({ x: point.x, y });
  }
  return dots;
}

/** Where the angle arc starts and ends; atan2 can report either sign. */
export function angleArc(angle) {
  return angle > 0 ? { start: 0, end: angle } : { start: angle, end: 0 };
}

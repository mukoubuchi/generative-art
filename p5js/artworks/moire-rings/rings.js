/**
 * Two families of concentric rings, one centred on the canvas, the other carried by the
 * pointer. Nothing in the drawing computes an interference pattern — every frame is just
 * circles — yet fringes sweep the canvas the moment the centres part: where a ring of one
 * family runs beside a ring of the other the picture lightens, where they interleave it
 * darkens, and the loci of "beside" and "between" are hyperbolas with the two centres as
 * foci, because a hyperbola is exactly the set of points whose distances to two foci
 * differ by a constant. It is two-source interference, drawn with no waves at all.
 */

/** The distance between neighbouring rings of either family, in logical units. */
export const RING_SPACING = 11;

/**
 * How many rings a family needs so that, wherever inside the canvas its centre stands,
 * its outermost ring still clears the farthest corner — the pattern must have no visible
 * outer edge, or the edge would read as part of the artwork.
 */
export function ringCount(width, height, spacing) {
  return Math.ceil(Math.hypot(width, height) / spacing);
}

/** The clip's phases, in frames: rest, slide out, one whole orbit, slide home, rest. */
const REST_OPENING = 15;
const SLIDE_OUT = 60;
const ORBIT = 180;
const SLIDE_HOME = 30;
const REST_CLOSING = 15;
export const SCENARIO_FRAMES = REST_OPENING + SLIDE_OUT + ORBIT + SLIDE_HOME + REST_CLOSING;

/** How far from the shared centre the wandering centre travels, in logical units. */
export const ORBIT_RADIUS = 110;

function eased(linear) {
  return linear * linear * (3 - 2 * linear);
}

/**
 * Where the wandering centre stands on a given frame — the whole clip as one pure
 * function. It rests where the fixed centre is, so the clip opens and closes on the one
 * position where the two families coincide and the fringes vanish: the pattern is shown
 * being born from nothing and returning to it.
 */
export function scenarioCenter(frameIndex, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const frame = Math.max(0, Math.min(frameIndex, SCENARIO_FRAMES - 1));

  if (frame < REST_OPENING) {
    return { x: centerX, y: centerY, resting: true };
  }
  if (frame < REST_OPENING + SLIDE_OUT) {
    const t = eased((frame - REST_OPENING + 1) / SLIDE_OUT);
    return { x: centerX + ORBIT_RADIUS * t, y: centerY, resting: false };
  }
  if (frame < REST_OPENING + SLIDE_OUT + ORBIT) {
    const t = (frame - REST_OPENING - SLIDE_OUT) / ORBIT;
    const angle = t * 2 * Math.PI;
    return {
      x: centerX + ORBIT_RADIUS * Math.cos(angle),
      y: centerY + ORBIT_RADIUS * Math.sin(angle),
      resting: false
    };
  }
  if (frame < SCENARIO_FRAMES - REST_CLOSING) {
    const t = eased((frame - REST_OPENING - SLIDE_OUT - ORBIT + 1) / SLIDE_HOME);
    return { x: centerX + ORBIT_RADIUS * (1 - t), y: centerY, resting: false };
  }
  return { x: centerX, y: centerY, resting: true };
}

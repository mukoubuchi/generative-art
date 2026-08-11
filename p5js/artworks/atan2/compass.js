/**
 * One question asked from everywhere: which way is the point?
 *
 * Every needle on the grid answers with atan2 — the direction from its own foot to the
 * probe — and wears its answer as colour: gold for positive angles, steel for negative,
 * deeper the further the answer stands from zero. The two families meet twice, and
 * differently, and that difference is the artwork. At zero the answer crosses smoothly
 * and the colours meet in a shared neutral; at half a turn the answer jumps from +PI to
 * -PI, full gold against full steel, and the break is not scattered anywhere in the
 * plane but lies exactly on one ray: the points due east of the probe, the only
 * direction whose answer cannot decide its sign. Move the probe and the seam sweeps
 * with it. Nothing computes the seam; every needle answers alone, and the line is where
 * their answers disagree.
 */

const FULL_TURN = Math.PI * 2;

/** The direction from a needle's foot to the probe, as atan2 reports it: in (-PI, PI]. */
export function needleAngle(foot, probe) {
  return Math.atan2(probe.y - foot.y, probe.x - foot.x);
}

/**
 * The lattice the needles stand on, centred on the origin. Counts are forced odd so
 * that one needle stands exactly at the centre — the artwork's original single point
 * of view remains a citizen of the field, not an ornament above it.
 */
export function needleGrid(width, height, spacing, margin) {
  const half = (count) => (count - 1) / 2;
  const columns = 2 * Math.floor((width / 2 - margin) / spacing) + 1;
  const rows = 2 * Math.floor((height / 2 - margin) / spacing) + 1;
  const feet = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      feet.push({
        x: (column - half(columns)) * spacing,
        y: (row - half(rows)) * spacing
      });
    }
  }
  return feet;
}

/**
 * An answer worn as colour, in pure terms: which family, and how deep into it. The
 * strength is |angle| / PI — zero at the smooth meeting of the families, one at the
 * seam where they collide at full depth from both sides.
 */
export function angleTone(angle) {
  return {
    family: angle > 0 ? "gold" : angle < 0 ? "steel" : "zero",
    strength: Math.abs(angle) / Math.PI
  };
}

/**
 * The probe's position on a given frame of the capture: one full orbit of the centre
 * over the whole clip, so the seam is carried once across every row it can reach and
 * the last frame hands back to the first.
 */
export function orbitPoint(frameIndex, totalFrames, radius) {
  const turn = FULL_TURN * frameIndex / totalFrames;
  return { x: radius * Math.cos(turn), y: radius * Math.sin(turn) };
}

/**
 * Both legs of the journey the centre needle's answer divides: first along x, then
 * along y. The right angle between them is the whole of what atan2 is handed.
 */
export function centreLegs(probe) {
  return {
    horizontal: { from: { x: 0, y: 0 }, to: { x: probe.x, y: 0 } },
    vertical: { from: { x: probe.x, y: 0 }, to: { x: probe.x, y: probe.y } }
  };
}

/** Where the centre's angle arc runs; atan2 reports either sign. */
export function angleArc(angle) {
  return angle > 0 ? { start: 0, end: angle } : { start: angle, end: 0 };
}

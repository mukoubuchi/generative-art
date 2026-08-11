/**
 * The café wall, taken apart parameter by parameter.
 *
 * Rows of alternating dark and light tiles are separated by thin mortar lines. The
 * courses are exactly horizontal and never stop being so — yet when alternate rows are
 * shifted by about half a tile AND the mortar's luminance sits between the tiles', the
 * lines appear to tilt into wedges. Both conditions are necessary, and the clip kills
 * each one in turn while holding the other: sliding the offset on to a full tile turns
 * the wall into a checkerboard and the illusion dies by symmetry; lightening the mortar
 * to match the light tiles kills it with the geometry untouched.
 *
 * Everything here is the schedule and the layout — pure functions of the frame — and
 * the one fact the illusion lies about is stated where the rows are made: a course's y
 * depends on its row index and nothing else.
 */

/** Tiles are alternately dark and light, so the pattern repeats every two tiles. */
export const PATTERN_PERIOD = 2;

/** The clip's phases, in frames. Offsets are in tiles; mortar blend runs 0 to 1. */
const PHASES = [
  { frames: 20, kind: "hold", offset: 0, mortar: 0 },
  { frames: 50, kind: "offset", from: 0, to: 0.5, mortar: 0 },
  { frames: 30, kind: "hold", offset: 0.5, mortar: 0 },
  { frames: 45, kind: "mortar", offset: 0.5, from: 0, to: 1 },
  { frames: 45, kind: "mortar", offset: 0.5, from: 1, to: 0 },
  { frames: 25, kind: "hold", offset: 0.5, mortar: 0 },
  // On through the checkerboard at a whole tile — where the illusion dies with the
  // mortar untouched — and out the far side to two tiles, which the two-tile pattern
  // cannot tell from zero: the loop closes.
  { frames: 75, kind: "offset", from: 0.5, to: 2, mortar: 0 },
  { frames: 10, kind: "hold", offset: 2, mortar: 0 }
];

export const TOTAL_FRAMES = PHASES.reduce((sum, phase) => sum + phase.frames, 0);

function eased(linear) {
  return linear * linear * (3 - 2 * linear);
}

/**
 * What the wall looks like on a given frame: how far the odd rows are slid, in tiles,
 * and how far the mortar has been lightened out of the courses (0 mid-grey, 1 gone).
 */
export function wallState(frameIndex) {
  let remaining = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  for (const phase of PHASES) {
    if (remaining >= phase.frames) {
      remaining -= phase.frames;
      continue;
    }
    const t = eased((remaining + 1) / phase.frames);
    if (phase.kind === "hold") {
      return { offsetTiles: phase.offset, mortarBlend: phase.mortar };
    }
    if (phase.kind === "offset") {
      return { offsetTiles: phase.from + (phase.to - phase.from) * t, mortarBlend: phase.mortar };
    }
    return { offsetTiles: phase.offset, mortarBlend: phase.from + (phase.to - phase.from) * t };
  }
  throw new Error(`Frame ${frameIndex} fell out of the schedule.`);
}

/** The sideways shift of a row, in tiles: even courses stand still, odd ones slide. */
export function rowShift(rowIndex, offsetTiles) {
  return rowIndex % 2 === 0 ? 0 : offsetTiles;
}

/**
 * The courses of a wall of `rows` rows of square tiles, as horizontal bands: each with
 * the y of its top edge and its height, in tiles. The mortar sits between them. That y
 * is a function of the row index alone — never of the offset, never of the frame — is
 * the truth the illusion will spend the clip denying.
 */
export function courses(rows, mortarTiles) {
  const bands = [];
  for (let row = 0; row < rows; row += 1) {
    bands.push({ row, top: row * (1 + mortarTiles), height: 1 });
  }
  return bands;
}

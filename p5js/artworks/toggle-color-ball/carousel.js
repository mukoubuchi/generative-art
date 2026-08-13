/**
 * Four discs on a ring, turning. Which one is in front is not written down anywhere:
 * it is asked of their depths, every frame, and the answer changes when two of them
 * are equally far away. The Processing sketch kept a table — the front went 0, 1, 3, 2
 * by quarters — and a table is a claim nobody can check. A ring can be checked, and
 * the handover turns out to happen at exactly forty-five degrees past each quarter,
 * which this module lets a caller find rather than state.
 *
 * The discs alternate around the ring, so whatever comes forward is the opposite kind
 * to what came forward last. That alternation is the artwork's sentence from the Book
 * of Changes, and it is a consequence of the arrangement rather than a decision taken
 * once per quarter.
 */

export const DISC_COUNT = 4;
/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
/** One whole turn of the ring, which is the clip: ten seconds. */
export const TURN_STEPS = 600;

const FULL_TURN = Math.PI * 2;

/**
 * How far the ring is leaned back from edge-on. At zero the four discs would slide
 * along a single line; a little lean opens their path into an ellipse, which is what
 * makes the near ones read as near before the sizes are even compared.
 */
export const RING_TILT = (40 * Math.PI) / 180;
/**
 * The eye's distance from the ring's centre, in ring radii. It sets how much bigger a
 * disc looks in front than behind: at three and a half radii, two fifths larger in
 * front against a fifth smaller behind, which is enough for the eye to read depth
 * from size alone before anything overlaps.
 */
export const EYE_DISTANCE = 3.4;

/** Where disc `index` stands on the ring at `turns` of the whole turn, in radians. */
export function ringAngle(index, turns) {
  return FULL_TURN * (turns + index / DISC_COUNT);
}

/**
 * How near disc `index` is at `turns`, in ring radii: positive towards the eye. This
 * is the only thing that decides what covers what.
 */
export function discDepth(index, turns) {
  return Math.sin(ringAngle(index, turns)) * Math.cos(RING_TILT);
}

/** Where the disc lands on the canvas, and how large the distance makes it look. */
export function discPlace(index, turns, ringRadius) {
  const angle = ringAngle(index, turns);
  const depth = discDepth(index, turns);
  const scale = EYE_DISTANCE / (EYE_DISTANCE - depth);
  return {
    // Nearer is lower on the canvas, as it is when you look down at a turning thing.
    x: ringRadius * Math.cos(angle) * scale,
    y: ringRadius * Math.sin(angle) * Math.sin(RING_TILT) * scale,
    depth,
    scale
  };
}

/** The discs, furthest first, which is the order they have to be painted in. */
export function paintingOrder(turns) {
  return Array.from({ length: DISC_COUNT }, (unused, index) => index)
    .sort((first, second) => discDepth(first, turns) - discDepth(second, turns));
}

/** Which disc is nearest the eye at `turns` — asked, not looked up. */
export function frontDisc(turns) {
  return paintingOrder(turns).at(-1);
}

/**
 * Where the front changes hands, found rather than declared: walk the turn, notice
 * where the nearest disc stops being the same disc, and bisect that bracket until the
 * crossing is pinned to floating-point width. The tests hold the answers this returns
 * against the quarter-plus-an-eighth the geometry implies.
 */
export function handoverTurns(samples = 4000, refinements = 60) {
  const crossings = [];
  let previous = frontDisc(0);
  for (let sample = 1; sample <= samples; sample += 1) {
    const turns = sample / samples;
    const current = frontDisc(turns);
    if (current !== previous) {
      let low = (sample - 1) / samples;
      let high = turns;
      for (let refinement = 0; refinement < refinements; refinement += 1) {
        const middle = (low + high) / 2;
        if (frontDisc(middle) === previous) {
          low = middle;
        } else {
          high = middle;
        }
      }
      crossings.push((low + high) / 2);
      previous = current;
    }
  }
  return crossings;
}

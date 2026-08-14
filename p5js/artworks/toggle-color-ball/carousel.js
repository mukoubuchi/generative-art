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
 * The ring and the discs, as fractions of the canvas's shorter side — which on the
 * canvas they are drawn at is six hundred, so these are also their sizes in pixels. The
 * Processing sketch swung by 200 on a 600 px canvas and drew discs of 280, so the discs
 * were larger than their own swing and ran past the canvas edge. These keep that
 * crowding, which is what makes the order they are painted in the whole subject.
 *
 * How crowded is settled by one comparison. The nearest disc and the furthest sit at
 * opposite ends of the ring, so they meet only if a disc's radius beats the ring's own
 * half-height, which perspective leaves the same for both of them:
 *
 *   disc radius > ring radius * sin(lean)
 *
 * At a lean of forty-eight degrees that wants a radius over 0.743 of the ring, and 136
 * against 160 gives it with room to spare. It failed before, by four pixels, which is
 * why the two ends of the ring had come apart.
 *
 * They live here rather than in the sketch because what the figure covers is a question
 * about the ring, and the tests have to be able to ask it of the same numbers the page
 * draws with.
 */
export const RING_RADIUS_RATIO = 160 / 600;
export const DISC_DIAMETER_RATIO = 272 / 600;

/**
 * How far the ring is leaned back from edge-on. At zero the four discs would slide
 * along a single line; a lean opens their path into an ellipse, which is what makes the
 * near ones read as near before the sizes are even compared.
 */
export const RING_TILT = (48 * Math.PI) / 180;
/**
 * The eye's distance from the ring's centre, in ring radii. It sets how much bigger a
 * disc looks in front than behind: at three radii, a little under three tenths larger
 * in front against a fifth smaller behind, which is enough for the eye to read depth
 * from size alone before anything overlaps.
 *
 * It is short here because the lean is steep. Leaning the ring further opens the
 * ellipse but shortens the depth it swings through — the depth carries a cosine of the
 * lean — so the sizes would have drawn together as the path opened. Bringing the eye in
 * from 3.4 radii to 3 gives that back: near and far stand in the same ratio they did at
 * the shallower lean, and the steepening is all in the perspective.
 */
export const EYE_DISTANCE = 3;

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

/**
 * The lowest and highest a disc's edge reaches over a whole turn, measured from the
 * ring's centre.
 *
 * Both extremes belong to the near and the far point of the ring. A disc goes lower on
 * the canvas as it comes forward and the distance draws it larger at the same time, so
 * the two effects pull the same way and the lowest edge is the near disc's bottom; the
 * far point is the same argument reversed. The tests hold that against every disc at
 * every step of the clip rather than taking it on the reasoning.
 */
export function sweptBounds(ringRadius, discRadius) {
  const near = discPlace(0, 0.25, ringRadius);
  const far = discPlace(0, 0.75, ringRadius);
  return {
    top: far.y - discRadius * far.scale,
    bottom: near.y + discRadius * near.scale
  };
}

/**
 * How far below the ring's centre the swept figure's own middle falls.
 *
 * Perspective is not symmetric: the near half of the ring is magnified and the far half
 * shrunk, so a ring drawn about the centre of the canvas hangs below it — by enough,
 * before this, for the near disc to run off the bottom edge while a band of empty paper
 * stood at the top. Drawing the ring this much higher puts the figure in the middle of
 * the frame without touching any of the geometry that makes it lean.
 */
export function sweptCentreY(ringRadius, discRadius) {
  const { top, bottom } = sweptBounds(ringRadius, discRadius);
  return (top + bottom) / 2;
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

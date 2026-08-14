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

/**
 * A disc as a ball, in the terms the drawing itself uses.
 *
 * The sketch does not draw a sphere's true outline: it draws a circle at the projected
 * centre, widened by the perspective the same way any length at that depth is widened.
 * The true silhouette of a ball this close would sit twenty pixels wider and further out,
 * and the artwork has always been the simpler figure. So the ball this returns is the one
 * the reader is actually looking at — the circle on the canvas, taken as a ball's outline
 * — and its depth is put in the same magnified units, because everything at that depth is
 * magnified alike. Nothing about the drawn circle changes; this only gives it a surface.
 */
export function ballAt(index, turns, ringRadius, discRadius) {
  const { x, y, depth, scale } = discPlace(index, turns, ringRadius);
  return { x, y, radius: discRadius * scale, height: depth * ringRadius * scale };
}

/**
 * How near a ball's surface comes at a point of the canvas — larger is nearer the eye —
 * or minus infinity where the ball is not there at all.
 */
export function surfaceHeight(ball, point) {
  const reach = ball.radius * ball.radius
    - ((point.x - ball.x) ** 2 + (point.y - ball.y) ** 2);
  return reach < 0 ? -Infinity : ball.height + Math.sqrt(reach);
}

/**
 * Where two balls pass through one another, if they do: a circle, and the boundary
 * between the two colours is its shadow on the canvas.
 *
 * They always do, and that is not a fault to be tuned out — it is what crowding the ring
 * means. A disc shows past the far one only if its radius beats the ring's own
 * half-height, which wants more than 118.9 here; two neighbours' circles stand 268.6
 * apart at the moment they are equally far away, so they would clear each other only at
 * 113.2 or less. No radius both crowds the ring and leaves the balls apart, so the jump a
 * reader photographed is the crowding itself: flat discs cannot draw two things passing
 * through each other, and the whole overlap has to change hands at once.
 *
 * Where the two are equally far away the circle stands edge-on and its shadow is the
 * straight line halfway between the centres; as one draws ahead the circle turns and the
 * shadow opens out and sweeps clear. That is the sweep, and it takes about a second and a
 * third. Returns null when the two do not reach each other.
 */
export function meetingCircle(first, second) {
  const apart = Math.hypot(
    second.x - first.x,
    second.y - first.y,
    second.height - first.height
  );
  if (apart >= first.radius + second.radius || apart <= Math.abs(first.radius - second.radius)) {
    return null;
  }
  // The radical plane: how far along the line of centres the two surfaces meet.
  const along = (apart * apart + first.radius ** 2 - second.radius ** 2) / (2 * apart);
  return {
    centre: {
      x: first.x + ((second.x - first.x) * along) / apart,
      y: first.y + ((second.y - first.y) * along) / apart,
      height: first.height + ((second.height - first.height) * along) / apart
    },
    radius: Math.sqrt(Math.max(first.radius ** 2 - along * along, 0)),
    apart
  };
}

/** Whether ball `here` is the one a reader sees at `point`, of the two. */
function nearerAt(here, there, point) {
  return surfaceHeight(here, point) > surfaceHeight(there, point);
}

/**
 * The line on the canvas where ball `index` stops being the one in front of ball `other`,
 * as a run of points crossing the whole figure.
 *
 * It is found rather than derived. Rows are laid across the two balls at right angles to
 * the line joining them, and along each row the two surfaces are asked which is nearer;
 * where the answer changes, the crossing is bisected to a hundredth of a pixel. What
 * comes back is exact in the only sense that matters — every point on it is a point where
 * the reader would see the two balls' surfaces at the same distance — and it is the same
 * comparison the reader's eye makes rather than a formula standing in for it.
 *
 * In space the crossing points all lie on the balls' meeting circle, which is what makes
 * the boundary a curve that sweeps rather than a lens that changes hands: the circle is
 * fixed to the pair and turns with them, and its projection opens continuously from a
 * straight line at the moment the two are equally far away. The tests hold that.
 *
 * Rows where one ball wins outright get the boundary pushed off the end, so the run is a
 * single unbroken line from one side of the figure to the other and can be closed into a
 * region. Returns null when the two do not overlap at all.
 */
/** How far past the figure the cut region is closed off, in pixels. */
const OFF_THE_CANVAS = 4000;
/** How far inside the other ball's outline a cut stops, so no paper can show through. */
const SEAM_BIAS = 1;

export function coveringEdge(here, there, rows = 96) {
  const apart = Math.hypot(here.x - there.x, here.y - there.y);
  if (apart >= here.radius + there.radius || apart === 0) {
    return null;
  }
  // Along the line joining them, and across it. Positive `along` is towards `here`.
  const along = { x: (here.x - there.x) / apart, y: (here.y - there.y) / apart };
  const across = { x: -along.y, y: along.x };
  const span = here.radius + apart;
  const at = (forward, sideways) => ({
    x: there.x + along.x * forward + across.x * sideways,
    y: there.y + along.y * forward + across.y * sideways
  });

  const crossings = [];
  for (let row = 0; row <= rows; row += 1) {
    const sideways = -span + (2 * span * row) / rows;
    // The search stays inside the ball being drawn: outside it there is nothing to cover.
    // A hair inside, in fact -- asked exactly on the outline, whether the ball is there at
    // all comes down to the last bit of a square root, and a row can come back saying the
    // ball is nowhere when it is simply standing at its own edge.
    const reach = here.radius * here.radius - sideways * sideways;
    if (reach <= 0) {
      continue;
    }
    const half = Math.sqrt(reach) * (1 - 1e-9);
    if (nearerAt(here, there, at(apart - half, sideways))) {
      // This ball is in front from its own near edge onwards: nothing of it is covered
      // along this row, so the row contributes nothing to cut away.
      continue;
    }
    let low = apart - half;
    let high = apart + half;
    for (let refinement = 0; refinement < 30; refinement += 1) {
      const middle = (low + high) / 2;
      if (nearerAt(here, there, at(middle, sideways))) {
        high = middle;
      } else {
        low = middle;
      }
    }
    const forward = (low + high) / 2;
    const point = at(forward, sideways);
    // Two quite different things can end the cut along a row. Either the surfaces really
    // do come to the same height -- the balls passing through one another, and the point
    // stands on the circle they share -- or one of the two outlines is reached, and the
    // answer changes because a ball stops rather than because it is overtaken. Which it
    // is has to be asked of the bracket rather than of the point: near an outline a
    // surface climbs like a square root, so at a true crossing that happens to fall close
    // to one, the two heights can still be far apart a millionth of a pixel to either
    // side. Both balls present on both sides of the bracket means they crossed.
    const meets = [low, high].every((edge) => [here, there].every(
      (ball) => Number.isFinite(surfaceHeight(ball, at(edge, sideways)))
    ));
    if (meets) {
      crossings.push({ ...point, meets });
      continue;
    }
    // Where the cut ends on the other ball's own outline, it is nudged a pixel inside it.
    // Both are painted, so the far ball's edge is antialiased against the paper it was
    // laid on, and a cut landing exactly there would ask two half-covered pixels to add
    // up to one -- which is how a hairline of paper appears between two things that meet
    // exactly. This one is covered instead, by the ball painted second.
    crossings.push({ ...at(forward - SEAM_BIAS, sideways), meets });
  }
  if (crossings.length < 2) {
    return null;
  }
  return { crossings, along, across };
}

/**
 * The part of `here` that `there` stands in front of, as one closed shape.
 *
 * The far side of it is the crossing run — the real boundary, and the only edge of this
 * shape that lands anywhere near the drawing. The rest is closed off well outside the
 * canvas, on the far ball's side, where cutting costs nothing: past the crossing there is
 * nothing of `here` left to cut, and no row was ever found in which the far ball covered
 * this one outright, so the shape never has to reach round anything.
 */
export function coveringRegion(here, there, rows = 96) {
  const edge = coveringEdge(here, there, rows);
  if (edge === null) {
    return null;
  }
  const { crossings, along } = edge;
  const back = (point) => ({
    x: point.x - along.x * OFF_THE_CANVAS,
    y: point.y - along.y * OFF_THE_CANVAS
  });
  return [...crossings, back(crossings.at(-1)), back(crossings[0])];
}

/** Whether a point falls inside a closed shape, by the crossing count. */
export function insideRegion(region, point) {
  let inside = false;
  for (let index = 0, last = region.length - 1; index < region.length; last = index, index += 1) {
    const from = region[last];
    const to = region[index];
    if ((to.y > point.y) !== (from.y > point.y)) {
      const crossing = from.x + ((point.y - to.y) / (from.y - to.y)) * (to.x - from.x);
      if (point.x < crossing) {
        inside = !inside;
      }
    }
  }
  return inside;
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

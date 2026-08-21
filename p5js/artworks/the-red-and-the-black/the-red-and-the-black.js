/**
 * Two roads written as the order they are painted in, and nothing else.
 *
 * Everything here lives in a unit disc centred on the origin. Two lobes of half the
 * radius sit on the horizontal diameter, each tangent to the rim from inside and tangent
 * to the other at the centre; the arc of one and the arc of the other are the S that
 * divides the disc. Each lobe carries an eye of the road opposite to its own.
 *
 * `PAINTING_ORDER` is the whole definition. `classify` folds it — later steps cover
 * earlier ones — and the sketch draws the same list, so the picture cannot drift away
 * from the rule that decides what the picture means.
 *
 * The figure's two claims are both exact, and both fall out of the list rather than being
 * imposed on it:
 *
 *   - the two roads have the same area, one half of the disc each. Neither is the greater
 *     one. The lower half of the red lobe is taken from the black side and the upper half
 *     of the black lobe is given back to it, and those two half-lobes are congruent; the
 *     eyes trade a disc of the same radius in each direction, so they cancel as well.
 *   - a half turn about the centre, with the two roads exchanged, returns the figure
 *     unchanged. Under (x, y) -> (-x, -y) the two lobes swap, the two eyes swap, and the
 *     upper half of the disc becomes the lower. The one point the half turn cannot move
 *     is the centre, and the centre is where the dividing curve crosses itself.
 *
 * The swap is exact in floating point, not merely close: negation is exact in IEEE-754
 * and addition is symmetric about zero, so the distance a point has to the red lobe is
 * bit-for-bit the distance its antipode has to the black one.
 */

export const OUTER_RADIUS = 1;
export const LOBE_RADIUS = OUTER_RADIUS / 2;
export const EYE_RADIUS = OUTER_RADIUS / 6;

export const RED = "red";
export const BLACK = "black";
export const OUTSIDE = "outside";

export const DISC = "disc";
export const UPPER_HALF_DISC = "upperHalfDisc";

/** The red lobe lies left of the centre, the black lobe right of it. */
export const RED_LOBE = { x: -LOBE_RADIUS, y: 0 };
export const BLACK_LOBE = { x: LOBE_RADIUS, y: 0 };
const CENTRE = { x: 0, y: 0 };

/**
 * Lay the disc down black, give its upper half to the red, let each lobe carry its own
 * road across the diameter, and drop into each lobe an eye of the other road: what a man
 * on one road keeps hidden of the other.
 */
export const PAINTING_ORDER = [
  { shape: DISC, centre: CENTRE, radius: OUTER_RADIUS, road: BLACK, includesBoundary: true },
  { shape: UPPER_HALF_DISC, centre: CENTRE, radius: OUTER_RADIUS, road: RED, includesBoundary: true },
  { shape: DISC, centre: RED_LOBE, radius: LOBE_RADIUS, road: RED, includesBoundary: false },
  { shape: DISC, centre: BLACK_LOBE, radius: LOBE_RADIUS, road: BLACK, includesBoundary: false },
  { shape: DISC, centre: RED_LOBE, radius: EYE_RADIUS, road: BLACK, includesBoundary: false },
  { shape: DISC, centre: BLACK_LOBE, radius: EYE_RADIUS, road: RED, includesBoundary: false }
];

/**
 * The three points of the disc where the dividing curve meets itself or the rim: the two
 * ends of the S and the centre it crosses at. They are the only points whose road is not
 * the opposite of their antipode's, because they are the points that lie on the boundary
 * between the roads rather than on either one.
 */
export const CURVE_ENDPOINTS = [
  { x: -OUTER_RADIUS, y: 0 },
  { x: 0, y: 0 },
  { x: OUTER_RADIUS, y: 0 }
];

export function otherRoad(road) {
  if (road === RED) {
    return BLACK;
  }
  if (road === BLACK) {
    return RED;
  }
  throw new RangeError(`${road} is not a road of the figure`);
}

/**
 * The colours the two roads are painted in: a glossy crimson and a lacquer black. Inside
 * the disc there are these two and nothing else, because a third colour there would be a
 * third road.
 *
 * The ground outside the disc is a separate family, declared here beside the roads so
 * that the distance between them can be measured rather than described. Nothing the
 * ground can take is as red as the crimson or as dark as the lacquer black.
 */
export const ROAD_COLOUR = {
  [RED]: [152, 16, 30],
  [BLACK]: [15, 10, 12]
};

export const GROUND = [20, 19, 22];

/**
 * The world the disc stands in: the crowd of it, with nobody in it. Not bodies but a
 * haze, gathered about the figure and thinning to nothing before the corners, so that
 * the many are present as a mass and not one of them is worth looking at.
 *
 * It is written as the stops of a gradient run between two circles about the centre of
 * the disc: the inner one a little inside the rim, where the haze is thickest and is
 * covered by the figure anyway, the outer one past the corners of the page. Holding it
 * here rather than in the sketch is what lets the whole family of colours the ground can
 * take be measured against the two roads instead of described in a sentence.
 */
export const HAZE_INNER_IN_DISCS = 0.9;
export const HAZE_OUTER_IN_WIDTHS = 0.72;
export const HAZE_STOPS = [
  { at: 0, colour: [78, 82, 92], alpha: 0.3 },
  { at: 0.55, colour: [52, 54, 62], alpha: 0.16 },
  { at: 1, colour: [20, 19, 22], alpha: 0 }
];

/**
 * The colour the ground actually takes at one place along the haze, which is the haze
 * laid over the ground rather than either of them alone. `at` runs from 0 at the inner
 * circle to 1 at the outer one. Colour and alpha are carried straight, not premultiplied,
 * which is how the canvas was measured to interpolate them: the model and the render
 * agree to about a tenth of one level out of 255.
 */
export function hazeOver(at) {
  if (!(at >= 0 && at <= 1)) {
    throw new RangeError(`${at} is outside the haze`);
  }
  for (let index = 0; index + 1 < HAZE_STOPS.length; index += 1) {
    const lower = HAZE_STOPS[index];
    const upper = HAZE_STOPS[index + 1];
    if (at < lower.at || at > upper.at) {
      continue;
    }
    const along = (at - lower.at) / (upper.at - lower.at);
    const alpha = lower.alpha + along * (upper.alpha - lower.alpha);
    return GROUND.map((ground, channel) => {
      const laid = lower.colour[channel] + along * (upper.colour[channel] - lower.colour[channel]);
      return laid * alpha + ground * (1 - alpha);
    });
  }
  throw new RangeError(`the haze has no stop pair around ${at}`);
}

/** The rotation the figure is asked to survive: a half turn about the centre. */
export function halfTurn(point) {
  return { x: -point.x, y: -point.y };
}

/**
 * Whether one painted step reaches a point. The rim is closed and the lobes are open, so
 * a point on the dividing curve belongs to whichever lobe was laid down last — which is
 * the same rule a renderer follows when two fills share an edge.
 */
function covers(step, x, y) {
  const acrossX = x - step.centre.x;
  const acrossY = y - step.centre.y;
  const square = acrossX * acrossX + acrossY * acrossY;
  const limit = step.radius * step.radius;
  const within = step.includesBoundary ? square <= limit : square < limit;
  return step.shape === UPPER_HALF_DISC ? within && y > 0 : within;
}

/** Which road covers a point once the whole list has been laid down. */
export function classify(x, y) {
  let road = OUTSIDE;
  for (const step of PAINTING_ORDER) {
    if (covers(step, x, y)) {
      road = step.road;
    }
  }
  return road;
}

/** What each road measures, from the geometry rather than from a count of pixels. */
export function exactRegionArea() {
  return (Math.PI * OUTER_RADIUS * OUTER_RADIUS) / 2;
}

/**
 * The same two areas counted off the painted rule, so the claim above is checked against
 * the figure instead of against itself. An even number of samples a side puts every cell
 * centre off both axes, which keeps the count away from the dividing curve.
 */
export function measureAreas(samplesPerSide) {
  if (!Number.isInteger(samplesPerSide) || samplesPerSide <= 0 || samplesPerSide % 2 !== 0) {
    throw new RangeError("samplesPerSide must be a positive even integer");
  }
  const step = (2 * OUTER_RADIUS) / samplesPerSide;
  const cellArea = step * step;
  const counts = { [RED]: 0, [BLACK]: 0, [OUTSIDE]: 0 };
  for (let row = 0; row < samplesPerSide; row += 1) {
    const y = -OUTER_RADIUS + (row + 0.5) * step;
    for (let column = 0; column < samplesPerSide; column += 1) {
      const x = -OUTER_RADIUS + (column + 0.5) * step;
      counts[classify(x, y)] += 1;
    }
  }
  return {
    red: counts[RED] * cellArea,
    black: counts[BLACK] * cellArea,
    samples: samplesPerSide * samplesPerSide
  };
}

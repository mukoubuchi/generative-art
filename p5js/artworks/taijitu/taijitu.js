/**
 * The Taijitu written as the order it is painted in, and nothing else.
 *
 * Everything here lives in a unit disc centred on the origin. Two lobes of half the
 * radius sit on the horizontal diameter, each tangent to the rim from inside and tangent
 * to the other at the centre; the arc of one and the arc of the other are the S that
 * divides the disc. Each lobe carries an eye of the shade opposite to its own.
 *
 * `PAINTING_ORDER` is the whole definition. `classify` folds it — later steps cover
 * earlier ones — and the sketch draws the same list, so the picture cannot drift away
 * from the rule that decides what the picture means.
 *
 * The figure's two claims are both exact, and both fall out of the list rather than being
 * imposed on it:
 *
 *   - the two regions have the same area, one half of the disc each. The lower half of
 *     the light lobe is taken from the dark side and the upper half of the dark lobe is
 *     given back to it, and those two half-lobes are congruent; the eyes trade a disc of
 *     the same radius in each direction, so they cancel as well.
 *   - a half turn about the centre, with the two shades exchanged, returns the figure
 *     unchanged. Under (x, y) -> (-x, -y) the two lobes swap, the two eyes swap, and the
 *     upper half of the disc becomes the lower. The one point the half turn cannot move
 *     is the centre, and the centre is where the dividing curve crosses itself.
 *
 * The swap is exact in floating point, not merely close: negation is exact in IEEE-754
 * and addition is symmetric about zero, so the distance a point has to the light lobe is
 * bit-for-bit the distance its antipode has to the dark one.
 */

export const OUTER_RADIUS = 1;
export const LOBE_RADIUS = OUTER_RADIUS / 2;
export const EYE_RADIUS = OUTER_RADIUS / 6;

export const LIGHT = "light";
export const DARK = "dark";
export const OUTSIDE = "outside";

export const DISC = "disc";
export const UPPER_HALF_DISC = "upperHalfDisc";

/** The light lobe lies left of the centre, the dark lobe right of it. */
export const LIGHT_LOBE = { x: -LOBE_RADIUS, y: 0 };
export const DARK_LOBE = { x: LOBE_RADIUS, y: 0 };
const CENTRE = { x: 0, y: 0 };

/**
 * Lay the disc down dark, give its upper half to the light, let each lobe carry its own
 * shade across the diameter, and drop into each lobe an eye of the other shade.
 */
export const PAINTING_ORDER = [
  { shape: DISC, centre: CENTRE, radius: OUTER_RADIUS, shade: DARK, includesBoundary: true },
  { shape: UPPER_HALF_DISC, centre: CENTRE, radius: OUTER_RADIUS, shade: LIGHT, includesBoundary: true },
  { shape: DISC, centre: LIGHT_LOBE, radius: LOBE_RADIUS, shade: LIGHT, includesBoundary: false },
  { shape: DISC, centre: DARK_LOBE, radius: LOBE_RADIUS, shade: DARK, includesBoundary: false },
  { shape: DISC, centre: LIGHT_LOBE, radius: EYE_RADIUS, shade: DARK, includesBoundary: false },
  { shape: DISC, centre: DARK_LOBE, radius: EYE_RADIUS, shade: LIGHT, includesBoundary: false }
];

/**
 * The three points of the disc where the dividing curve meets itself or the rim: the two
 * ends of the S and the centre it crosses at. They are the only points whose shade is not
 * the opposite of their antipode's, because they are the points that lie on the boundary
 * between the shades rather than in either region.
 */
export const CURVE_ENDPOINTS = [
  { x: -OUTER_RADIUS, y: 0 },
  { x: 0, y: 0 },
  { x: OUTER_RADIUS, y: 0 }
];

export function oppositeShade(shade) {
  if (shade === LIGHT) {
    return DARK;
  }
  if (shade === DARK) {
    return LIGHT;
  }
  throw new RangeError(`${shade} is not a shade of the figure`);
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

/** Which shade covers a point once the whole list has been laid down. */
export function classify(x, y) {
  let shade = OUTSIDE;
  for (const step of PAINTING_ORDER) {
    if (covers(step, x, y)) {
      shade = step.shade;
    }
  }
  return shade;
}

/** What each region measures, from the geometry rather than from a count of pixels. */
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
  const counts = { [LIGHT]: 0, [DARK]: 0, [OUTSIDE]: 0 };
  for (let row = 0; row < samplesPerSide; row += 1) {
    const y = -OUTER_RADIUS + (row + 0.5) * step;
    for (let column = 0; column < samplesPerSide; column += 1) {
      const x = -OUTER_RADIUS + (column + 0.5) * step;
      counts[classify(x, y)] += 1;
    }
  }
  return {
    light: counts[LIGHT] * cellArea,
    dark: counts[DARK] * cellArea,
    samples: samplesPerSide * samplesPerSide
  };
}

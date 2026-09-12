/**
 * A rhumb line on the globe, and the same rhumb line on the chart that was made
 * for it.
 *
 * A course held at one bearing is not a straight line on a sphere. It cuts every
 * meridian at the same angle and so it winds: north of any latitude it turns
 * about the pole without bound, and it arrives there after a path of finite
 * length. The chart that straightens it stretches north and south by exactly the
 * amount that keeps those angles true, and the price of that is the pole. Each
 * further decimal place of latitude costs the same extra height of paper, so no
 * sheet of any size carries the point the course is winding towards.
 *
 * That exchange is the whole of this piece. Everything drawn is the same eight
 * courses at one bearing: a whirl of spirals with a blaze at each pole, then the
 * globe relaxed onto its cylinder and the cylinder unrolled, and the spirals are
 * a ruled field of parallel straight lines with the blaze nowhere on it.
 *
 * The relation between latitude and longitude along the course is
 *
 *   lambda = lambda0 + tan(bearing) * ln tan(PI/4 + phi/2)
 *
 * and the inner logarithm is the chart's own vertical coordinate, so on the chart
 * the relation is affine and the course is straight by construction.
 *
 * Coordinates are the figure's own: x across, y up, z towards the eye. The sketch
 * turns them and hands them to the rasteriser; it computes no geometry of its own.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 12;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

const DEGREE = Math.PI / 180;
export const degrees = (value) => value * DEGREE;

/** Paper around the figure, as a share of the canvas. */
export const FRAME_FILL = 0.86;

/**
 * The bearing the clip opens and closes on, and the one it sweeps down to.
 * Seventy degrees is far enough from the meridian that a course reads as a spiral
 * rather than a slant, and near enough to it that the same course on the chart is
 * unmistakably a diagonal rather than one more parallel.
 */
export const OPENING_BEARING = degrees(70);
export const UNWOUND_BEARING = degrees(20);
/**
 * The live page's limits. Nought is the meridian itself; the upper limit is short
 * of a right angle, where the course would be a parallel and would reach no pole
 * at all.
 */
export const MINIMUM_BEARING = 0;
export const MAXIMUM_BEARING = degrees(88);

/** The chart's own edge: the last latitude its grid is drawn to. */
export const CHART_EDGE_LATITUDE = degrees(85);

/** The grid. Parallels every fifteen degrees, meridians every thirty. */
export const PARALLEL_STEP = degrees(15);
export const PARALLEL_LIMIT = degrees(75);
export const MERIDIAN_STEP = degrees(30);
export const PARALLEL_SAMPLES = 180;
export const MERIDIAN_SAMPLES = 120;

/** Courses, evenly spaced round the equator. */
export const COURSES = 6;

/**
 * Isometric latitude: the chart's vertical coordinate, and the thing the course's
 * longitude is affine in.
 *
 * Written as the definition rather than as the equivalent `asinh(tan phi)`, which
 * the tests use as a second opinion on this one.
 */
export function isometricLatitude(phi) {
  if (!Number.isFinite(phi)) {
    throw new RangeError("A latitude has to be a number.");
  }
  return Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

/** The inverse, by the Gudermannian. */
export function latitudeFromIsometric(psi) {
  return 2 * Math.atan(Math.exp(psi)) - Math.PI / 2;
}

/** Where the course stands in longitude at a given height up the chart. */
export function courseLongitude(psi, bearing, origin = 0) {
  return origin + Math.tan(bearing) * psi;
}

/**
 * A point of the course on the unit sphere, in the figure's own coordinates.
 * Used by the measurements rather than by the drawing, which goes through the
 * morph below.
 */
export function spherePoint(phi, lambda) {
  return [
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(lambda)
  ];
}

/** The local east and north directions at a place on the unit sphere. */
export function eastAt(phi, lambda) {
  return [Math.cos(lambda), 0, -Math.sin(lambda)];
}

export function northAt(phi, lambda) {
  return [
    -Math.sin(phi) * Math.sin(lambda),
    Math.cos(phi),
    -Math.sin(phi) * Math.cos(lambda)
  ];
}

/**
 * The course's bearing where it crosses a parallel, measured rather than assumed.
 *
 * Two points of the course a hair either side are taken to the sphere and the chord
 * between them is resolved onto the local east and north at the place in the middle.
 * Nothing in the measurement knows that the longitude was built to be affine in the
 * chart's height; it reads an angle off three-dimensional positions. Agreement with
 * the bearing the course was built from is the claim that this is a rhumb line.
 */
export function measuredBearing(phi, bearing, origin = 0, step = 1e-6) {
  const at = (value) => spherePoint(value, courseLongitude(isometricLatitude(value), bearing, origin));
  const before = at(phi - step);
  const after = at(phi + step);
  const chord = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
  const lambda = courseLongitude(isometricLatitude(phi), bearing, origin);
  const east = eastAt(phi, lambda);
  const north = northAt(phi, lambda);
  return Math.atan2(
    chord[0] * east[0] + chord[1] * east[1] + chord[2] * east[2],
    chord[0] * north[0] + chord[1] * north[1] + chord[2] * north[2]
  );
}

/** The bearing of a great circle through two points, by the same formula. */
export function greatCircleBearing([phiA, lambdaA], [phiB, lambdaB]) {
  const delta = lambdaB - lambdaA;
  return Math.atan2(
    Math.sin(delta) * Math.cos(phiB),
    Math.cos(phiA) * Math.sin(phiB) - Math.sin(phiA) * Math.cos(phiB) * Math.cos(delta)
  );
}

/**
 * Points along the great circle between two places, as latitude and longitude.
 * The control for the course: the shorter path, whose bearing will not hold.
 */
export function greatCirclePoints(from, to, steps = 64) {
  const a = spherePoint(from[0], from[1]);
  const b = spherePoint(to[0], to[1]);
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const first = Math.sin((1 - t) * angle) / Math.sin(angle);
    const second = Math.sin(t * angle) / Math.sin(angle);
    const x = first * a[0] + second * b[0];
    const y = first * a[1] + second * b[1];
    const z = first * a[2] + second * b[2];
    points.push([Math.asin(Math.min(1, Math.max(-1, y))), Math.atan2(x, z)]);
  }
  return points;
}

/**
 * The course's length on the unit sphere between two latitudes. The speed along
 * the course is sec(bearing) per radian of latitude at every latitude, so the
 * length is that constant times the latitude travelled -- finite all the way to
 * the pole, however much winding happens on the way.
 */
export function courseLength(bearing, fromPhi, toPhi) {
  return (toPhi - fromPhi) / Math.cos(bearing);
}

/**
 * The same length measured instead: the sum of the chords of a polyline through
 * points of the course on the sphere. It knows nothing of the formula above and
 * approaches it from below as the polyline is refined.
 */
export function courseChordLength(bearing, fromPhi, toPhi, steps, origin = 0) {
  let total = 0;
  let previous = null;
  for (let index = 0; index <= steps; index += 1) {
    const phi = fromPhi + (toPhi - fromPhi) * (index / steps);
    const point = spherePoint(phi, courseLongitude(isometricLatitude(phi), bearing, origin));
    if (previous) {
      total += Math.hypot(
        point[0] - previous[0],
        point[1] - previous[1],
        point[2] - previous[2]
      );
    }
    previous = point;
  }
  return total;
}

/** How many times round the axis the course has come between two latitudes. */
export function courseTurns(bearing, fromPhi, toPhi) {
  const span = isometricLatitude(toPhi) - isometricLatitude(fromPhi);
  return Math.abs(Math.tan(bearing) * span) / (2 * Math.PI);
}

/**
 * The figure, as one surface that is a sphere at one end of its parameters and a
 * flat sheet at the other.
 *
 * `sphereness` takes the globe to the chart's cylinder: the circles of latitude
 * open out from `cos phi` to one, and the heights stretch from `sin phi` to the
 * chart's own `psi`. Those two stretches together are the projection. `wrap` then
 * takes the cylinder to the sheet, bending a plane onto a cylinder of radius
 * `1 / wrap`, so that one is the unit cylinder and nought is flat paper. The zero
 * meridian stays where it is throughout.
 */
const WRAP_FLOOR = 1e-4;

export function morphPoint(phi, lambda, sphereness, wrap) {
  const radius = sphereness * Math.cos(phi) + (1 - sphereness);
  const height = sphereness * Math.sin(phi) + (1 - sphereness) * isometricLatitude(phi);
  let across;
  let depth;
  if (wrap > WRAP_FLOOR) {
    across = Math.sin(wrap * lambda) / wrap;
    depth = (Math.cos(wrap * lambda) - 1) / wrap + 1;
  } else {
    // The limits, written out: both series are exact to the term kept at this
    // radius of bend, and neither divides by a wrap that has reached nought.
    across = lambda - wrap * wrap * lambda * lambda * lambda / 6;
    depth = 1 - wrap * lambda * lambda / 2;
  }
  return [radius * across, height, radius * depth];
}

/** The two parameters of the morph, from one opening number. */
export function morphAt(open) {
  const eased = smootherstep(Math.min(1, Math.max(0, open)));
  // The globe relaxes onto the cylinder over the first half and the cylinder
  // unrolls over the second, so only one of the two is ever moving.
  return {
    sphereness: 1 - Math.min(1, eased * 2),
    wrap: 1 - Math.max(0, eased * 2 - 1)
  };
}

/** The grid's own latitudes and longitudes. */
export function parallelLatitudes() {
  const values = [];
  for (let phi = -PARALLEL_LIMIT; phi <= PARALLEL_LIMIT + 1e-9; phi += PARALLEL_STEP) {
    values.push(Math.abs(phi) < 1e-12 ? 0 : phi);
  }
  return values;
}

export function meridianLongitudes() {
  const values = [];
  for (let index = 0; index < Math.round(2 * Math.PI / MERIDIAN_STEP); index += 1) {
    values.push(-Math.PI + index * MERIDIAN_STEP);
  }
  return values;
}

/**
 * The grid as polylines of latitude and longitude. The parallels run the whole way
 * round; the meridians stop at the chart's edge, which is why the chart's grid has
 * a top and a bottom and the globe has a hole at each pole where only the courses
 * go.
 */
export function graticuleCurves() {
  const curves = [];
  for (const phi of parallelLatitudes()) {
    const points = [];
    for (let index = 0; index <= PARALLEL_SAMPLES; index += 1) {
      points.push([phi, -Math.PI + 2 * Math.PI * index / PARALLEL_SAMPLES]);
    }
    curves.push({ kind: "parallel", at: phi, points });
  }
  for (const lambda of meridianLongitudes()) {
    const points = [];
    for (let index = 0; index <= MERIDIAN_SAMPLES; index += 1) {
      const phi = -CHART_EDGE_LATITUDE + 2 * CHART_EDGE_LATITUDE * index / MERIDIAN_SAMPLES;
      points.push([phi, lambda]);
    }
    curves.push({ kind: "meridian", at: lambda, points });
  }
  return curves;
}

/**
 * Where a drawn course stops.
 *
 * Not at a latitude the geometry cares about -- it has none -- but where the coil
 * closes up faster than a stroke can show. One turn of the course carries the eye
 * a distance `2 PI / tan(bearing)` up the chart, and the globe's circle of latitude
 * shrinks as it goes; the two are equal, and successive turns are one logical pixel
 * apart, at the latitude solved for here. Past it the drawing would be adding ink
 * to ink. The line does not end there. It stops being drawable there.
 */
export const SPHERE_SCALE = LOGICAL_SIZE * FRAME_FILL / 2;
export const COURSE_PSI_END = isometricLatitude(
  Math.acos(Math.tan(OPENING_BEARING) / (2 * Math.PI * SPHERE_SCALE))
);

/** The longest step in longitude a drawn course is allowed between samples. */
export const COURSE_STEP_LONGITUDE = degrees(3);
export const COURSE_MINIMUM_SAMPLES = 400;
export const COURSE_MAXIMUM_SAMPLES = 2600;

export function courseSamples(bearing) {
  const span = 2 * COURSE_PSI_END * Math.tan(Math.abs(bearing));
  const wanted = Math.ceil(span / COURSE_STEP_LONGITUDE);
  return Math.min(COURSE_MAXIMUM_SAMPLES, Math.max(COURSE_MINIMUM_SAMPLES, wanted));
}

/**
 * Where the courses set out from, evenly round the equator and offset half a meridian
 * from the grid's own. Started on the meridians, six courses and twelve of them would
 * share every starting point, and a reader would be looking at a coincidence of two
 * families rather than at either.
 */
export function courseOrigins(count = COURSES) {
  const origins = [];
  for (let index = 0; index < count; index += 1) {
    origins.push(-Math.PI + MERIDIAN_STEP / 2 + 2 * Math.PI * index / count);
  }
  return origins;
}

/** Longitude brought back into the half-open turn the chart has room for. */
export function wrapLongitude(lambda) {
  const turned = (lambda + Math.PI) % (2 * Math.PI);
  return (turned < 0 ? turned + 2 * Math.PI : turned) - Math.PI;
}

/**
 * One course, as the pieces the chart cuts it into.
 *
 * On the globe a course crosses the date line as if it were not there, and it does
 * so once per turn. The chart has to cut it there, and the cut is put at the exact
 * height the crossing happens at, so that the pieces meet without a gap while the
 * figure is still round and part without one when it opens.
 */
export function courseCurve(bearing, origin, samples = courseSamples(bearing)) {
  const slope = Math.tan(bearing);
  const heights = [];
  for (let index = 0; index <= samples; index += 1) {
    heights.push(-COURSE_PSI_END + 2 * COURSE_PSI_END * index / samples);
  }
  const seams = [];
  if (Math.abs(slope) > 1e-12) {
    const first = Math.ceil((courseLongitude(-COURSE_PSI_END, bearing, origin) - Math.PI) / (2 * Math.PI));
    const last = Math.floor((courseLongitude(COURSE_PSI_END, bearing, origin) - Math.PI) / (2 * Math.PI));
    for (let turn = first; turn <= last; turn += 1) {
      seams.push((Math.PI + 2 * Math.PI * turn - origin) / slope);
    }
  }
  const pieces = [];
  let piece = [];
  let seam = 0;
  for (let index = 0; index < heights.length; index += 1) {
    const psi = heights[index];
    while (seam < seams.length && seams[seam] <= psi) {
      const at = seams[seam];
      // The crossing itself, entered on the leaving edge and again on the
      // arriving one. Both are the same place on the globe.
      piece.push([latitudeFromIsometric(at), Math.PI]);
      pieces.push(piece);
      piece = [[latitudeFromIsometric(at), -Math.PI]];
      seam += 1;
    }
    piece.push([latitudeFromIsometric(psi), wrapLongitude(courseLongitude(psi, bearing, origin))]);
  }
  pieces.push(piece);
  return pieces.filter((points) => points.length > 1);
}

export function courseCurves(bearing, origins = courseOrigins()) {
  return origins.map((origin) => ({ origin, pieces: courseCurve(bearing, origin) }));
}

/**
 * The box the grid occupies at a given opening, and the scale that fits it to the
 * canvas. Measured on the grid alone: the courses run past the chart's edge and off
 * the sheet, and a frame fitted to them would be a frame fitted to how far past the
 * edge the drawing happened to stop.
 */
export function graticuleBox(open) {
  const { sphereness, wrap } = morphAt(open);
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const curve of graticuleCurves()) {
    for (const [phi, lambda] of curve.points) {
      const point = morphPoint(phi, lambda, sphereness, wrap);
      for (let axis = 0; axis < 3; axis += 1) {
        if (point[axis] < low[axis]) low[axis] = point[axis];
        if (point[axis] > high[axis]) high[axis] = point[axis];
      }
    }
  }
  return {
    low,
    high,
    centre: low.map((part, axis) => (part + high[axis]) / 2),
    size: high.map((part, axis) => part - low[axis])
  };
}

/**
 * How round the figure still is, against the globe it began as: one while it is the
 * globe or the cylinder, nought once it is paper.
 *
 * The far half of a round figure is drawn fainter than the near half, and the cut
 * between them is the plane of its silhouette. A flat sheet has no such halves, but it
 * is still turned a little as it settles, and a cut taken on that alone put a hard step
 * of brightness across the middle of the chart. So the difference between the two halves
 * is weighed by this, and squared, so that it is gone before the sheet is.
 */
export function roundness(open) {
  const box = graticuleBox(open);
  const share = Math.min(1, Math.max(0, box.size[2] / 2));
  return share * share;
}

/**
 * What is left of the grid once the sheet is flat.
 *
 * On the globe the grid is the figure's frame and the courses are read against it. On the
 * chart it stops being that: every line of it is straight, and so are the courses, and the
 * page reads as ruled paper with the courses one more ruling on it. So the grid gives way
 * as the sheet opens, in proportion to how far open it is — the globe is untouched, and
 * the chart keeps just enough of it for the one thing the grid says there that nothing
 * else does: the parallels crowd at the equator and stand apart at the edge, which is the
 * stretch that put the pole out of reach.
 */
export const GRID_ON_THE_CHART = 0.45;

/** How much of the grid's ink is laid down at a given opening. */
export function gridInk(open) {
  return 1 - (1 - GRID_ON_THE_CHART) * Math.min(1, Math.max(0, open));
}

/**
 * The scale the figure is drawn at, from the box's longest side rather than from
 * the view. A reader turning the globe by hand is turning the figure, not the zoom,
 * and a fit that answered to the view would rescale under the drag.
 */
export function figureFrame(open) {
  const box = graticuleBox(open);
  return {
    centre: box.centre,
    roundness: Math.min(1, Math.max(0, box.size[2] / 2)) ** 2,
    scale: LOGICAL_SIZE * FRAME_FILL / Math.max(...box.size)
  };
}

/** Smootherstep: no speed and no acceleration at either end, so acts can be joined. */
export function smootherstep(t) {
  const u = Math.min(Math.max(t, 0), 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/*
 * The staging. Twelve seconds, and every stretch begins where the one before it
 * ended, so the whole clip is one continuous motion and the last frame is the
 * first.
 *
 * globe   30  the whirl at rest, seen from a little above the equator
 * pole    66  the eye climbs to the axis; the coil is seen winding in
 * back    36  and comes down again
 * unwind  54  the bearing falls to twenty degrees; the spirals slacken
 * wind    42  and returns to seventy-six
 * open    72  the globe relaxes onto its cylinder and the cylinder unrolls
 * chart   24  the ruled field of parallel lines, held
 * close   36  and rolled back up
 */
export const ACTS = [
  ["globe", 30],
  ["pole", 66],
  ["back", 36],
  ["unwind", 54],
  ["wind", 42],
  ["open", 72],
  ["chart", 24],
  ["close", 36]
];
export const ACT_FRAMES = ACTS.reduce((sum, [, frames]) => sum + frames, 0);

export const RESTING_TILT = degrees(22);
export const POLAR_TILT = degrees(88);
/** The globe's own turn, one whole revolution, spent before the chart opens. */
export const SPIN_FRAMES = ACTS.slice(0, 5).reduce((sum, [, frames]) => sum + frames, 0);

export function actAt(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  let start = 0;
  for (const [name, frames] of ACTS) {
    if (frame < start + frames) {
      // The last frame of a stretch is the stretch's own end, so the next one
      // begins where this arrived rather than one step short of it.
      const progress = frames === 1 ? 1 : (frame - start) / (frames - 1);
      return { frame, name, progress, start, frames };
    }
    start += frames;
  }
  throw new RangeError("The acts do not cover the clip.");
}

export function sceneAt(frameIndex) {
  const { frame, name, progress } = actAt(frameIndex);
  const eased = smootherstep(progress);

  let tilt = RESTING_TILT;
  let bearing = OPENING_BEARING;
  let open = 0;
  if (name === "pole") {
    tilt = RESTING_TILT + (POLAR_TILT - RESTING_TILT) * eased;
  } else if (name === "back") {
    tilt = POLAR_TILT + (RESTING_TILT - POLAR_TILT) * eased;
  } else if (name === "unwind") {
    bearing = OPENING_BEARING + (UNWOUND_BEARING - OPENING_BEARING) * eased;
  } else if (name === "wind") {
    bearing = UNWOUND_BEARING + (OPENING_BEARING - UNWOUND_BEARING) * eased;
  } else if (name === "open") {
    open = eased;
    tilt = RESTING_TILT * (1 - eased);
  } else if (name === "chart") {
    open = 1;
    tilt = 0;
  } else if (name === "close") {
    open = 1 - eased;
    tilt = RESTING_TILT * eased;
  }

  const spin = 2 * Math.PI * smootherstep(Math.min(1, frame / (SPIN_FRAMES - 1)));
  const framing = figureFrame(open);
  return {
    frameIndex: frame,
    act: name,
    progress,
    tilt,
    spin,
    bearing,
    open,
    ...morphAt(open),
    centre: framing.centre,
    roundness: framing.roundness,
    scale: framing.scale
  };
}

/**
 * The figure's points, turned into the view. The sketch draws these and nothing
 * else, so what a frame contains can be measured without a browser.
 *
 * The turn is the globe's own about its axis, then the eye's climb towards it.
 * `y` is up and `z` is towards the eye, so depth is read straight off the third
 * component -- which is how the far side of a round figure is told from the near
 * one, and why the telling quietly stops mattering once the figure is flat.
 */
export function viewPoint([x, y, z], spin, tilt, centre, scale) {
  const cx = x - centre[0];
  const cy = y - centre[1];
  const cz = z - centre[2];
  const cosSpin = Math.cos(spin);
  const sinSpin = Math.sin(spin);
  const spunX = cx * cosSpin + cz * sinSpin;
  const spunZ = -cx * sinSpin + cz * cosSpin;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  return [
    spunX * scale,
    (cy * cosTilt - spunZ * sinTilt) * scale,
    (cy * sinTilt + spunZ * cosTilt) * scale
  ];
}

/** A polyline of the figure, in the view, ready to be stroked. */
export function viewCurve(points, scene) {
  const { sphereness, wrap, spin, tilt, centre, scale } = scene;
  return points.map(([phi, lambda]) =>
    viewPoint(morphPoint(phi, lambda, sphereness, wrap), spin, tilt, centre, scale));
}

/**
 * How flat is flat enough to have no far side, as a share of the figure's own scale.
 *
 * A round figure is cut at the plane of its silhouette so the half turned away can be
 * drawn fainter than the half turned towards. A flat one has no such halves — but the
 * turn that is applied to it leaves a depth of a few parts in ten thousand million of a
 * pixel, whose sign follows whichever side of the sheet a point is on. Read as depth,
 * that noise painted the right half of the chart bright and the left half faint. So the
 * cut is taken at a threshold rather than at nought, and a figure whose depth is below
 * it is all one side.
 */
export const FLATNESS_FLOOR = 1e-6;

export function depthFloor(scale) {
  return FLATNESS_FLOOR * scale;
}

/**
 * A polyline cut where it passes through the plane of the silhouette, so the half
 * turned away can be drawn fainter than the half turned towards. The cut is where
 * the chord crosses, which is the chord's own crossing exactly.
 */
export function splitByDepth(points, floor = 0) {
  const runs = [];
  let run = [];
  let side = null;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const here = point[2] >= -floor;
    if (side === null) {
      side = here;
      run.push(point);
      continue;
    }
    if (here === side) {
      run.push(point);
      continue;
    }
    const previous = points[index - 1];
    const t = (previous[2] + floor) / (previous[2] - point[2]);
    const crossing = [
      previous[0] + (point[0] - previous[0]) * t,
      previous[1] + (point[1] - previous[1]) * t,
      -floor
    ];
    run.push(crossing);
    runs.push({ near: side, points: run });
    run = [crossing, point];
    side = here;
  }
  if (run.length > 1) {
    runs.push({ near: side, points: run });
  }
  return runs;
}

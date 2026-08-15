/**
 * The Möbius band, as the one equation it takes.
 *
 * Sweep a segment of length 2w around a circle of radius R, and while it goes around
 * once, turn it about its own centre by half a turn:
 *
 *   P(u, v) = ((R + v cos(u/2)) cos u,  (R + v cos(u/2)) sin u,  v sin(u/2))
 *
 * with u the angle around the ring and v the signed position across the strip. The u/2 is
 * the whole construction: the cross-section turns at half the rate of the sweep, so after
 * a full lap the segment arrives upside down and the two ends glue with a flip,
 *
 *   P(u + 2 PI, v) = P(u, -v).
 *
 * Everything the band is famous for falls out of that identity, and the tests assert each
 * consequence directly: the surface has one side (the normal comes back negated after a
 * lap), it has one edge (the boundary needs 4 PI of u to close), and a traveller on it
 * needs two laps to come home the same way up.
 */

/** A point on the band. u in radians around the ring, v in [-w, w] across the strip. */
export function bandPoint(u, v, radius) {
  const reach = radius + v * Math.cos(u / 2);
  return [reach * Math.cos(u), reach * Math.sin(u), v * Math.sin(u / 2)];
}

/**
 * The unit surface normal, from the analytic partial derivatives. Along the centre line
 * it obeys N(u + 2 PI, 0) = -N(u, 0): come back after one lap and "up" now points down,
 * which is what having only one side means in coordinates.
 */
export function bandNormal(u, v, radius) {
  const reach = radius + v * Math.cos(u / 2);
  const du = [
    -reach * Math.sin(u) - (v / 2) * Math.sin(u / 2) * Math.cos(u),
    reach * Math.cos(u) - (v / 2) * Math.sin(u / 2) * Math.sin(u),
    (v / 2) * Math.cos(u / 2)
  ];
  const dv = [
    Math.cos(u / 2) * Math.cos(u),
    Math.cos(u / 2) * Math.sin(u),
    Math.sin(u / 2)
  ];
  const cross = [
    du[1] * dv[2] - du[2] * dv[1],
    du[2] * dv[0] - du[0] * dv[2],
    du[0] * dv[1] - du[1] * dv[0]
  ];
  const length = Math.hypot(...cross);
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

/**
 * The direction the strip runs across itself at the centre line: the unit tangent along
 * v at v = 0. It completes the traveller's frame, and it carries the flip as plainly as
 * the normal does — A(u + 2 PI) = -A(u) — because after a lap the strip's two edges have
 * changed places.
 */
export function bandAcross(u) {
  return [
    Math.cos(u / 2) * Math.cos(u),
    Math.cos(u / 2) * Math.sin(u),
    Math.sin(u / 2)
  ];
}

/**
 * A point on the band's edge. One curve, not two: because of the glue-with-a-flip, the
 * rim that leaves at v = +w comes back at v = -w, so the edge closes only after u has
 * run 4 PI. Following it is the fastest proof the band has a single boundary.
 */
export function edgePoint(u, radius, width) {
  return bandPoint(u, width, radius);
}

/**
 * The whole surface as rows of vertices with matching normals, ready to be stitched into
 * triangles: rows[i][j] samples u = i/segmentsAround * 2 PI, v from -width to +width.
 * Row `segmentsAround` is the seam row: numerically it equals row 0 with the v order
 * reversed, which is the glue made visible in the data.
 */
export function bandRows(segmentsAround, segmentsAcross, radius, width) {
  const rows = [];
  for (let i = 0; i <= segmentsAround; i += 1) {
    const u = (i / segmentsAround) * 2 * Math.PI;
    const row = [];
    for (let j = 0; j <= segmentsAcross; j += 1) {
      const v = -width + (2 * width * j) / segmentsAcross;
      row.push({ point: bandPoint(u, v, radius), normal: bandNormal(u, v, radius) });
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Where the camera stands, written in the band's own frame.
 *
 * The stage tilts about x and then turns about z, so the direction the viewer looks from
 * is the last row of that rotation carried back onto the band. Having it here rather than
 * in the sketch is what lets the glass be shaded and sorted by pure functions: both need
 * to know which way is towards the eye, and neither should have to ask the renderer.
 */
export function viewDirection(tilt, spin) {
  return [
    Math.sin(tilt) * Math.sin(spin),
    Math.sin(tilt) * Math.cos(spin),
    Math.cos(tilt)
  ];
}

const KEY_LIGHT = [-0.37, 0.45, -0.81];
const FILL_LIGHT = [0.63, -0.36, 0.68];

function dot(first, second) {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

/**
 * The glass, as a colour and a transparency for one point of the surface.
 *
 * Every term is folded in absolute value, and that is not a convenience: on a one-sided
 * surface "which way the normal points" is not a fact about the surface — carry a normal
 * around the ring and it comes back negated — so any shading that reads the sign of the
 * normal must tear somewhere, and a lit Mobius band shows that tear as a seam. What is
 * well defined is how nearly the surface lies along a direction, which is what |N . L|
 * measures, so the whole model is built from those.
 *
 * The view term is the glass. A surface seen face-on lets the light through and barely
 * shows; seen edge-on it turns bright and nearly solid. That is how glass behaves, and it
 * is also an ally of the artwork's claim: the band cannot have a hidden far side if the
 * near side is transparent, so the traveller's whole journey stays readable.
 */
export function glassShade(normal, view, colour) {
  const key = Math.abs(dot(normal, KEY_LIGHT));
  const fill = Math.abs(dot(normal, FILL_LIGHT));
  const facing = Math.abs(dot(normal, view));
  const grazing = (1 - facing) ** 3;
  const body = 0.24 + 0.57 * key + 0.19 * fill + 0.75 * grazing;
  return [
    ...colour.map((component) => Math.min(255, component * body)),
    58 + 150 * grazing
  ];
}

/**
 * The traveller, as a colour for one point of its skin — and the one model here that
 * reads the sign of a normal rather than folding it away.
 *
 * The difference from `glassShade` is not an inconsistency in the lighting. It is the
 * claim. A one-sided surface has no fact to offer about which way it faces, so the band
 * can only be shaded by how nearly it lies along a direction, |N . L|, and is lit the
 * same on both of the sides it does not have. The traveller is an ordinary solid with an
 * inside and an outside, so its normals mean something, and clamping at zero instead of
 * folding — lit where it faces the light, dark where it faces away — is exactly what
 * makes it read as a body. One of the two things in this picture can answer the question
 * and the other cannot, and the two shading models say so.
 *
 * The grazing term is kept, and stays folded, because it is about the eye rather than
 * the surface: a rim of light along a silhouette is what separates the traveller from
 * the band it stands on when the two are the same distance away.
 *
 * The strength is capped where the first channel would saturate, which is the difference
 * between one colour at many strengths and a colour that turns pale where it is
 * brightest. Uncapped, the brightest facets came back [255, 246, 98] — lemon — because
 * red had run out while green kept climbing. Capped, every pixel of the traveller is
 * exactly this gold, multiplied, and the highlight tops out at the gold's own brightest
 * form rather than at somebody else's colour.
 */
export function solidShade(normal, view, colour) {
  const key = Math.max(0, dot(normal, KEY_LIGHT));
  const fill = Math.max(0, dot(normal, FILL_LIGHT));
  const rim = (1 - Math.abs(dot(normal, view))) ** 3;
  const ceiling = 255 / Math.max(...colour);
  const body = Math.min(ceiling, 0.44 + 1.02 * key + 0.26 * fill + 0.44 * rim);
  return colour.map((component) => component * body);
}

/**
 * The traveller's meridian: its outline, as a radius out from the normal and a height
 * above the band, ready to be swept round to make the whole body.
 *
 *   r(t) = a sin(PI t) (1 - k (1 - cos(PI t)) / 2),   h(t) = (b / 2)(1 - cos(PI t))
 *
 * A half turn of sine and cosine, pinched towards the top by k. It leaves the surface at
 * t = 0 with r = h = 0 and closes on a point again at the tip, so the body is one closed
 * thing with no base to hide.
 *
 * What matters at the foot is the direction it leaves in. dh/dt vanishes there while
 * dr/dt does not, so the body meets the band tangentially and touches it at a point.
 * Just above the foot h grows like b r^2 / (4 a^2), where the ring falls away underneath
 * like r^2 / 2R; for the sizes used the first is about fifty times the second, so the
 * touch stays a touch the whole way round. A flat foot cannot do that — a disc of radius
 * r laid on a ring of radius R sinks into it by about r^2 / 2R — which is what ruled out
 * the cone-shaped candidate, whose measured 0.159 units of penetration matched the
 * 0.132 that formula predicts.
 */
function meridian(t, radius, height, taper) {
  const angle = t * Math.PI;
  const pinch = 1 - (taper * (1 - Math.cos(angle))) / 2;
  const dPinch = (-taper * Math.sin(angle)) / 2;
  return {
    radius: radius * Math.sin(angle) * pinch,
    height: (height / 2) * (1 - Math.cos(angle)),
    dRadius: radius * (Math.cos(angle) * pinch + Math.sin(angle) * dPinch),
    dHeight: (height / 2) * Math.sin(angle)
  };
}

/**
 * The traveller's whole body, as triangles with a normal at every vertex: the meridian
 * swept about the surface normal, standing on the band at `position`.
 *
 * The frame is the band's own — the normal for the axis, the across-strip direction for
 * the first radius — so the body turns with the surface under it and never jumps: both
 * are smooth in u, and being a solid of revolution the body does not care where the
 * sweep starts anyway. Standing it on the normal is what makes the journey legible.
 * The old marker was a bead centred on the line, which is to say at height zero, and a
 * reflection through the surface leaves height zero exactly where it was; a mark raised
 * above the surface is carried twice its own height by the same reflection, which is why
 * this body reports the flip and the bead could not.
 */
export function travellerMesh(position, normal, across, shape) {
  const { radius, height, taper, rings, sectors } = shape;
  const side = [
    normal[1] * across[2] - normal[2] * across[1],
    normal[2] * across[0] - normal[0] * across[2],
    normal[0] * across[1] - normal[1] * across[0]
  ];
  const stations = [];
  for (let i = 0; i <= rings; i += 1) {
    const { radius: r, height: h, dRadius, dHeight } = meridian(
      i / rings, radius, height, taper);
    const ring = [];
    for (let j = 0; j < sectors; j += 1) {
      const phi = (j / sectors) * 2 * Math.PI;
      const out = [0, 1, 2].map((axis) =>
        Math.cos(phi) * across[axis] + Math.sin(phi) * side[axis]);
      // The skin's normal is perpendicular to the meridian's own tangent and points away
      // from the body: (dh, -dr) in the (radius, height) plane, carried onto the frame.
      // At the foot that is straight down into the band, at the tip straight up.
      const facing = [0, 1, 2].map((axis) => out[axis] * dHeight - normal[axis] * dRadius);
      const length = Math.hypot(...facing);
      ring.push({
        point: [0, 1, 2].map((axis) => position[axis] + out[axis] * r + normal[axis] * h),
        normal: facing.map((component) => component / length)
      });
    }
    stations.push(ring);
  }

  const mesh = [];
  for (let i = 0; i < rings; i += 1) {
    const lower = stations[i];
    const upper = stations[i + 1];
    for (let j = 0; j < sectors; j += 1) {
      const next = (j + 1) % sectors;
      // Both ends of the meridian close on a point, so the first and last bands need one
      // triangle rather than two: the other half of the quad has a collapsed edge and no
      // area. Every quad in between is split the usual way.
      if (i > 0) {
        mesh.push(lower[j], lower[next], upper[next]);
      }
      if (i < rings - 1) {
        mesh.push(lower[j], upper[next], upper[j]);
      }
    }
  }
  return mesh;
}

/** The centre of every quad cell of the mesh, in the band's own frame. */
export function cellCentres(rows) {
  const centres = [];
  for (let i = 0; i < rows.length - 1; i += 1) {
    for (let j = 0; j < rows[i].length - 1; j += 1) {
      const corners = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]];
      centres.push({
        i,
        j,
        point: [0, 1, 2].map((axis) =>
          corners.reduce((total, corner) => total + corner.point[axis], 0) / 4)
      });
    }
  }
  return centres;
}

/**
 * The order to paint the cells in: furthest from the eye first.
 *
 * Transparency has no depth buffer to fall back on — what is drawn later is simply mixed
 * over what is there — so the only way a see-through band can be right is to paint it
 * from the back. The band turns, so the order is recomputed every frame; it is still a
 * pure function of the frame, since the spin is.
 */
export function backToFront(centres, view) {
  return centres
    .map((centre, index) => ({ index, depth: dot(centre.point, view) }))
    .sort((first, second) => first.depth - second.depth)
    .map((entry) => entry.index);
}

/**
 * Where the travelling marker is, `progress` running 0 to 1 over the whole journey.
 *
 * The marker walks the centre line, whose points repeat every lap — but it stands a body
 * up along the surface normal, and that does not: after one lap (progress 1/2) the marker
 * is at its starting point with its body on the other face. Only after the second lap is
 * it home. `side` names which face the body currently claims to be on; that it flips sign
 * at half way while the position repeats is the artwork's whole point.
 */
export function markerState(progress, radius) {
  const u = progress * 4 * Math.PI;
  // The body stands on the surface normal. Which of the two opposite normals to call
  // "the" normal is an arbitrary choice on an orientable patch — so it is made for the
  // stage: negated, the journey opens with the traveller standing in view rather than
  // hidden under the band, and the mid-journey flip happens where the camera can see it.
  const normal = bandNormal(u, 0, radius).map((component) => -component);
  return {
    u,
    position: bandPoint(u, 0, radius),
    normal,
    side: progress % 1 < 0.5 ? 1 : -1
  };
}

/**
 * How many whole turns the stage makes over one clip. Two, so that at half way — the
 * frame where the marker revisits its start the wrong way up — the stage is facing
 * front again and the flip happens in plain view rather than behind the band.
 */
export const STAGE_TURNS = 2;

/**
 * Everything a frame shows, as a function of nothing but the frame. Over the clip the
 * marker makes its two laps while the stage turns a whole number of times, so the last
 * frame hands back to the first and the clip loops without a seam.
 */
export function sceneState(frameIndex, totalFrames, radius) {
  const progress = frameIndex / totalFrames;
  return {
    progress,
    spin: progress * STAGE_TURNS * 2 * Math.PI,
    marker: markerState(progress, radius)
  };
}

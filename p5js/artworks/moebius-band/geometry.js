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
 * Where the travelling marker is, `progress` running 0 to 1 over the whole journey.
 *
 * The marker walks the centre line, whose points repeat every lap — but it carries a pin
 * along the surface normal, and the pin does not: after one lap (progress 1/2) the marker
 * stands at its starting point with the pin through the band the other way. Only after
 * the second lap is it home. `side` names which face the pin currently claims to be on;
 * that it flips sign at half way while the position repeats is the artwork's whole point.
 */
export function markerState(progress, radius) {
  const u = progress * 4 * Math.PI;
  // The pin rides the surface normal. Which of the two opposite normals to call "the"
  // normal is an arbitrary choice on an orientable patch — so it is made for the stage:
  // negated, the journey opens with the pin standing in view rather than hidden under
  // the band, and the mid-journey flip happens where the camera can see it.
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

/**
 * The clip's whole choreography as a pure function of the frame.
 *
 * Three solids share the stage: the icosahedron, its dual, and the dual of that — the
 * icosahedron again, smaller by the square of the shared inradius-to-circumradius
 * ratio. They are used exactly as the dual operation makes them, so their nesting
 * scales are nobody's bookkeeping: dualizing from circumradius 1 lands the
 * dodecahedron at the icosahedron's inradius, and dualizing again lands the inner
 * icosahedron at the square of it.
 *
 * Over the clip each solid in turn ignites sparks on its face centres — which *are*
 * the next solid's vertices — hands the stage to the solid those sparks assemble, and
 * fades to a ghost. Meanwhile the camera closes in at one constant exponential rate
 * and the stage turns a fifth of a turn about the vertical five-fold axis, so the
 * last frame is the first frame again: same figure, same bearing, one dual cycle
 * deeper. Nothing about the loop is patched at the seam; it closes because the two
 * dualizations shrink by the same ratio, which is the theorem the artwork rests on.
 */

import { dualOf, icosahedron, inradiusOf } from "./geometry.js";

export const TOTAL_FRAMES = 300;
/** One fifth of a turn: the stage's whole rotation, an icosahedral symmetry. */
export const STAGE_TURN = (2 * Math.PI) / 5;

/**
 * The icosahedron turned so one vertex points straight up: the five-fold axis the
 * stage rotates about becomes the vertical, and a fifth of a turn maps the figure —
 * and everything dualized from it — onto itself.
 */
export function alignedIcosahedron() {
  const solid = icosahedron();
  const [, y, z] = solid.vertices.find(
    (vertex) => Math.abs(vertex[0]) < 1e-12 && vertex[1] > 0 && vertex[2] > 0
  );
  const lean = Math.atan2(z, y);
  const cos = Math.cos(lean);
  const sin = Math.sin(lean);
  return {
    vertices: solid.vertices.map(([x, why, zed]) => [
      x,
      why * cos + zed * sin,
      -why * sin + zed * cos
    ]),
    faces: solid.faces
  };
}

/** The three solids of the cycle, in the sizes the dual operation itself hands over. */
export function nestedSolids() {
  const outer = alignedIcosahedron();
  const middle = dualOf(outer);
  const inner = dualOf(middle);
  return { outer, middle, inner };
}

/** The shared ratio, measured from the solid: how far one dualization shrinks. */
export function dualShrink() {
  return inradiusOf(alignedIcosahedron());
}

/**
 * The schedule, named. Each row is a moment the choreography turns on; everything
 * between rows is linear interpolation, written out in the envelopes below.
 */
export const PLAN = {
  sparksOnOuter: [45, 75],
  middleEdgesIn: [90, 135],
  middleFacesIn: [120, 160],
  outerFacesOut: [90, 135],
  outerEdgesOut: [150, 190],
  sparksOffOuter: [100, 135],
  sparksOnMiddle: [180, 210],
  innerEdgesIn: [225, 270],
  innerFacesIn: [250, 290],
  middleFacesOut: [225, 260],
  middleEdgesOut: [275, 300],
  sparksOffMiddle: [235, 270]
};

/** A ghost keeps this share of an edge's ink on its way out. */
const GHOST_EDGE_LEVEL = 0.3;

/** Linear ramp between two frames, clamped to [0, 1]. */
export function ramp(frame, [from, to]) {
  if (frame <= from) {
    return 0;
  }
  if (frame >= to) {
    return 1;
  }
  return (frame - from) / (to - from);
}

/**
 * Everything a frame shows. Alphas run 0..1; the sketch decides what ink they buy.
 * Sparks are the next solid's vertices being born, so each band's sparks carry the
 * *following* band's colour — the reveal is that the centres already were the dual's
 * corners.
 */
export function sceneState(frameIndex) {
  const progress = frameIndex / TOTAL_FRAMES;
  const shrink = dualShrink();
  return {
    progress,
    zoom: shrink ** (-2 * progress),
    spin: STAGE_TURN * progress,
    outer: {
      faceAlpha: 1 - ramp(frameIndex, PLAN.outerFacesOut),
      edgeAlpha: 1 - (1 - GHOST_EDGE_LEVEL) * ramp(frameIndex, PLAN.outerFacesOut)
        - GHOST_EDGE_LEVEL * ramp(frameIndex, PLAN.outerEdgesOut)
    },
    middle: {
      faceAlpha: ramp(frameIndex, PLAN.middleFacesIn)
        - ramp(frameIndex, PLAN.middleFacesOut),
      edgeAlpha: ramp(frameIndex, PLAN.middleEdgesIn)
        - (1 - GHOST_EDGE_LEVEL) * ramp(frameIndex, PLAN.middleFacesOut)
        - GHOST_EDGE_LEVEL * ramp(frameIndex, PLAN.middleEdgesOut)
    },
    inner: {
      faceAlpha: ramp(frameIndex, PLAN.innerFacesIn),
      edgeAlpha: ramp(frameIndex, PLAN.innerEdgesIn)
    },
    sparks: {
      onOuter: ramp(frameIndex, PLAN.sparksOnOuter)
        - ramp(frameIndex, PLAN.sparksOffOuter),
      onMiddle: ramp(frameIndex, PLAN.sparksOnMiddle)
        - ramp(frameIndex, PLAN.sparksOffMiddle)
    }
  };
}

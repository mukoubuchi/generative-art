/**
 * Export scale for the WEBGL artworks.
 *
 * A 2D sketch is exported larger by scaling the drawing: twice the canvas, twice the
 * scale, the same picture with twice the pixels. Under WEBGL that reasoning does not
 * hold, and following it reframes the picture instead of enlarging it.
 *
 * p5's default camera sits at a fixed distance and opens its field of view with the
 * canvas height — `defaultEyeZ = 800` and `defaultCameraFOV = 2 * atan(height / 2 / 800)`
 * (p5 2.3.2). Those two cancel: the pixels a model unit covers work out at `800 / depth`
 * whatever the canvas measures, so a taller canvas shows more of the scene at the same
 * size rather than the same scene larger. Scaling the model to make up the difference
 * scales its depth as well, and the perspective divide then magnifies what is near the
 * eye more than what is far — the silhouette stretches, and the framing measured on the
 * logical canvas is not the framing that comes out.
 *
 * Pinning the field of view to the one the logical canvas would have puts the ratio back
 * under the sketch's control: the eye does not move, nothing about the scene changes, and
 * the larger canvas is a uniform magnification of the same view. The near and far planes
 * are p5's own defaults, written out here so that the projection is fully the sketch's
 * rather than half inherited.
 */

/** The distance p5 stands its default camera at, and the one these sketches are framed for. */
export const EYE_Z = 800;

/**
 * Pin the projection to the logical canvas's own field of view.
 *
 * Call it after the canvas exists and after any `setAttributes` — that call rebuilds the
 * rendering context, and a projection set before it would be rebuilt away.
 */
export function pinLogicalCamera(p, logicalHeight, outputWidth, outputHeight) {
  p.perspective(
    2 * Math.atan(logicalHeight / 2 / EYE_Z),
    outputWidth / outputHeight,
    EYE_Z * 0.1,
    EYE_Z * 10
  );
}

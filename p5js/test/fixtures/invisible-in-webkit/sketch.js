/*
 * Strange Attractor's sketch as it stood before the dot was given a length. Frozen on
 * purpose: this is the fault a reader on an iPhone actually saw, kept as a specimen for the
 * cross-engine check to be aimed at.
 *
 * The fault is in `dot`, which draws a subpath whose start and end are the same point and
 * relies on a round cap to leave a mark. Chromium leaves one. WebKit leaves nothing, cap or
 * no cap, and every browser on iOS is WebKit -- so all 336,000 points of the orbit went down
 * invisibly and a reader was shown the background and nothing else.
 *
 * What makes it worth freezing is how quietly it failed. The sketch reported 300 of 300
 * frames and 336,000 of 336,000 points drawn, raised nothing, and logged nothing; only the
 * picture was missing. No check that reads state, counts frames, or watches for errors could
 * have seen it, and none did.
 *
 * Nothing here is to be followed or repaired. It is not part of the site: it sits outside
 * `artworks/`, it is absent from the manifest, and the build never copies it. A copy is
 * usually a liability, because it drifts away from the thing it was taken from; here not
 * drifting is the entire point. The check that is pointed at a site built with this file is
 * asking whether it can still see a fault that was really made, rather than one somebody
 * imagined afterwards, and the answer stops meaning anything the moment this file is brought
 * up to date.
 */

import { hsbToRgb } from "../shared/color.js";
import {
  ART_SEED,
  COLOR_BINS,
  HIGHLIGHT_OFFSET_X,
  HIGHLIGHT_OFFSET_Y,
  HIGHLIGHT_STRIDE,
  POINT_COUNT,
  binHue,
  calculateOrbit,
  colorBins,
  fitToCanvas
} from "./attractor.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BACKGROUND = [230, 52, 5];
const POINT_WEIGHT = 0.72;
const POINT_SATURATION = 72;
const POINT_BRIGHTNESS = 92;
/**
 * Every point is almost invisible on its own. The figure appears because the layer is
 * added rather than blended, so the brightness of a place is the number of times the orbit
 * has visited it — the image is a histogram of the attractor.
 */
const POINT_ALPHA = 0.085;
const HIGHLIGHT_WEIGHT = 0.55;
const HIGHLIGHT_COLOR = [196, 18, 100];
const HIGHLIGHT_ALPHA = 0.06;
const START_RANGE = 0.01;
const PLAYBACK_FPS = 30;
/**
 * The clip lays the cloud down over nine seconds and holds it for one. The orbit is not
 * recomputed as it goes: the whole of it is worked out once and the frame fitted to all of
 * it, so what grows is how much of the cloud has been laid down and not where the camera
 * is. Fitting each frame to the points drawn so far would rescale the figure every frame
 * and make the clip a picture of the fitting rather than of the attractor.
 */
const CLIP_SECONDS = 10;
const REVEAL_SECONDS = 9;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;
const REVEAL_FRAMES = REVEAL_SECONDS * PLAYBACK_FPS;

const P5 = window.p5;

new P5((p) => {
  let context;

  /** A dot: a zero-length round-capped stroke, which is what a point is on a 2D canvas. */
  function dot(x, y) {
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
  }

  /** The whole orbit, its framing and its colours: worked out once and never refitted. */
  let cloud;
  let bins;
  let drawn = 0;

  /**
   * How much of the cloud has been laid down by `frameIndex` — a pure function of the
   * index, so a frame asked for twice is the same frame.
   */
  function pointsBy(frameIndex) {
    const part = Math.min(frameIndex / REVEAL_FRAMES, 1);
    return Math.min(POINT_COUNT, Math.round(POINT_COUNT * part));
  }

  /**
   * Lays down the points from `from` to `to`, grouped by colour band so that a run of them
   * costs one stroke colour rather than one each. The layer is added rather than blended
   * and addition does not care about order, so laying the cloud down in instalments builds
   * the same figure as laying it down at once.
   */
  function drawRange(from, to) {
    const buckets = Array.from({ length: COLOR_BINS }, () => []);
    for (let index = from; index < to; index += 1) {
      buckets[bins[index]].push(index);
    }
    p.push();
    p.scale(RENDER_SCALE);
    p.blendMode(p.ADD);
    context.lineWidth = POINT_WEIGHT;
    context.lineCap = "round";
    for (let bin = 0; bin < COLOR_BINS; bin += 1) {
      if (buckets[bin].length === 0) {
        continue;
      }
      const [red, green, blue] = hsbToRgb(binHue(bin), POINT_SATURATION, POINT_BRIGHTNESS);
      context.strokeStyle = `rgba(${red},${green},${blue},${POINT_ALPHA})`;
      for (const index of buckets[bin]) {
        dot(cloud.xs[index], cloud.ys[index]);
      }
    }
    // The thinner, paler layer over every third point, shifted by a fraction of a pixel so
    // it lands beside the layer beneath and only the densest contours accumulate.
    const [red, green, blue] = hsbToRgb(...HIGHLIGHT_COLOR);
    context.lineWidth = HIGHLIGHT_WEIGHT;
    context.strokeStyle = `rgba(${red},${green},${blue},${HIGHLIGHT_ALPHA})`;
    const first = from + ((HIGHLIGHT_STRIDE - (from % HIGHLIGHT_STRIDE)) % HIGHLIGHT_STRIDE);
    for (let index = first; index < to; index += HIGHLIGHT_STRIDE) {
      dot(cloud.xs[index] + HIGHLIGHT_OFFSET_X, cloud.ys[index] + HIGHLIGHT_OFFSET_Y);
    }
    p.blendMode(p.BLEND);
    p.pop();
  }

  /** Lays the cloud down as far as `target`, starting again if asked to go back. */
  function layUpTo(target) {
    if (target < drawn) {
      p.background(...BACKGROUND);
      drawn = 0;
    }
    drawRange(drawn, target);
    drawn = target;
  }

  function publishState(frameIndex) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      seed: ART_SEED,
      pointCount: POINT_COUNT,
      pointsDrawn: drawn,
      colorBins: COLOR_BINS,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists. Before it, p5 has
    // nothing to set the density on and the call is quietly ignored; on a Retina screen
    // the backing store then comes out twice the size asked for. Left alone in the
    // browser, so a reader on such a screen gets the picture drawn at their own
    // resolution -- and pinned here, so an export is the size the manifest says
    // rather than whatever density the machine doing the rendering happens to have.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    context = p.drawingContext;
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.frameRate(PLAYBACK_FPS);
    // Seeded here, so the figure is a function of the seed alone.
    p.randomSeed(ART_SEED);
    p.background(...BACKGROUND);

    const orbit = calculateOrbit(
      p.random(-START_RANGE, START_RANGE),
      p.random(-START_RANGE, START_RANGE)
    );
    cloud = fitToCanvas(orbit, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    bins = colorBins(orbit.ys);

    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        layUpTo(pointsBy(frameIndex));
        return Promise.resolve(publishState(frameIndex));
      };
    }
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    if (p.frameCount > TOTAL_FRAMES) {
      p.noLoop();
      return;
    }
    layUpTo(pointsBy(p.frameCount));
    publishState(p.frameCount);
  };
});

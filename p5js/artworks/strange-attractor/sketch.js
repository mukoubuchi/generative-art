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

  /**
   * Orders the cloud by colour band with a counting sort, so the whole figure is drawn in
   * 32 passes with one stroke colour each. Additive blending is commutative, so grouping
   * the points changes the cost and not the image.
   */
  function orderByBin(bins) {
    const counts = new Uint32Array(COLOR_BINS);
    for (const bin of bins) {
      counts[bin] += 1;
    }
    const starts = new Uint32Array(COLOR_BINS);
    for (let bin = 1; bin < COLOR_BINS; bin += 1) {
      starts[bin] = starts[bin - 1] + counts[bin - 1];
    }
    const cursor = starts.slice();
    const order = new Uint32Array(bins.length);
    for (let index = 0; index < bins.length; index += 1) {
      order[cursor[bins[index]]] = index;
      cursor[bins[index]] += 1;
    }
    return { order, starts, counts };
  }

  function drawBands(cloud, bins) {
    const { order, starts, counts } = orderByBin(bins);
    context.lineWidth = POINT_WEIGHT;
    context.lineCap = "round";

    for (let bin = 0; bin < COLOR_BINS; bin += 1) {
      const [red, green, blue] = hsbToRgb(binHue(bin), POINT_SATURATION, POINT_BRIGHTNESS);
      context.strokeStyle = `rgba(${red},${green},${blue},${POINT_ALPHA})`;
      const end = starts[bin] + counts[bin];
      for (let slot = starts[bin]; slot < end; slot += 1) {
        const index = order[slot];
        dot(cloud.xs[index], cloud.ys[index]);
      }
    }
  }

  /**
   * A thinner, paler layer over every third point, shifted by a fraction of a pixel. The
   * offset is what makes it visible: it lands beside the layer beneath rather than on top
   * of it, so only the densest contours accumulate enough to show.
   */
  function drawHighlight(cloud) {
    const [red, green, blue] = hsbToRgb(...HIGHLIGHT_COLOR);
    context.lineWidth = HIGHLIGHT_WEIGHT;
    context.strokeStyle = `rgba(${red},${green},${blue},${HIGHLIGHT_ALPHA})`;
    for (let index = 0; index < POINT_COUNT; index += HIGHLIGHT_STRIDE) {
      dot(cloud.xs[index] + HIGHLIGHT_OFFSET_X, cloud.ys[index] + HIGHLIGHT_OFFSET_Y);
    }
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
    p.noLoop();
  };

  p.draw = () => {
    p.colorMode(p.HSB, 360, 100, 100, 100);
    // Seeded here rather than in setup, so the image is a function of the seed alone.
    p.randomSeed(ART_SEED);
    p.background(...BACKGROUND);

    const orbit = calculateOrbit(
      p.random(-START_RANGE, START_RANGE),
      p.random(-START_RANGE, START_RANGE)
    );
    const cloud = fitToCanvas(orbit, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const bins = colorBins(orbit.ys);

    p.push();
    // The cloud is fitted to the logical canvas, so the export scale is a transform and a
    // larger export is the same figure at a higher resolution.
    p.scale(RENDER_SCALE);
    p.blendMode(p.ADD);
    drawBands(cloud, bins);
    drawHighlight(cloud);
    p.blendMode(p.BLEND);
    p.pop();

    window.__ARTWORK_STATE__ = {
      kind: "image",
      seed: ART_SEED,
      pointCount: POINT_COUNT,
      colorBins: COLOR_BINS,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});

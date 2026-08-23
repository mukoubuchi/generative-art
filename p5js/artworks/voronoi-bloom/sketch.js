import { hsbToRgb } from "../shared/color.js";
import {
  ART_SEED,
  HUE_HIGH,
  HUE_LOW,
  SITE_COUNT,
  createSites,
  nearestTwo,
  reachAt,
  shade
} from "./bloom.js";

/**
 * Forty-two seeds, and one radius that every front stands at.
 *
 * That is the whole of the clip, and it is also the whole of the diagram. A Voronoi cell
 * is the set of points a given seed reaches first, so a front standing at one radius has
 * arrived at a point exactly when that radius has passed the picture's own nearest-site
 * distance there, and two fronts arrive at a point at the same moment precisely when that
 * point is equally far from two seeds -- which is what a boundary is. Nothing here draws an
 * edge. The edges are where the fronts meet, and they light as they are met.
 *
 * The clock the radius is read off is the picture's own: it is set so that the same area
 * lights every frame, which spends the ten seconds on the diagram rather than on the
 * corners. What the diagram rests on is that the radius is one radius, not that it grows
 * at one rate.
 *
 * The shading is the picture's, untouched: every pixel's colour is the one the finished
 * image has always had, and the only thing time does is decide whether the front has got
 * there yet. So the last frame is the picture, pixel for pixel.
 */

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const TEXTURE_NOISE_X = 0.01125;
const TEXTURE_NOISE_Y = 0.0140625;
const VIGNETTE_SCALE = 0.72;
const GRAIN_COUNT = 15000;
const PLAYBACK_FPS = 30;
const SPREAD_SECONDS = 9;
const CLIP_SECONDS = SPREAD_SECONDS + 1;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;
const SPREAD_FRAMES = SPREAD_SECONDS * PLAYBACK_FPS;

/**
 * The deep the bloom is lit in: the artwork's own shading with both glows out of reach and
 * the vignette at its darkest, taken at the middle of the hue range the seeds are drawn
 * from. It is not a colour chosen for this clip -- it is what this picture's shading gives
 * a point that no front has arrived at, which is exactly what the unreached ground is.
 */
const UNLIT = (() => {
  const ink = shade(
    { hue: (HUE_LOW + HUE_HIGH) / 2 },
    { index: 0, nearest: Number.POSITIVE_INFINITY, gap: Number.POSITIVE_INFINITY },
    0.5,
    0
  );
  return hsbToRgb(ink.hue, ink.saturation, ink.brightness);
})();

const P5 = window.p5;

new P5((p) => {
  /**
   * The picture measured once: every pixel's finished colour, and how far it is from the
   * seed nearest it. Both are properties of the diagram rather than of the moment, so the
   * per-pixel work is done a single time and each frame is a walk over what it produced.
   * The measuring loop is the one this artwork has always had, in the order it had it, so
   * the numbers it caches are the numbers it used to write straight out.
   */
  let field = null;

  function measure(sites) {
    const xs = Float64Array.from(sites, (site) => site.x);
    const ys = Float64Array.from(sites, (site) => site.y);
    const measurement = { index: 0, nearest: 0, gap: 0 };

    const halfWidth = LOGICAL_WIDTH * 0.5;
    const halfHeight = LOGICAL_HEIGHT * 0.5;
    // The canvas is as many pixels across as the export scale asks for, times whatever the
    // display puts on top of that: on a Retina screen the backing store is twice the size
    // again. Writing a logical grid into a denser buffer fills one corner of it and leaves
    // the rest untouched, which is what put two copies of this picture in the top quarter
    // of the canvas on such a screen. So the density is read and the backing store is what
    // gets walked. At a density of one this is the loop it has always been, byte for byte;
    // above one the picture is computed at the resolution it is actually shown at.
    const density = p.pixelDensity();
    const backingWidth = OUTPUT_WIDTH * density;
    const backingHeight = OUTPUT_HEIGHT * density;
    const perLogical = RENDER_SCALE * density;
    const colours = new Uint8ClampedArray(backingWidth * backingHeight * 3);
    const reached = new Float32Array(backingWidth * backingHeight);
    let farthest = 0;
    for (let backingY = 0; backingY < backingHeight; backingY += 1) {
      // The sites live in logical coordinates, so the export scale raises the resolution
      // of the diagram without moving anything in it.
      const logicalY = backingY / perLogical;
      const normalizedY = (logicalY - halfHeight) / (LOGICAL_HEIGHT * VIGNETTE_SCALE);
      for (let backingX = 0; backingX < backingWidth; backingX += 1) {
        const logicalX = backingX / perLogical;
        nearestTwo(xs, ys, SITE_COUNT, logicalX, logicalY, measurement);
        const texture = p.noise(logicalX * TEXTURE_NOISE_X, logicalY * TEXTURE_NOISE_Y);
        const normalizedX = (logicalX - halfWidth) / (LOGICAL_WIDTH * VIGNETTE_SCALE);
        const vignette = Math.max(
          0,
          Math.min(1, 1 - normalizedX * normalizedX - normalizedY * normalizedY)
        );
        const ink = shade(sites[measurement.index], measurement, texture, vignette);
        const [red, green, blue] = hsbToRgb(ink.hue, ink.saturation, ink.brightness);
        const cell = backingX + backingY * backingWidth;
        colours[cell * 3] = red;
        colours[cell * 3 + 1] = green;
        colours[cell * 3 + 2] = blue;
        // The front travels at one speed, so the distance to the nearest seed is also the
        // time at which this pixel is reached. Measured in logical pixels, like the sites.
        reached[cell] = measurement.nearest;
        // Read back rather than kept: the table holds single-precision floats, and a
        // distance rounds up as often as down going into one. Taking the largest from the
        // table is what makes the last frame reach every pixel -- comparing the stored
        // value against the unrounded one left the single farthest pixel dark, and that
        // pixel is the difference between the clip's last frame and this artwork's still.
        if (reached[cell] > farthest) {
          farthest = reached[cell];
        }
      }
    }
    // Variant B: the same common radius for every front, read off a different clock. The
    // distances sorted are the radius at which each successive pixel is reached, so taking
    // the one a given share of the way along makes that share of the picture lit -- equal
    // area a frame instead of equal radius a frame. Every front still stands at one
    // radius at any instant, which is the whole of what makes the meeting places the
    // boundaries; what changes is only how the clock runs.
    const ordered = Float32Array.from(reached).sort();
    return { colours, reached, farthest, ordered, cells: backingWidth * backingHeight };
  }

  /** The picture as far as the fronts have got: reached pixels lit, the rest still deep. */
  function paintCells(reach) {
    p.loadPixels();
    const pixels = p.pixels;
    const { colours, reached, cells } = field;
    let lit = 0;
    for (let cell = 0; cell < cells; cell += 1) {
      const offset = cell * 4;
      if (reached[cell] <= reach) {
        pixels[offset] = colours[cell * 3];
        pixels[offset + 1] = colours[cell * 3 + 1];
        pixels[offset + 2] = colours[cell * 3 + 2];
        lit += 1;
      } else {
        pixels[offset] = UNLIT[0];
        pixels[offset + 1] = UNLIT[1];
        pixels[offset + 2] = UNLIT[2];
      }
      pixels[offset + 3] = 255;
    }
    p.updatePixels();
    return lit;
  }

  function drawSites(sites) {
    sites.forEach((site) => {
      p.noStroke();
      p.fill(site.hue, 18, 100, 82);
      p.circle(site.x, site.y, 2.4);
    });
  }

  function addGrain() {
    p.randomSeed(ART_SEED + 1);
    p.strokeWeight(1);
    for (let speck = 0; speck < GRAIN_COUNT; speck += 1) {
      const x = p.random(0, LOGICAL_WIDTH);
      const y = p.random(0, LOGICAL_HEIGHT);
      const alpha = p.random(1.5, 6.0);
      p.stroke(0, 0, p.random(0, 1) < 0.5 ? 100 : 0, alpha);
      p.point(x, y);
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
    p.frameRate(PLAYBACK_FPS);
    prepare();
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  let sites = null;

  /** Everything that does not depend on the moment, done once and in the old order. */
  function prepare() {
    // Seeded here rather than in setup, so the image is a function of the seed alone.
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    sites = createSites(
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      (low, high) => p.random(low, high),
      (x, y) => p.noise(x, y)
    );
    field = measure(sites);
  }

  function publishState(frameIndex, litPixels) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      seed: ART_SEED,
      siteCount: sites.length,
      litPixels,
      farthestReach: field.farthest,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  /** Paints the picture as far as the fronts have reached, and says how much they lit. */
  function drawFrame(frameIndex) {
    // One radius for every front, and the whole picture reached at the end of the spread.
    const part = Math.min(frameIndex / SPREAD_FRAMES, 1);
    const reach = reachAt(part, field.ordered, field.farthest);
    const lit = paintCells(reach);
    // The cells are painted through the pixel buffer, which ignores the transform, so the
    // scale applies only to the strokes drawn over them. The seeds and the grain are laid
    // over every frame, in the order the still laid them, so the last frame is the still.
    p.push();
    p.scale(RENDER_SCALE);
    drawSites(sites);
    addGrain();
    p.pop();
    return lit;
  }

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page spreads to the same schedule the clip follows, frame for frame, and then
    // holds the bloom.
    publishState(p.frameCount, drawFrame(p.frameCount));
    if (p.frameCount >= TOTAL_FRAMES) {
      p.noLoop();
    }
  };
});

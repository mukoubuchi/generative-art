import {
  FINEST_IN_OUTER_RADII,
  buildPacking,
  radiusOf,
  reachAt
} from "./apollonian-gasket.js";

/**
 * Every gap between three touching circles holds exactly one more, and where it goes was
 * settled by the three around it. The figure is drawn as the equation gives it: no circle
 * here was placed, fitted or chosen.
 *
 * The clip is the packing arriving in order of curvature. It opens on the four the whole
 * figure is given by, and then a threshold on the bend walks outward, doubling in equal
 * time: every circle appears at the moment the clock reaches its own curvature. Two things
 * come of that. Every frame is a whole packing rather than a half-drawn one -- the picture
 * at any moment is exactly this packing cut off at a curvature. And the three circles that
 * decide a fourth are always already on the page when it arrives, because a child's bend
 * is greater than all three of its parents', which is checked next door rather than
 * assumed. So a reader watching one circle appear is watching a gap being answered.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const OUTER_RADIUS = 306;

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const PLAYBACK_FPS = 30;

/**
 * Half a second on the four that are given, eight and a half of the cascade, and one on
 * the finished packing.
 *
 * The opening is not decoration. Descartes' rule needs three circles to decide a fourth,
 * so the four the packing starts from are the one thing in the picture that no gap
 * produced, and a reader who is shown them first can see every later circle as an answer.
 */
const GIVEN_FRAMES = 15;
const CASCADE_FRAMES = 255;
const HOLD_FRAMES = 30;
const TOTAL_FRAMES = GIVEN_FRAMES + CASCADE_FRAMES + HOLD_FRAMES;

/**
 * Kissing Circles' night and its arrival colours. That artwork fills each disc with the
 * colour of the moment it was laid, so its first giants glow ember and its last grains
 * arrive nearly white; here a disc arrives when the curvature clock reaches its bend, so
 * the four given circles are ember and the finest of the cascade are bone. The colour is
 * the clock read off the picture, and it runs with size only because the packing makes
 * the small arrive late.
 */
const NIGHT = [13, 18, 27];
const AGE_STOPS = [[196, 106, 74], [222, 158, 96], [236, 208, 160], [246, 244, 236]];

const CIRCLES = buildPacking();
/** The packing is built in its own units; this puts its outer circle on the page. */
const OUTER = CIRCLES.find((circle) => circle.bend < 0);
const UNITS_TO_PAGE = OUTER_RADIUS / radiusOf(OUTER);

/**
 * The curvature clock's two ends: the sharpest of the four given circles, and the sharpest
 * the packing is drawn down to. The outer circle's bend is negative -- it curves the other
 * way, holding the rest inside it -- so the clock reads the size of the bend and nothing
 * else.
 */
const BENDS = CIRCLES.map((circle) => Math.abs(circle.bend));
const GIVEN_BEND = Math.max(...BENDS.slice(0, 4));
const FINEST_BEND = Math.max(...BENDS);

const P5 = window.p5;

new P5((p) => {
  /**
   * How sharp a circle may curve and still be on the page at `frameIndex`.
   *
   * Equal time per doubling of the bend, which is the packing's own scale: it is built by
   * a rule that keeps applying to what it has just made, so a clock that counted circles
   * would spend nine tenths of the clip on hairlines and one tenth on everything a reader
   * can actually follow. Doubling in equal time gives the opposite and truer shape --
   * about a dozen circles in the first three seconds, each landing in a gap of its own,
   * and the last second bringing more than all the seconds before it.
   */
  function reachBy(frameIndex) {
    if (frameIndex <= GIVEN_FRAMES) {
      return GIVEN_BEND;
    }
    const part = (frameIndex - GIVEN_FRAMES) / CASCADE_FRAMES;
    return reachAt(part, GIVEN_BEND, FINEST_BEND);
  }

  /** A colour between Kissing Circles' stops, `part` of the way from ember to bone. */
  function stopColour(part) {
    const scaled = part * (AGE_STOPS.length - 1);
    const stop = Math.min(Math.floor(scaled), AGE_STOPS.length - 2);
    const within = scaled - stop;
    return AGE_STOPS[stop].map((value, i) => value + (AGE_STOPS[stop + 1][i] - value) * within);
  }

  /**
   * Where a bend falls on the curvature clock: nought for the given four, one for the
   * finest, and evenly per doubling between them, as `reachBy` walks it.
   */
  function arrival(bend) {
    if (bend <= GIVEN_BEND) return 0;
    return Math.log(bend / GIVEN_BEND) / Math.log(FINEST_BEND / GIVEN_BEND);
  }

  /**
   * The packing cut off at `reach`. The circles are walked in the order the construction
   * made them rather than in the order they arrive, so which stroke lies over which never
   * depends on how far the clip has got, and the last frame is this artwork's drawing
   * stroke for stroke.
   */
  function drawAll(reach = FINEST_BEND) {
    p.background(...NIGHT);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    let drawn = 0;
    CIRCLES.forEach((circle, index) => {
      if (BENDS[index] > reach) {
        return;
      }
      const radiusOnPage = radiusOf(circle) * UNITS_TO_PAGE;
      const x = circle.x * UNITS_TO_PAGE;
      const y = circle.y * UNITS_TO_PAGE;
      drawn += 1;
      if (circle.bend < 0) {
        // The outer circle holds the rest; it is a rim, never a disc.
        p.noFill();
        p.stroke(...AGE_STOPS[3], 150);
        p.strokeWeight(1);
        p.circle(x, y, 2 * radiusOnPage);
        return;
      }
      p.noStroke();
      p.fill(...stopColour(arrival(BENDS[index])));
      p.circle(x, y, 2 * radiusOnPage);
    });
    p.pop();
    return drawn;
  }

  function publishState(frameIndex, drawnCircles) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      drawnCircles,
      circles: CIRCLES.length,
      finestInOuterRadii: FINEST_IN_OUTER_RADII,
      smallestRadius: OUTER_RADIUS * FINEST_IN_OUTER_RADII,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  /** Draws the packing as far as `frameIndex` reaches, and says how many circles that was. */
  function drawFrame(frameIndex) {
    return drawAll(reachBy(frameIndex));
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page draws the same cascade the clip does, frame for frame, and then holds the
    // finished packing.
    publishState(p.frameCount, drawFrame(p.frameCount));
    if (p.frameCount >= TOTAL_FRAMES) {
      p.noLoop();
    }
  };
});

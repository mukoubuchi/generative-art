import {
  DISC_COUNT,
  DISC_DIAMETER_RATIO,
  RING_RADIUS_RATIO,
  STEPS_PER_SECOND,
  TURN_STEPS,
  ballAt,
  coveringRegion,
  frontDisc,
  paintingOrder,
  sweptCentreY
} from "./carousel.js";

// A landscape canvas, because the ring is one: the discs ride an ellipse the lean makes a
// third again as wide as it is tall -- it compresses the height by the sine of the lean
// and leaves the width alone -- and on a square the two ends of it ran off the sides.
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const RING_RADIUS = BASE_DIMENSION * RING_RADIUS_RATIO;
const DISC_DIAMETER = BASE_DIMENSION * DISC_DIAMETER_RATIO;
// The ring is drawn this much above the middle of the canvas, because perspective puts
// the figure it sweeps that much below its own centre. Asked of the ring rather than
// tuned by eye, so it follows the lean and the eye distance wherever they go.
const CENTRE_RISE = sweptCentreY(RING_RADIUS, DISC_DIAMETER / 2);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TURN_STEPS / STEPS_PER_FRAME;
/**
 * How many rows the boundary between two balls is found along. At a hundred and
 * twenty-eight the run stands off the true curve by under a quarter of a pixel at its
 * worst, which is finer than the edge either colour is drawn with.
 */
const EDGE_ROWS = 128;
/** Far enough outside the canvas that the cut shapes close where nothing is drawn. */
const OUT_OF_SIGHT = 20000;

/**
 * Two kinds, alternating around the ring: warm and light, cool and dark. Which is why
 * the disc that comes forward is always the opposite kind to the one before it — the
 * Book of Changes' line is the ring's arrangement, not a rule applied to it.
 */
const PAPER = [234, 227, 211];
const YANG = [[198, 66, 45], [214, 152, 58]];
const YIN = [[38, 42, 52], [56, 78, 112]];

/** Disc k is yang when k is even, and takes the k/2-th colour of its own family. */
function discColor(index) {
  return index % 2 === 0 ? YANG[index / 2] : YIN[(index - 1) / 2];
}

const P5 = window.p5;

new P5((p) => {
  /**
   * Four circles on paper, and nothing else — but they are balls, and they overlap.
   *
   * They were painted as flat discs, furthest first, and a reader saw the switch. Where
   * two of them cross, a flat disc covers everything its own outline covers, so at the
   * instant the two are equally far away the whole overlap changes hands in one frame:
   * two per cent of the canvas, gone from one colour to the other between two frames.
   *
   * The crowding is the reason, not a fault beside it. Two neighbours have to overlap on
   * the canvas for the ring to read as a cluster at all — a disc's radius has to beat the
   * ring's own half-height, over 118.9 here — and at the moment they hand over their
   * circles stand 268.6 apart, so as balls they would only clear each other at 113.2 or
   * less. There is no radius that crowds the ring and keeps the balls apart. They pass
   * through one another, and two balls that pass through one another meet on a circle.
   *
   * That circle is the boundary. Edge-on at the handover, so its shadow is the straight
   * line halfway between the two centres; turning as one draws ahead, so the shadow opens
   * and sweeps clear of the overlap over about a second and a third. What is drawn is
   * still four circles: each one is simply cut where a ball already painted stands in
   * front of it, and the shape cut away is bounded by that circle's shadow.
   *
   * Nothing here strokes anything. The context is asked for a path only to cut with, and
   * the one call that could put a stroke down — the default one p5 begins with — is
   * switched off before anything is drawn at all.
   */
  function render(step) {
    const turns = (step % TURN_STEPS) / TURN_STEPS;
    const balls = Array.from({ length: DISC_COUNT }, (unused, index) =>
      ballAt(index, turns, RING_RADIUS, DISC_DIAMETER / 2));
    const context = p.drawingContext;

    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - CENTRE_RISE);
    // Furthest first. Nothing here knows which disc that is; the ring is asked.
    const painted = [];
    for (const index of paintingOrder(turns)) {
      const ball = balls[index];
      context.save();
      for (const earlier of painted) {
        const region = coveringRegion(ball, balls[earlier], EDGE_ROWS);
        if (region === null) {
          continue;
        }
        // Everything, less the piece the earlier ball stands in front of: an outer square
        // and the cut shape inside it, taken by the even-odd rule so the inside is what
        // falls away. Successive cuts narrow what is left, which is what nesting does.
        context.beginPath();
        context.rect(-OUT_OF_SIGHT, -OUT_OF_SIGHT, 2 * OUT_OF_SIGHT, 2 * OUT_OF_SIGHT);
        context.moveTo(region[0].x, region[0].y);
        for (const point of region.slice(1)) {
          context.lineTo(point.x, point.y);
        }
        context.closePath();
        context.clip("evenodd");
      }
      const [red, green, blue] = discColor(index);
      p.fill(red, green, blue);
      p.circle(ball.x, ball.y, 2 * ball.radius);
      context.restore();
      painted.push(index);
    }
    p.pop();

    return { turns, front: frontDisc(turns) };
  }

  function publishState(frameIndex, state) {
    const published = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      turns: state.turns,
      frontDisc: state.front,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = published;
    window.__ARTWORK_READY__ = true;
    return published;
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
    if (CAPTURE_MODE) {
      p.noLoop();
      // Each frame is a pure function of its index, so any one can be drawn on its own.
      window.__renderFrame = (frameIndex) => Promise.resolve(
        publishState(frameIndex, render(frameIndex * STEPS_PER_FRAME))
      );
    }
    publishState(0, render(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    publishState(p.frameCount, render(p.frameCount * STEPS_PER_FRAME));
  };
});

import {
  DISC_COUNT,
  DISC_DIAMETER_RATIO,
  RING_RADIUS_RATIO,
  STEPS_PER_SECOND,
  TURN_STEPS,
  discPlace,
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
   * Four filled circles on paper, and nothing else at all.
   *
   * The path the discs ride used to be drawn under them, faintly. It was never once
   * visible on purpose: measured over the whole turn, every point of it lies inside some
   * disc at every step. What it did do was show — where two discs cross, neither edge
   * covers its pixel completely, and the faint line laid underneath came through the
   * seam as a short dark hair. So the ring is not drawn. Nothing here strokes anything,
   * which is the only way to be sure nothing can surface through a seam again.
   */
  function render(step) {
    const turns = (step % TURN_STEPS) / TURN_STEPS;

    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - CENTRE_RISE);
    // Furthest first. Nothing here knows which disc that is; the ring is asked.
    for (const index of paintingOrder(turns)) {
      const { x, y, scale } = discPlace(index, turns, RING_RADIUS);
      const [red, green, blue] = discColor(index);
      p.fill(red, green, blue);
      p.circle(x, y, DISC_DIAMETER * scale);
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

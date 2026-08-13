import {
  CYCLE_STEPS,
  STEPS_PER_SECOND,
  marksAt,
  stateAfter
} from "./illusion.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CYCLES = 3;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The original placed the inducers a quarter of the canvas from the middle and drew them a
// third of the canvas across, so the figure reaches five sixths of the way to the edge.
// These are the proportions the figure was composed at and they are left exactly alone.
const INDUCER_DISTANCE = BASE_DIMENSION / 4;
const INDUCER_DIAMETER = BASE_DIMENSION / 3;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_STEPS = CYCLES * CYCLE_STEPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;

/**
 * Paper and ink. The figure is black on off-white, as it has to be — the illusion is a
 * brightness illusion, and a viewer reports the square as *lighter* than the page, so the
 * page cannot already be the lightest thing on it. The warmth is the only liberty taken:
 * a cooler black against a warm ground, which keeps the contrast the illusion needs while
 * the picture stops being a diagram.
 */
const PAPER = [226, 220, 206];
const INK = [22, 20, 26];
/**
 * How far the real quadrilateral is lifted from the paper towards white. A Kanizsa surface
 * is seen as brighter than the ground it is cut from, so the drawn square is painted at
 * that seen brightness rather than at the paper's own: matching the paper exactly would
 * make the reveal show nothing, and going near white would make it a flash. There is no
 * measurement that settles this number — it is chosen to sit where the eye had already
 * put the surface.
 */
const SURFACE_LIFT = 0.15;
const SURFACE = PAPER.map((channel) => channel + SURFACE_LIFT * (255 - channel));
/**
 * The quadrilateral's corners sit exactly on the disc centres, so while it lies on the
 * square its edges run along the bites' own straight edges. Two exactly abutting fills
 * leave an antialiased hairline, so the paint alone is carried half a pixel past the
 * geometry. The corners are half the diagonal out, so lifting the edges by half a pixel
 * is this much scale.
 */
const SEAM_CLOSE = 1 + (0.5 * Math.SQRT2) / INDUCER_DISTANCE;

const P5 = window.p5;

new P5((p) => {
  /**
   * The whole picture, painted from the list the module hands over. A wedge is an arc and
   * nothing else; there is no branch here that draws a line, and the square's sides are
   * never among the arguments. The one mark that is not a wedge is the quadrilateral of
   * the reveal, and it is painted in the paper's own colour: the square that was never
   * there arrives as the ground showing through the discs, which is what it always was.
   */
  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noStroke();
    for (const mark of marksAt(step, INDUCER_DISTANCE, INDUCER_DIAMETER)) {
      if (mark.kind === "wedge") {
        p.fill(...INK);
        p.arc(mark.x, mark.y, 2 * mark.radius, 2 * mark.radius, mark.from, mark.to, p.PIE);
        continue;
      }
      // kind === "quadrilateral": the figure owning up, on the same four centres, painted
      // at the brightness the square was already being seen at and faded rather than
      // switched. No stroke: the boundary is a difference of lightness and nothing else,
      // which is the only kind of boundary this artwork is entitled to draw.
      p.fill(...SURFACE, 255 * mark.presence);
      p.beginShape();
      for (const corner of mark.corners) {
        p.vertex(corner.x * SEAM_CLOSE, corner.y * SEAM_CLOSE);
      }
      p.endShape(p.CLOSE);
    }
    p.pop();
  }

  function publishState(frameIndex, step) {
    const state = stateAfter(step);
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      step,
      cycleSteps: CYCLE_STEPS,
      stateIndex: state.index,
      angle: state.angle,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
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
      // Every frame is a pure function of its index, so any frame stands alone.
      window.__renderFrame = (frameIndex) => {
        const step = frameIndex * STEPS_PER_FRAME;
        drawStep(step);
        return Promise.resolve(publishState(frameIndex, step));
      };
    }
    drawStep(0);
    publishState(0, 0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const step = (p.frameCount * STEPS_PER_FRAME) % TOTAL_STEPS;
    drawStep(step);
    publishState(p.frameCount, step);
  };
});

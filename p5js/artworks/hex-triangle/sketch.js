import {
  CYCLES,
  PATH_RADIUS_RATIO,
  STEPS_PER_CYCLE,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  TRIANGLE_COUNT,
  TRIANGLE_RADIUS_RATIO,
  trianglesAt,
  triangleShape
} from "./orbit.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The original's hexagon radius was a third of its canvas; the path and triangle radii
// follow from it, and together they reach 0.866 of the half-canvas.
const HEXAGON_RADIUS = BASE_DIMENSION / 3;
const PATH_RADIUS = HEXAGON_RADIUS * PATH_RADIUS_RATIO;
const TRIANGLE_RADIUS = PATH_RADIUS * TRIANGLE_RADIUS_RATIO;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;

/**
 * Paper and ink, and both are Kanizsa Square's: the same off-white it is drawn on, and now
 * the same near-black its bites are cut in. One ink, on every triangle, at every step.
 *
 * The colour used to say two things at once — a warm family and a cool one, each washed
 * into the paper while the six stood apart and at full strength as they closed. Neither is
 * a thing the paint has to carry. The two families already point opposite ways, which is
 * visible in the shapes themselves, and the convergence is the walk. What the paint was
 * doing instead was keeping the six apart at the one moment they are not: six marks of one
 * black tile into a black hexagon, where six marks of two colours stay six marks arranged
 * in a ring.
 *
 * The numbers are written out rather than imported. Each artwork here stands on its own,
 * so a borrowed colour is a borrowed value with a note saying whose it is.
 */
const GROUND = [226, 220, 206];
const INK = [22, 20, 26];
/** Half a pixel of paint, so shapes that meet exactly do not show the ground between. */
const SEAM_CLOSE = 1 + 0.5 / TRIANGLE_RADIUS;

const P5 = window.p5;

new P5((p) => {
  /**
   * Six filled triangles on paper, and nothing else.
   *
   * The two paths they walk — the triangles of the hexagram — used to be stroked faintly
   * underneath. They stood still while everything else moved, so what they read as was
   * not a path but scaffolding somebody had forgotten to rub out. The walk teaches the
   * paths in a couple of seconds anyway, which is the argument for drawing them and the
   * argument against: a line nobody needs to be shown is a line that can only be noticed
   * as a mistake. Switching the stroke off is not housekeeping — p5 begins with a black
   * one a pixel wide, and it was the guides' own last call that used to turn it off.
   */
  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    // Set once, outside the walk: there is no longer anything in here that picks a colour,
    // neither from a triangle's place in the list nor from where the six have got to.
    p.fill(...INK);
    for (const placed of trianglesAt(step, PATH_RADIUS)) {
      p.beginShape();
      for (const vertex of triangleShape(TRIANGLE_RADIUS, placed.rotation)) {
        // Drawn a whisker larger than it is. The six meet exactly, and two shapes that
        // meet exactly leave an antialiased hairline between them — six of which meet
        // at the centre and leave a speck of the ground showing through the middle of
        // the figure the artwork is about. The geometry is untouched; only the paint
        // overlaps, by about half a pixel.
        p.vertex(placed.x + vertex.x * SEAM_CLOSE, placed.y + vertex.y * SEAM_CLOSE);
      }
      p.endShape(p.CLOSE);
    }
    p.pop();
  }

  function publishState(frameIndex, step) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      step,
      cycleSteps: STEPS_PER_CYCLE,
      cycles: CYCLES,
      triangleCount: TRIANGLE_COUNT,
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
      // Every frame is a function of its step alone, so any frame index can be asked for
      // in any order and always comes out the same.
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
    const step = p.frameCount * STEPS_PER_FRAME;
    drawStep(step);
    publishState(p.frameCount, step);
  };
});

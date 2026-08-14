import {
  CYCLES,
  PATH_COUNT,
  PATH_RADIUS_RATIO,
  STEPS_PER_CYCLE,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  TRIANGLE_COUNT,
  TRIANGLE_RADIUS_RATIO,
  gatheringAt,
  pathCorners,
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
 * Two colours on paper, and they are two of Toggle Color Ball's: the warm one its yang
 * discs wear and the cool one its yin discs do, which is the same opposition this figure
 * is made of — one family of triangles rising, one falling.
 *
 * Each family is one colour and shows twice. Which shade a triangle wears is not its
 * number in a list: it is how gathered the six are at that moment, a distance the module
 * measures. Washed into the paper while they stand apart at the corners, full-strength as
 * they close, so the figure's colour is its own convergence and there are still two of
 * them. The ground is the paper Kanizsa Square is drawn on.
 */
const GROUND = [226, 220, 206];
const RISING = [[214, 155, 138], [198, 66, 45]];
const FALLING = [[155, 160, 167], [56, 78, 112]];
const GUIDE = [154, 148, 134];
/** Half a pixel of paint, so shapes that meet exactly do not show the ground between. */
const SEAM_CLOSE = 1 + 0.5 / TRIANGLE_RADIUS;

function mix(from, to, amount) {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ];
}

const P5 = window.p5;

new P5((p) => {
  /** The two triangles the six walk around, which together are the hexagram. */
  function drawGuides() {
    p.noFill();
    p.stroke(GUIDE[0], GUIDE[1], GUIDE[2], 60);
    p.strokeWeight(1);
    for (let pathIndex = 0; pathIndex < PATH_COUNT; pathIndex += 1) {
      p.beginShape();
      for (const point of pathCorners(pathIndex, PATH_RADIUS)) {
        p.vertex(point.x, point.y);
      }
      p.endShape(p.CLOSE);
    }
    p.noStroke();
  }

  function drawStep(step) {
    const gathering = gatheringAt(step);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    drawGuides();
    trianglesAt(step, PATH_RADIUS).forEach((placed, index) => {
      const family = index < TRIANGLE_COUNT / PATH_COUNT ? RISING : FALLING;
      const [red, green, blue] = mix(family[0], family[1], gathering);
      p.fill(red, green, blue);
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
    });
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
      gathering: gatheringAt(step),
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

import {
  bandVertices,
  fadeAlpha,
  generationRange,
  stripTriangles,
  zoomScale
} from "./geometry.js";

/**
 * The shell in amber, growing without end. The camera pulls back by exactly one
 * doubling over the clip, so every whorl slides into its elder's place and the loop
 * closes on its opening frame; a new greatest whorl swings in from beyond the rim,
 * which is where an ammonite does its growing. Everything the ink does — width,
 * light — is keyed to distance from the pole on screen, because only a picture whose
 * rules are self-similar can coincide with itself one generation later.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CLIP_SECONDS = 10;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;

/** Where generation zero's inner rim sits at zoom one, in logical pixels. */
const BASE_RADIUS = 30;
/** The bottomless centre fades in across these screen radii. */
const FADE_FROM = 3;
const FADE_TO = 26;
/** Past the corner nothing can show; the range of drawn generations stops there. */
const CORNER_RADIUS = Math.hypot(LOGICAL_WIDTH, LOGICAL_HEIGHT) / 2 + 40;
/** Ink width as a share of a triangle's own distance from the pole: self-similar. */
const WEIGHT_RATIO = 0.008;

/** The dark the fossil lies in, and the amber it is drawn with. */
const GROUND = [13, 11, 9];
const AMBER = [222, 166, 104];
const PEAK_ALPHA = 225;

const P5 = window.p5;

new P5((p) => {
  function drawShell(frameIndex) {
    const zoom = zoomScale(frameIndex, TOTAL_FRAMES);
    const generations = generationRange(zoom, BASE_RADIUS, 1, CORNER_RADIUS);
    let triangleCount = 0;

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noFill();
    for (const generation of generations) {
      const screenVertices = bandVertices(generation).map((vertex) => ({
        x: vertex.x * BASE_RADIUS * zoom,
        y: vertex.y * BASE_RADIUS * zoom
      }));
      for (const triangle of stripTriangles(screenVertices)) {
        const reach = triangle.reduce(
          (sum, corner) => sum + Math.hypot(corner.x, corner.y),
          0
        ) / 3;
        const alpha = fadeAlpha(reach, FADE_FROM, FADE_TO);
        if (alpha === 0) {
          continue;
        }
        p.stroke(...AMBER, PEAK_ALPHA * alpha);
        p.strokeWeight(Math.max(reach * WEIGHT_RATIO, 0.2));
        p.triangle(
          triangle[0].x, triangle[0].y,
          triangle[1].x, triangle[1].y,
          triangle[2].x, triangle[2].y
        );
        triangleCount += 1;
      }
    }
    p.pop();
    return { zoom, generations, triangleCount };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      zoom: drawn.zoom,
      generations: drawn.generations,
      triangleCount: drawn.triangleCount,
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
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => {
        const drawn = drawShell(frameIndex);
        return Promise.resolve(publishState(frameIndex, drawn));
      };
    }
    publishState(0, drawShell(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page simply lives the loop: frame 300 is frame 0, so the growth never ends.
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawShell(frameIndex));
  };
});

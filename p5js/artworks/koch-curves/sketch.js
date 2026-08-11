import {
  GENERATIONS,
  TOTAL_FRAMES,
  eruptionSegments,
  generationSegments,
  sceneAt
} from "./substitution.js";

/**
 * The law made audible: each generation of the substitution erupts faster than the one
 * before, because each multiplies the rim by the same factor and the accelerando is
 * the divergence worn as rhythm. During an eruption every rising peak carries a warm
 * spark that cools as it settles into the ice of the standing line — the law's touch,
 * visible for the moment it acts. Where Hilbert Curve refines in stillness, sliding
 * points along an unbroken arc at an even pace, this curve folds outward, all its
 * peaks at once, in less and less time.
 */
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
/** The square's side on canvas; the bumps stay inside the frame at this share. */
const SQUARE_SIDE = BASE_DIMENSION * 0.56;
const SQUARE_LEFT = (LOGICAL_WIDTH - SQUARE_SIDE) / 2;
const SQUARE_TOP = (LOGICAL_HEIGHT - SQUARE_SIDE) / 2;
const STROKE_PX = 1.5;

/** Winter night, standing ice, and the warm touch of the law as a peak rises. */
const GROUND = [10, 14, 22];
const ICE = [216, 232, 246];
const SPARK = [255, 208, 116];

const P5 = window.p5;

new P5((p) => {
  function drawCurve(frameIndex) {
    const scene = sceneAt(frameIndex);
    const erupting = scene.blend > 0;
    const segments = erupting
      ? eruptionSegments(scene.generation, scene.blend)
      : generationSegments(scene.generation);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(SQUARE_LEFT, SQUARE_TOP);
    p.scale(SQUARE_SIDE);
    p.strokeWeight(STROKE_PX / SQUARE_SIDE);
    segments.forEach((segment, index) => {
      // Mid-eruption the second and third of every four are the rising pair.
      const rising = erupting && (index % 4 === 1 || index % 4 === 2);
      if (rising) {
        const warmth = 1 - scene.blend;
        p.stroke(
          ICE[0] + (SPARK[0] - ICE[0]) * warmth,
          ICE[1] + (SPARK[1] - ICE[1]) * warmth,
          ICE[2] + (SPARK[2] - ICE[2]) * warmth
        );
      } else {
        p.stroke(...ICE);
      }
      p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    });
    p.pop();
    return { scene, segmentCount: segments.length };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      generation: drawn.scene.generation,
      blend: drawn.scene.blend,
      generations: GENERATIONS,
      segmentCount: drawn.segmentCount,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawCurve(frameIndex)));
    }
    publishState(0, drawCurve(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawCurve(frameIndex));
  };
});

import {
  NESTING_TURN,
  TOTAL_FRAMES,
  fadeAlpha,
  generationRange,
  pentagramSegments,
  stageRotation,
  zoomScale
} from "./nesting.js";

/**
 * The dive. Five chords make a star, the star's crossings make a smaller pentagon
 * turned half a step, and the camera falls toward it at the one rate — phi squared
 * per loop — that brings the picture back onto itself exactly: the centre being
 * approached turns out to be the whole being left. Everything the ink does is keyed
 * to distance from the centre on screen, because only self-similar rules let the
 * loop close without a seam.
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

/** Generation zero's circumradius at zoom one, in logical pixels. */
const BASE_RADIUS = 300;
const FADE_FROM = 1.2;
const FADE_TO = 20;
const CORNER_RADIUS = Math.hypot(LOGICAL_WIDTH, LOGICAL_HEIGHT) / 2 + 40;
/** Ink width as a share of a star's own screen radius: self-similar. */
const WEIGHT_RATIO = 0.009;

const GROUND = [10, 12, 18];
const STARLIGHT = [202, 192, 232];
const PEAK_ALPHA = 240;

const P5 = window.p5;

new P5((p) => {
  function drawNest(frameIndex) {
    const zoom = zoomScale(frameIndex, TOTAL_FRAMES);
    const spin = stageRotation(frameIndex, TOTAL_FRAMES);
    const generations = generationRange(zoom, BASE_RADIUS, FADE_FROM, CORNER_RADIUS);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noFill();
    for (const generation of generations) {
      const screenRadius = BASE_RADIUS * zoom * (0.3819660112501051 ** generation);
      const alpha = fadeAlpha(screenRadius, FADE_FROM, FADE_TO);
      if (alpha === 0) {
        continue;
      }
      p.stroke(...STARLIGHT, PEAK_ALPHA * alpha);
      p.strokeWeight(Math.max(screenRadius * WEIGHT_RATIO, 0.3));
      for (const chord of pentagramSegments(screenRadius, spin + generation * NESTING_TURN)) {
        p.line(chord.start.x, chord.start.y, chord.end.x, chord.end.y);
      }
    }
    p.pop();
    return { zoom, generations };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      zoom: drawn.zoom,
      generations: drawn.generations,
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
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawNest(frameIndex)));
    }
    publishState(0, drawNest(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawNest(frameIndex));
  };
});

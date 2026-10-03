import {
  ART_SEED, DURATION_SECONDS, FIELD_GRID_SIZE, LOGICAL_SIZE,
  MODES, MODE_SUM, PLAYBACK_FPS, TOTAL_FRAMES,
  createGrains, excitationAt, nearNodeFraction, nextPageFrame, reachFrame
} from "./field.js";
import { createGrainView } from "./grains.js";

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

new window.p5((p) => {
  let grains;
  let view;
  let startedAt;
  let shownFrame = 0;

  function drawUpTo(frameIndex) {
    const reached = reachFrame(grains, frameIndex);
    grains = reached.grains;
    const requested = reached.frame;
    view.draw(grains);
    p.drawingContext.drawImage(view.canvas, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const drive = excitationAt(requested / PLAYBACK_FPS);
    const state = {
      kind: "video", frameIndex: requested, totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS, steps: grains.steps,
      grainCount: grains.count, seed: ART_SEED,
      modeSum: MODE_SUM, negativeLaplacianEigenvalue: MODE_SUM * Math.PI ** 2,
      modes: MODES, stroke: drive.index,
      amplitude: drive.amplitude, fieldGridSize: FIELD_GRID_SIZE,
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    return state;
  }

  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    grains = createGrains();
    view = createGrainView(CAPTURE_MODE ? RENDER_SCALE : Math.min(2, p.pixelDensity()));
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawUpTo(frameIndex)));
      window.__grainProbe = () => ({
        near2px: nearNodeFraction(grains, window.__ARTWORK_STATE__.stroke, 2),
        near4px: nearNodeFraction(grains, window.__ARTWORK_STATE__.stroke, 4),
        maximumSpeed: grains.vx.reduce((maximum, vx, k) => Math.max(maximum, Math.hypot(vx, grains.vy[k])), 0),
        minimumX: grains.x.reduce((minimum, x) => Math.min(minimum, x), 1),
        maximumX: grains.x.reduce((maximum, x) => Math.max(maximum, x), 0)
      });
    }
    publishState(drawUpTo(0));
    startedAt = window.performance.now();
  };

  p.draw = () => {
    if (CAPTURE_MODE) return;
    const elapsed = (window.performance.now() - startedAt) / 1000;
    shownFrame = nextPageFrame(shownFrame, elapsed);
    publishState(drawUpTo(shownFrame));
    // A finite performance: ring down into the final figure and leave it there.
    if (shownFrame === TOTAL_FRAMES - 1) p.noLoop();
  };
});

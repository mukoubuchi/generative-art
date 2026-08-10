import { buildArtwork, countSegments } from "./geometry.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const DRAW_SECONDS = 12;
const HOLD_SECONDS = 1.5;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const ROOT_RADIUS = BASE_DIMENSION * 0.4;
const MINIMUM_EDGE_LENGTH = BASE_DIMENSION * 0.01;
const STROKE_WEIGHT = BASE_DIMENSION * 0.0015;

const drawSteps = buildArtwork(
  { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 },
  ROOT_RADIUS,
  MINIMUM_EDGE_LENGTH
);
const framesPerStep = Math.max(
  1,
  Math.round(DRAW_SECONDS * PLAYBACK_FPS / drawSteps.length)
);
const totalFrames = Math.round((DRAW_SECONDS + HOLD_SECONDS) * PLAYBACK_FPS);
let requestedFrame = 0;
let resolveRenderedFrame;

function renderSegments(p, segments) {
  for (const segment of segments) {
    p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
  }
}

function renderSteps(p, steps, visibleSteps) {
  for (let stepIndex = 0; stepIndex < visibleSteps; stepIndex += 1) {
    renderSegments(p, steps[stepIndex]);
  }
}

const P5 = window.p5;

new P5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
    }
    window.__renderFrame = (frameIndex) => new Promise((resolve) => {
      requestedFrame = frameIndex;
      resolveRenderedFrame = resolve;
      p.redraw();
    });
  };

  p.draw = () => {
    const frameIndex = CAPTURE_MODE ? requestedFrame : p.frameCount - 1;
    const visibleSteps = Math.min(
      drawSteps.length,
      Math.floor(frameIndex / framesPerStep) + 1
    );

    p.background(255);
    p.scale(RENDER_SCALE);
    p.stroke(18);
    p.strokeWeight(STROKE_WEIGHT);
    renderSteps(p, drawSteps, visibleSteps);

    const state = {
      kind: "video",
      frameIndex,
      totalFrames,
      visibleSteps,
      drawStepCount: drawSteps.length,
      segmentCount: countSegments(drawSteps),
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;

    if (resolveRenderedFrame) {
      resolveRenderedFrame(state);
      resolveRenderedFrame = undefined;
    }
    if (!CAPTURE_MODE && p.frameCount >= totalFrames) {
      p.noLoop();
    }
  };
});

import {
  BUILD_FRAMES,
  TOTAL_FRAMES,
  arcPoints,
  buildCells,
  generationOf,
  partitionLines,
  rectangleCorners,
  rootRectangle,
  wavePlan
} from "./spiral.js";

/**
 * The cascade watched happening. One wave per generation: a cell's partition lines
 * appear first — the rectangle split into its square and its two children — and then
 * its arc sweeps through the square just cut. Every branch is the whole figure again,
 * and the colour says so: each generation wears its own step of a garden gradient,
 * deep moss at the root out to pale spring at the four-hundred-and-fifth leaf, the
 * waves arriving a settled share faster each time. The finished spiral holds, then
 * the loop begins the garden over.
 */
const LOGICAL_WIDTH = 795;
const LOGICAL_HEIGHT = 600;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const MARGIN = LOGICAL_HEIGHT * (20 / 600);
const MINIMUM_SQUARE_SIDE = LOGICAL_HEIGHT * (5 / 600);
const ARC_VERTEX_SPACING = LOGICAL_HEIGHT * (4 / 600);
const PARTITION_WEIGHT = LOGICAL_HEIGHT * (0.75 / 600);
const ARC_WEIGHT = LOGICAL_HEIGHT * (1.35 / 600);

/** A dark garden, faint scaffolding, and the branches' green by generation. */
const GROUND = [12, 14, 12];
const PARTITION_INK = [120, 124, 116, 96];
const MOSS = [58, 96, 72];
const SPRING = [198, 228, 186];

const ROOT = rootRectangle(LOGICAL_WIDTH, LOGICAL_HEIGHT, MARGIN);
const CELLS = buildCells(ROOT, MINIMUM_SQUARE_SIDE).map((cell) => ({
  ...cell,
  generation: generationOf(ROOT, cell),
  largePoints: arcPoints(cell.largeBranchArc, ARC_VERTEX_SPACING),
  smallPoints: arcPoints(cell.smallBranchArc, ARC_VERTEX_SPACING)
}));
const GENERATIONS = Math.max(...CELLS.map((cell) => cell.generation)) + 1;
const WAVES = wavePlan(GENERATIONS);
/** Within a wave, the split shows first and the arc sweeps through what it cut. */
const SPLIT_SHARE = 0.38;

function greenFor(generation) {
  const blend = generation / (GENERATIONS - 1);
  return MOSS.map((channel, index) => channel + (SPRING[index] - channel) * blend);
}

const P5 = window.p5;

new P5((p) => {
  function polyline(points, limit) {
    p.beginShape();
    const count = Math.min(points.length, limit);
    for (let index = 0; index < count; index += 1) {
      p.vertex(points[index].x, points[index].y);
    }
    p.endShape();
  }

  function drawCascade(frameIndex) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.noFill();

    let arcsSweeping = 0;
    for (const cell of CELLS) {
      const wave = WAVES[cell.generation];
      const within = (frameIndex - wave.start) / wave.frames;
      if (within <= 0) {
        continue;
      }
      const splitProgress = Math.min(within / SPLIT_SHARE, 1);
      p.stroke(...PARTITION_INK);
      p.strokeWeight(PARTITION_WEIGHT);
      if (cell.generation === 0 && frameIndex >= wave.start) {
        polyline([...rectangleCorners(ROOT), rectangleCorners(ROOT)[0]], Infinity);
      }
      for (const [start, end] of partitionLines(cell)) {
        p.line(
          start.x,
          start.y,
          start.x + (end.x - start.x) * splitProgress,
          start.y + (end.y - start.y) * splitProgress
        );
      }

      const sweep = Math.min(Math.max((within - SPLIT_SHARE) / (1 - SPLIT_SHARE), 0), 1);
      if (sweep > 0) {
        if (sweep < 1) {
          arcsSweeping += 1;
        }
        p.stroke(...greenFor(cell.generation));
        p.strokeWeight(ARC_WEIGHT);
        polyline(cell.largePoints, Math.ceil(cell.largePoints.length * sweep));
        polyline(cell.smallPoints, Math.ceil(cell.smallPoints.length * sweep));
      }
    }
    p.pop();
    return { arcsSweeping };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      cells: CELLS.length,
      generations: GENERATIONS,
      buildFrames: BUILD_FRAMES,
      arcsSweeping: drawn.arcsSweeping,
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
        Promise.resolve(publishState(frameIndex, drawCascade(frameIndex)));
    }
    publishState(0, drawCascade(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawCascade(frameIndex));
  };
});

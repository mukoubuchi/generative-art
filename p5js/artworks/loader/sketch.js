import {
  CYCLE_STEPS,
  ROTATION_STEP_DEGREES,
  STEPS_PER_SECOND,
  SWEEP_DEGREES,
  advance,
  stateAfter,
  trackAges,
  visualSpan
} from "./simulation.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CYCLES = 5;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The indicator's proportions are the classic ones this artwork has always had: the
// stroke is 2/5 of the outer radius and the arc's centre line 4/5 of it, the whole
// figure scaled to 4/10 of the canvas so it has a margin to spin in.
const ARC_OUTER_RADIUS = BASE_DIMENSION * 0.4;
const STROKE_WEIGHT = ARC_OUTER_RADIUS * (20 / 50);
const ARC_DIAMETER = 2 * ARC_OUTER_RADIUS * (40 / 50);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CYCLES * CYCLE_STEPS / STEPS_PER_FRAME;
// The clip opens mid-growth, half the sweep spread, and a whole cycle into the machine's
// life, so the fading track is already complete: the bright leading edge stands exactly
// where the ring is oldest, about to repaint it. The reader arrives, as Qoheleth did,
// long after the labour began.
const OPENING_GROWTH_STEPS = 30;
const FIRST_STEP = CYCLE_STEPS + OPENING_GROWTH_STEPS;

/**
 * The ring is read at this many angles when the track is worn as light. Half-degree
 * cells come to about two output pixels of arc, finer than the eye separates.
 */
const TRACK_CELLS = 720;
const CELL_DEGREES = 360 / TRACK_CELLS;
/** A whisker of overlap so adjacent opaque cells cannot leave hairline gaps. */
const CELL_OVERLAP_DEGREES = 0.1;

/** The night the ring is laid on. */
const GROUND = [15, 14, 19];
/** The live arc: lamplight gold, unmistakably above everything it retraces. */
const LIVE_GOLD = [255, 211, 122];
/** The track's colour stops, young to old: gold cooling through amber into ember. */
const TRACK_YOUNG = [235, 178, 96];
const TRACK_OLD = [96, 58, 30];
/**
 * How fast the track fades, in steps, and the glow it never fades below. The floor keeps
 * the whole ring legible — the past dims, but nothing the arc has painted ever reads as
 * missing — while the peak stays well under the live arc, so the protagonist is never in
 * doubt.
 */
const FADE_STEPS = 45;
const FLOOR_ALPHA = 70;
const PEAK_ALPHA = 150;

function mix(from, to, amount) {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ];
}

/**
 * The colour a track cell of the given age wears, already blended onto the ground.
 * Painting opaque colours instead of stacking translucent ones keeps neighbouring cells
 * from doubling up where they meet.
 */
function trackColor(age) {
  const wear = Math.min(age / CYCLE_STEPS, 1);
  const tone = mix(TRACK_YOUNG, TRACK_OLD, wear);
  const alpha = (FLOOR_ALPHA + (PEAK_ALPHA - FLOOR_ALPHA) * Math.exp(-age / FADE_STEPS))
    / 255;
  return mix(GROUND, tone, alpha);
}

const liveState = { step: FIRST_STEP, machine: stateAfter(FIRST_STEP) };

const P5 = window.p5;

new P5((p) => {
  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noFill();
    p.strokeWeight(STROKE_WEIGHT);
    p.strokeCap(p.SQUARE);

    // The track: every point of the ring lit by how recently the arc last passed it.
    // What sits just ahead of the live arc is the faintest light — its own previous
    // pass, one cycle old, about to be laid down again exactly.
    const ages = trackAges(step, TRACK_CELLS);
    for (let cell = 0; cell < TRACK_CELLS; cell += 1) {
      if (ages[cell] === 0) {
        continue;
      }
      p.stroke(...trackColor(ages[cell]));
      const from = cell * CELL_DEGREES - CELL_OVERLAP_DEGREES;
      const to = (cell + 1) * CELL_DEGREES + CELL_OVERLAP_DEGREES;
      p.arc(0, 0, ARC_DIAMETER, ARC_DIAMETER, p.radians(from), p.radians(to), p.OPEN);
    }

    // The live arc, drawn exactly rather than in cells, so its ends stay crisp.
    const span = visualSpan(stateAfter(step));
    p.stroke(...LIVE_GOLD);
    p.arc(
      0,
      0,
      ARC_DIAMETER,
      ARC_DIAMETER,
      p.radians(span.start),
      p.radians(span.end),
      p.OPEN
    );
    p.pop();
  }

  function publishState(frameIndex, step) {
    const span = visualSpan(stateAfter(step));
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      cycleSteps: CYCLE_STEPS,
      sweepDegrees: span.end - span.start,
      rotationStepDegrees: ROTATION_STEP_DEGREES,
      fullSweepDegrees: SWEEP_DEGREES,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Nothing accumulates between frames: every frame is recomputed from its step
      // index alone, so any frame is reproducible on its own.
      window.__renderFrame = (frameIndex) => {
        const step = FIRST_STEP + frameIndex * STEPS_PER_FRAME;
        drawStep(step);
        return Promise.resolve(publishState(frameIndex, step));
      };
    }
    drawStep(liveState.step);
    publishState(0, liveState.step);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      advance(liveState.machine);
    }
    liveState.step += STEPS_PER_FRAME;
    drawStep(liveState.step);
    publishState(p.frameCount, liveState.step);
  };
});

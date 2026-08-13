import {
  INNERMOST_RATIO,
  SPOT_COUNT,
  STEPS_PER_SECOND,
  radiusRatio,
  realignmentSteps,
  spotPosition
} from "./wave.js";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 480;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// Ratios of the Processing sketch's 700x350 canvas: orbit 300, baseline 25, dot 10.
const ORBIT_RADIUS = BASE_DIMENSION * (300 / 350);
const BASELINE_OFFSET = BASE_DIMENSION * (25 / 350);
const SPOT_DIAMETER = BASE_DIMENSION * (10 / 350);
// The clip is exactly one realignment of the ladder, which the module computes.
const TOTAL_STEPS = realignmentSteps();
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
/**
 * How many steps of its own past each spot carries behind it. The original laid one
 * dot per step over a faint wash and let the canvas remember, which made every frame
 * depend on all the frames before it — and, because an eight-bit wash cannot subtract
 * less than one level, never quite forgot: a permanent lattice of every position ever
 * visited built up under the live wave. Drawing the last few positions outright costs
 * three hundred circles a frame, keeps the bead texture and the gathering at the ends
 * of the arcs, and makes every frame a pure function of its own index, so any frame
 * can be rebuilt alone and the closing one is the opening one exactly.
 */
const COMET_STEPS = 15;

/** Night, and the two ends of the ladder: the quick heart, the slow rim. */
const GROUND = [6, 7, 12];
const SUN_GOLD = [255, 206, 122];
const STAR_BLUE = [128, 176, 236];
const BASELINE = [70, 82, 110];
/**
 * How long a comet is decides what the artwork is about. Draw a spot's whole arc and
 * the picture becomes twenty filled domes with the live wave lost inside them; draw a
 * dozen steps and what the eye reads is the ensemble's present shape, which is the
 * thing the ladder is for, while the tail still says which way each spot is going and
 * how fast.
 */
const COMET_FAINTEST = 12;

let liveStep = 0;

const P5 = window.p5;

new P5((p) => {
  function mix(from, to, amount) {
    return [
      from[0] + (to[0] - from[0]) * amount,
      from[1] + (to[1] - from[1]) * amount,
      from[2] + (to[2] - from[2]) * amount
    ];
  }

  /**
   * Colour is the arc a spot rides: gold at the quick centre, blue at the slow rim.
   * It is keyed to the radius, and stretched across the radii that actually occur —
   * the nest stops a third of the way in, so reading the raw ratio as the colour would
   * spend only the top two thirds of the palette and never arrive at the gold.
   */
  const SPOT_COLORS = Array.from({ length: SPOT_COUNT }, (unused, index) => {
    const spread = (radiusRatio(index) - INNERMOST_RATIO) / (1 - INNERMOST_RATIO);
    return mix(SUN_GOLD, STAR_BLUE, spread);
  });

  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.noStroke();
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - BASELINE_OFFSET);
    // The rail the arcs are struck from, which every sweep begins and ends on.
    p.stroke(BASELINE[0], BASELINE[1], BASELINE[2], 40);
    p.strokeWeight(1);
    p.line(-ORBIT_RADIUS, 0, ORBIT_RADIUS, 0);
    p.noStroke();

    // The tails first, oldest and faintest at the back. Where a spot dwells — the two
    // ends of its arc — its own past bunches up and the bead brightens, which is the
    // pendulum's dwell drawn by nothing but overlap.
    for (let age = COMET_STEPS; age >= 1; age -= 1) {
      const fade = 1 - age / (COMET_STEPS + 1);
      for (let index = 0; index < SPOT_COUNT; index += 1) {
        const { x, y } = spotPosition(index, step - age, ORBIT_RADIUS);
        const [red, green, blue] = SPOT_COLORS[index];
        p.fill(red, green, blue, COMET_FAINTEST + (150 - COMET_FAINTEST) * fade ** 2);
        p.circle(x, y, SPOT_DIAMETER * (0.45 + 0.5 * fade));
      }
    }

    // Then the live spots. Only the halo is added to what is under it — a core added
    // the same way would saturate to white and throw away the one thing the colour
    // carries, which is where on the ladder a spot sits — so the halo glows and the
    // core keeps its own colour.
    const places = Array.from({ length: SPOT_COUNT }, (unused, index) =>
      spotPosition(index, step, ORBIT_RADIUS)
    );
    p.blendMode(p.ADD);
    places.forEach(({ x, y }, index) => {
      const [red, green, blue] = SPOT_COLORS[index];
      p.fill(red, green, blue, 30);
      p.circle(x, y, SPOT_DIAMETER * 2.8);
    });
    p.blendMode(p.BLEND);
    places.forEach(({ x, y }, index) => {
      const [red, green, blue] = SPOT_COLORS[index];
      p.fill(red, green, blue, 246);
      p.circle(x, y, SPOT_DIAMETER);
    });
    p.pop();
  }

  function publishState(step) {
    const state = {
      kind: "video",
      frameIndex: Math.round(step / STEPS_PER_FRAME),
      totalFrames: TOTAL_FRAMES,
      spotCount: SPOT_COUNT,
      step,
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
      // Every frame is a pure function of its index, so any frame stands alone.
      window.__renderFrame = (frameIndex) => {
        const step = frameIndex * STEPS_PER_FRAME;
        drawStep(step);
        return Promise.resolve(publishState(step));
      };
    }
    drawStep(0);
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      // Frames are driven entirely by __renderFrame.
      return;
    }
    // The page runs on forever; the ladder simply repeats every realignment.
    liveStep = (liveStep + STEPS_PER_FRAME) % TOTAL_STEPS;
    drawStep(liveStep);
    publishState(liveStep);
  };
});

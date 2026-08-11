import { RIBBON_STEPS, ribbonPair } from "./lorenz.js";

/**
 * Two ribbons on the Lorenz attractor, grown side by side. They begin one part in ten
 * thousand apart — closer than a pixel will ever show — and the clip simply lets them
 * run: together through the first turns, indistinguishable, then parting onto different
 * wings for good. Determinism and unpredictability in one picture, with no randomness
 * anywhere in the code.
 *
 * The ribbons are shaded by height, so the depth of the figure reads without lighting
 * machinery: the low passes near the wings' outer rims sit dark, the climbs over the
 * saddle bright.
 */
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;
const PLAYBACK_FPS = 30;
const GROWTH_FRAMES = 250;
const HOLD_FRAMES = 50;
const TOTAL_FRAMES = GROWTH_FRAMES + HOLD_FRAMES;
const SAMPLES_PER_FRAME = RIBBON_STEPS / GROWTH_FRAMES;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

// The stage: the attractor's height stood upright, the wings angled towards the viewer,
// the whole figure scaled from the model's units into the frame and centred on the
// saddle's height.
const MODEL_SCALE = 8.9;
const CENTER_HEIGHT = 24.5;
const WING_ANGLE = -0.62;
const RIBBON_HALF_WIDTH = 0.55;
// The tilted projection throws the figure off the frame's middle; measured from a
// render and pulled back.
const SCREEN_SHIFT_X = 0;
const SCREEN_SHIFT_Y = 66;

const BACKGROUND = [13, 18, 27];
// Height's colour, floor to crown, one ramp per ribbon: the leader in ember and gold,
// the follower in steel and ice. Where they travel together the braid alternates; once
// they part, each wing carries whichever ribbon claimed it.
const LEADER_RAMP = [[122, 62, 46], [214, 148, 88], [246, 210, 140]];
const FOLLOWER_RAMP = [[42, 66, 104], [110, 152, 198], [214, 234, 248]];

const { leader, follower } = ribbonPair();

function rampColor(ramp, t) {
  const scaled = t * (ramp.length - 1);
  const stop = Math.min(Math.floor(scaled), ramp.length - 2);
  const within = scaled - stop;
  return ramp[stop].map(
    (channel, index) => channel + (ramp[stop + 1][index] - channel) * within
  );
}

/** Side vectors for the ribbon: perpendicular to the path, flat to the height axis. */
function sideVectors(points) {
  const sides = [];
  let previous = [RIBBON_HALF_WIDTH, 0, 0];
  for (let index = 0; index < points.length; index += 1) {
    const before = points[Math.max(index - 1, 0)];
    const after = points[Math.min(index + 1, points.length - 1)];
    const tangentX = after[0] - before[0];
    const tangentY = after[1] - before[1];
    // Cross the tangent with the vertical: a side that stays level, so the ribbon
    // banks like a road rather than twisting freely.
    const length = Math.hypot(tangentX, tangentY);
    if (length > 1e-9) {
      previous = [
        (-tangentY / length) * RIBBON_HALF_WIDTH,
        (tangentX / length) * RIBBON_HALF_WIDTH,
        0
      ];
    }
    sides.push(previous);
  }
  return sides;
}

const LEADER_SIDES = sideVectors(leader);
const FOLLOWER_SIDES = sideVectors(follower);

const P5 = window.p5;

new P5((p) => {
  function drawRibbon(points, sides, ramp, upTo) {
    p.beginShape(p.TRIANGLE_STRIP);
    for (let index = 0; index <= upTo; index += 1) {
      const [x, y, z] = points[index];
      const [sideX, sideY, sideZ] = sides[index];
      const height = Math.max(0, Math.min(1, z / 50));
      p.fill(...rampColor(ramp, height));
      p.vertex(x + sideX, y + sideY, z + sideZ);
      p.vertex(x - sideX, y - sideY, z - sideZ);
    }
    p.endShape();
  }

  function drawHead(point, ramp) {
    const [x, y, z] = point;
    p.push();
    p.translate(x, y, z);
    p.fill(...rampColor(ramp, 1));
    p.sphere(RIBBON_HALF_WIDTH * 2.2, 10, 8);
    p.pop();
  }

  function drawFrame(frameIndex) {
    const upTo = Math.min(
      RIBBON_STEPS,
      Math.max(1, (Math.min(frameIndex, GROWTH_FRAMES) + 1) * SAMPLES_PER_FRAME)
    );
    p.background(...BACKGROUND);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(SCREEN_SHIFT_X, SCREEN_SHIFT_Y);
    p.rotateX(Math.PI / 2);
    p.rotateY(WING_ANGLE);
    p.scale(MODEL_SCALE);
    p.translate(0, 0, -CENTER_HEIGHT);
    p.noStroke();
    drawRibbon(leader, LEADER_SIDES, LEADER_RAMP, upTo);
    drawRibbon(follower, FOLLOWER_SIDES, FOLLOWER_RAMP, upTo);
    if (upTo < RIBBON_STEPS) {
      drawHead(leader[upTo], LEADER_RAMP);
      drawHead(follower[upTo], FOLLOWER_RAMP);
    }
    p.pop();
    return upTo;
  }

  function publishState(frameIndex, drawnSamples) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      drawnSamples,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT, p.WEBGL).parent("artwork");
    p.setAttributes("preserveDrawingBuffer", true);
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});

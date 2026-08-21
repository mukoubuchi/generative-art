import { pinLogicalCamera } from "../shared/camera-scale.js";
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
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
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
//
// The scale and the two shifts are one setting rather than three, and none of them can be
// reasoned out from the model's units. All three act in camera space under a perspective
// projection, so a point nearer the eye moves further across the frame than a point behind
// it: a shift stretches the silhouette as well as moving it, and a change to either shift
// changes what the scale fills. They are therefore measured together, against the union of
// all 300 frames' silhouettes — which is not the last frame's, because the two heads that
// lead the growing ribbons swing wider than the ribbon does and put the union's edges where
// no single frame has them.
//
// At these three values that union is 596 by 592 on the 680 square frame: 42 pixels clear
// of the left, 42 of the right, 44 of the top, 44 of the bottom. Their predecessors — 8.9,
// 0 and 66, on an 800 by 600 frame — left a 386 by 393 figure with 181, 233, 128 and 79,
// which is a figure very nearly square adrift in a frame that was not.
const MODEL_SCALE = 12.93;
const CENTER_HEIGHT = 24.5;
const WING_ANGLE = -0.62;
const RIBBON_HALF_WIDTH = 0.55;
const SCREEN_SHIFT_X = 15.5;
const SCREEN_SHIFT_Y = 76;

const BACKGROUND = [13, 18, 27];
// Height's colour, floor to crown, one ramp per ribbon, and neither ramp is new here:
// the leader wears Kissing Circles' ages, fired clay up to nearly white-hot, and the
// follower wears Nautilus's, abyss teal up through sea glass and sand to pearl. Two
// families the collection already owns, so the pair reads as warm against cool without
// a colour being invented for it. Where the ribbons travel together the braid
// alternates; once they part, each wing carries whichever ribbon claimed it.
const LEADER_RAMP = [[196, 106, 74], [222, 158, 96], [236, 208, 160], [246, 244, 236]];
const FOLLOWER_RAMP = [[24, 86, 88], [88, 144, 128], [196, 178, 132], [252, 238, 200]];

/**
 * The growing tip as a light. The reach and the core are in logical pixels, the stage's
 * own scale having been undone before either is drawn.
 */
const HEAD_HALO = 34;
const HEAD_HALO_LAYERS = 14;
const HEAD_HALO_ALPHA = 16;
/**
 * Where on its ribbon's ramp a head takes its halo. Both ramps have four stops, so a
 * third of the way along is exactly the second of them -- gold for the leader, sea glass
 * for the follower -- which is where each family is most recognisably itself.
 */
const HEAD_HALO_STOP = 1 / 3;
const HEAD_CORE = 5;
const HEAD_CORE_ALPHA = 90;

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
    // Undo the stage, in the order that cancels it: the scale first, being uniform and
    // free to move, then the two turns in reverse. What is left is the camera's own
    // plane, which is where a flat disc has to lie to read as a light rather than as a
    // coin seen edge-on -- and edge-on is exactly what the stage's quarter turn would
    // otherwise make of it.
    p.scale(1 / MODEL_SCALE);
    p.rotateY(-WING_ANGLE);
    p.rotateX(-Math.PI / 2);
    // Layered light, not a bead: nested discs of the ribbon's own family colour, added
    // rather than painted over, so the middle of the stack is where the most light has
    // fallen. Not the crown, for the halo. Both crowns are within a few levels of white,
    // and two white haloes would be one light that happened to be in two places; the
    // second stop keeps the leader's warm and the follower's cool all the way in to the
    // core, which measures [255,234,188] against [185,226,208].
    for (let layer = HEAD_HALO_LAYERS; layer >= 1; layer -= 1) {
      p.fill(...rampColor(ramp, HEAD_HALO_STOP), HEAD_HALO_ALPHA);
      p.circle(0, 0, 2 * HEAD_HALO * layer / HEAD_HALO_LAYERS);
    }
    p.fill(...rampColor(ramp, 1), HEAD_CORE_ALPHA);
    p.circle(0, 0, 2 * HEAD_CORE);
    p.pop();
  }

  function drawFrame(frameIndex) {
    const upTo = Math.min(
      RIBBON_STEPS,
      Math.max(1, (Math.min(frameIndex, GROWTH_FRAMES) + 1) * SAMPLES_PER_FRAME)
    );
    p.background(...BACKGROUND);
    p.push();
    p.translate(SCREEN_SHIFT_X, SCREEN_SHIFT_Y);
    p.rotateX(Math.PI / 2);
    p.rotateY(WING_ANGLE);
    p.scale(MODEL_SCALE);
    p.translate(0, 0, -CENTER_HEIGHT);
    p.noStroke();
    drawRibbon(leader, LEADER_SIDES, LEADER_RAMP, upTo);
    drawRibbon(follower, FOLLOWER_SIDES, FOLLOWER_RAMP, upTo);
    if (upTo < RIBBON_STEPS) {
      // Light rather than paint, and it answers to no depth at all. The fourteen discs of
      // a halo share one plane, so a stack tested against the buffer would show one disc
      // and throw away the other thirteen. Turning the test off costs the head its
      // occlusion -- a ribbon nearer the eye no longer cuts it -- and that is the right
      // trade twice over: the head is the one light in the picture, and light spilling
      // over what stands in front of it is what light does. Measured, too. With the test
      // left on, the head at frame 125 came out at [167,128,93], a dull smear behind the
      // ribbon it had just laid; with it off, [233,227,181], which is a light.
      const gl = p.drawingContext;
      p.blendMode(p.ADD);
      gl.disable(gl.DEPTH_TEST);
      drawHead(leader[upTo], LEADER_RAMP);
      drawHead(follower[upTo], FOLLOWER_RAMP);
      gl.enable(gl.DEPTH_TEST);
      p.blendMode(p.BLEND);
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
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT, p.WEBGL).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists. Before it, p5 has
    // nothing to set the density on and the call is quietly ignored; on a Retina screen
    // the backing store then comes out twice the size asked for. Left alone in the
    // browser, so a reader on such a screen gets the picture drawn at their own
    // resolution -- and pinned here, so an export is the size the manifest says
    // rather than whatever density the machine doing the rendering happens to have.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.setAttributes("preserveDrawingBuffer", true);
    // An export is this same view at more pixels, not a larger model in a larger frame.
    pinLogicalCamera(p, LOGICAL_HEIGHT, OUTPUT_WIDTH, OUTPUT_HEIGHT);
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

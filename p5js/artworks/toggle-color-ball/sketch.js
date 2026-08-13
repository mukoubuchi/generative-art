import {
  DISC_COUNT,
  STEPS_PER_SECOND,
  TURN_STEPS,
  discPlace,
  frontDisc,
  paintingOrder
} from "./carousel.js";

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
// The Processing sketch swung by 200 on a 600 px canvas and drew discs of 280, so the
// discs were larger than their own swing and ran past the canvas edge. The ring keeps
// that crowding — the discs still overlap deeply, which is what makes the order they
// are painted in the whole subject — but gives back enough room for the ring itself to
// be a shape rather than a row.
const RING_RADIUS = BASE_DIMENSION * (175 / 600);
const DISC_DIAMETER = BASE_DIMENSION * (252 / 600);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TURN_STEPS / STEPS_PER_FRAME;

/**
 * Two kinds, alternating around the ring: warm and light, cool and dark. Which is why
 * the disc that comes forward is always the opposite kind to the one before it — the
 * Book of Changes' line is the ring's arrangement, not a rule applied to it.
 */
const PAPER = [234, 227, 211];
const YANG = [[198, 66, 45], [214, 152, 58]];
const YIN = [[38, 42, 52], [56, 78, 112]];
const RING_INK = [120, 110, 96];

/** Disc k is yang when k is even, and takes the k/2-th colour of its own family. */
function discColor(index) {
  return index % 2 === 0 ? YANG[index / 2] : YIN[(index - 1) / 2];
}

const P5 = window.p5;

new P5((p) => {
  /** The path the discs ride, drawn faintly: the ring, seen from where we are. */
  function drawRing(turns) {
    p.noFill();
    p.stroke(RING_INK[0], RING_INK[1], RING_INK[2], 60);
    p.strokeWeight(1.2);
    p.beginShape();
    for (let sample = 0; sample <= 120; sample += 1) {
      // The ring's own points, borrowed from a disc's placement at each fraction.
      const { x, y } = discPlace(0, sample / 120, RING_RADIUS);
      p.vertex(x, y);
    }
    p.endShape(p.CLOSE);
    p.noStroke();
  }

  function render(step) {
    const turns = (step % TURN_STEPS) / TURN_STEPS;

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    drawRing(turns);
    // Furthest first. Nothing here knows which disc that is; the ring is asked.
    for (const index of paintingOrder(turns)) {
      const { x, y, scale } = discPlace(index, turns, RING_RADIUS);
      const [red, green, blue] = discColor(index);
      p.fill(red, green, blue);
      p.circle(x, y, DISC_DIAMETER * scale);
    }
    p.pop();

    return { turns, front: frontDisc(turns) };
  }

  function publishState(frameIndex, state) {
    const published = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      turns: state.turns,
      frontDisc: state.front,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = published;
    window.__ARTWORK_READY__ = true;
    return published;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Each frame is a pure function of its index, so any one can be drawn on its own.
      window.__renderFrame = (frameIndex) => Promise.resolve(
        publishState(frameIndex, render(frameIndex * STEPS_PER_FRAME))
      );
    }
    publishState(0, render(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    publishState(p.frameCount, render(p.frameCount * STEPS_PER_FRAME));
  };
});

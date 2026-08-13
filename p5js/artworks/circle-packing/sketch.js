import { PACKING_PARAMETERS, packCircles } from "./packing.js";

/**
 * Greedy circle packing, coloured by arrival. Nothing chose the size hierarchy: darts
 * land uniformly at random, each keeps the largest circle its landing allows, and the
 * early ones claim the open country while the late ones make do with the gaps between
 * gaps. Reading the colours is reading the clock — the packing wears its own history,
 * the way the frost wears its age.
 *
 * The page throws the darts in order, skipping the misses; the capture takes the
 * finished square.
 */
const LOGICAL_SIZE = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

const REVEAL_SECONDS = 8;

const BACKGROUND = [13, 18, 27];
// Arrival's colour: the early giants glow ember-warm, the mid generation cools through
// clay, and the last grains that fit anywhere at all arrive nearly white-hot small.
const AGE_STOPS = [
  [196, 106, 74],
  [222, 158, 96],
  [236, 208, 160],
  [246, 244, 236]
];

const CIRCLES = packCircles(PACKING_PARAMETERS);

function ageColor(index) {
  const scaled = (index / (CIRCLES.length - 1)) * (AGE_STOPS.length - 1);
  const stop = Math.min(Math.floor(scaled), AGE_STOPS.length - 2);
  const within = scaled - stop;
  return AGE_STOPS[stop].map(
    (channel, componentIndex) =>
      channel + (AGE_STOPS[stop + 1][componentIndex] - channel) * within
  );
}

const P5 = window.p5;

new P5((p) => {
  let revealed = 0;

  function drawCircles(from, to) {
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    for (let index = from; index < to; index += 1) {
      const circle = CIRCLES[index];
      p.fill(...ageColor(circle.index));
      p.circle(circle.x * LOGICAL_SIZE, circle.y * LOGICAL_SIZE, 2 * circle.radius * LOGICAL_SIZE);
    }
    p.pop();
  }

  function publishState(revealedCircles) {
    window.__ARTWORK_STATE__ = {
      kind: "image",
      circles: CIRCLES.length,
      seed: PACKING_PARAMETERS.seed,
      revealedCircles,
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_READY__ = true;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
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
    p.background(...BACKGROUND);
    if (CAPTURE_MODE) {
      p.noLoop();
      drawCircles(0, CIRCLES.length);
      publishState(CIRCLES.length);
      return;
    }
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE || revealed >= CIRCLES.length) {
      return;
    }
    // Nothing clears: the square fills the way the packing filled, largest first.
    const next = Math.min(
      revealed + Math.ceil(CIRCLES.length / (REVEAL_SECONDS * PLAYBACK_FPS)),
      CIRCLES.length
    );
    drawCircles(revealed, next);
    revealed = next;
    publishState(revealed);
  };
});

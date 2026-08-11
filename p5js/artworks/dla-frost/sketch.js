import { growCluster } from "./cluster.js";

/**
 * Frost grown on night glass: six thousand walkers wander in from the dark and freeze
 * where they first touch. No rule says "branch" — the branches are the shadow the tips
 * cast over the interior, made visible. Colour is age: the oldest cells at the heart
 * sit deep and glacial, the newest tips flare pale, so the crystal wears its own
 * history as its light.
 *
 * The page grows the crystal in arrival order, because the growth is the phenomenon;
 * the capture takes the finished pane.
 */
const LOGICAL_SIZE = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

const PARTICLES = 6000;
const SEED = 7;
const PREFERRED_CELL = 2;
const REVEAL_SECONDS = 9;

const BACKGROUND = [13, 18, 27];
// Age's colour, oldest first: glacial depths, then ice, then the pale growing edge.
const AGE_STOPS = [
  [66, 96, 138],
  [128, 168, 202],
  [201, 224, 240],
  [244, 250, 255]
];

const CLUSTER = growCluster({ particles: PARTICLES, seed: SEED });

/*
 * A grown thing is not obliged to grow symmetrically, and this one leans where its seed
 * sent it. As with the shells and the cube, what is centred is the figure's own
 * envelope rather than its origin — and the cell size gives way only if the reach this
 * particular seed managed would not otherwise fit inside the margins.
 */
const BOUNDS = CLUSTER.reduce(
  (bounds, { x, y }) => ({
    minX: Math.min(bounds.minX, x),
    maxX: Math.max(bounds.maxX, x),
    minY: Math.min(bounds.minY, y),
    maxY: Math.max(bounds.maxY, y)
  }),
  { minX: 0, maxX: 0, minY: 0, maxY: 0 }
);
const CELLS_ACROSS = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxY - BOUNDS.minY) + 1;
const CELL = Math.min(PREFERRED_CELL, (LOGICAL_SIZE * 0.94) / CELLS_ACROSS);
const CENTER_X = (BOUNDS.minX + BOUNDS.maxX) / 2;
const CENTER_Y = (BOUNDS.minY + BOUNDS.maxY) / 2;

function ageColor(index) {
  const scaled = (index / (PARTICLES - 1)) * (AGE_STOPS.length - 1);
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

  function drawParticles(from, to) {
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    for (let index = from; index < to; index += 1) {
      const particle = CLUSTER[index];
      p.fill(...ageColor(particle.index));
      p.rect(
        LOGICAL_SIZE / 2 + (particle.x - CENTER_X) * CELL - CELL / 2,
        LOGICAL_SIZE / 2 - (particle.y - CENTER_Y) * CELL - CELL / 2,
        CELL,
        CELL
      );
    }
    p.pop();
  }

  function publishState(revealedParticles) {
    window.__ARTWORK_STATE__ = {
      kind: "image",
      particles: PARTICLES,
      seed: SEED,
      revealedParticles,
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_READY__ = true;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    p.background(...BACKGROUND);
    if (CAPTURE_MODE) {
      p.noLoop();
      drawParticles(0, PARTICLES);
      publishState(PARTICLES);
      return;
    }
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE || revealed >= PARTICLES) {
      return;
    }
    // Nothing clears: the crystal accumulates on the pane the way it grew.
    const next = Math.min(
      revealed + Math.ceil(PARTICLES / (REVEAL_SECONDS * PLAYBACK_FPS)),
      PARTICLES
    );
    drawParticles(revealed, next);
    revealed = next;
    publishState(revealed);
  };
});

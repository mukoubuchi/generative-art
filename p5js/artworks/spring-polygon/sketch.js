import { hintMode } from "../shared/hint-mode.js";
import { drawKeyHint } from "../shared/key-hint.js";
import { STEPS_PER_SECOND, createNetwork, grab, release, step, totalSpeed } from "./network.js";
import { TOTAL_STEPS, networkAfter } from "./scenario.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
/** A press grabs the nearest bob and a release lets the springs settle it. */
const HINT_LEGEND = [
  { cap: "drag", text: "pull a bob and let it settle" }
];
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// Ratios of the Processing sketch's 600 px canvas: rest length 100, bob radius 32,
// anchor square 15, stroke 2.
const REST_LENGTH = BASE_DIMENSION * (100 / 600);
const BOB_MASS = BASE_DIMENSION * (32 / 600);
const ANCHOR_SIZE = BASE_DIMENSION * (15 / 600);
const STROKE_WEIGHT = BASE_DIMENSION * (2 / 600);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const NETWORK_OPTIONS = {
  centerX: LOGICAL_WIDTH / 2,
  centerY: LOGICAL_HEIGHT / 2,
  restLength: REST_LENGTH,
  mass: BOB_MASS,
  dragTarget: { x: LOGICAL_WIDTH * 0.9, y: LOGICAL_HEIGHT * 0.2 }
};

const liveNetwork = createNetwork(NETWORK_OPTIONS);

const P5 = window.p5;

new P5((p) => {
  function render(network) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.stroke(0);
    p.strokeWeight(STROKE_WEIGHT);

    network.anchors.forEach((anchor, index) => {
      p.line(network.bobs[index].x, network.bobs[index].y, anchor.x, anchor.y);
      p.fill(175);
      p.rectMode(p.CENTER);
      p.rect(anchor.x, anchor.y, ANCHOR_SIZE, ANCHOR_SIZE);
    });

    for (const bob of network.bobs) {
      for (const other of network.bobs) {
        p.line(bob.x, bob.y, other.x, other.y);
      }
    }

    for (const bob of network.bobs) {
      p.fill(bob.dragging ? 50 : 175);
      p.ellipse(bob.x, bob.y, BOB_MASS * 2, BOB_MASS * 2);
    }
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }

    return network;
  }

  function publishState(frameIndex, network) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      bobCount: network.bobs.length,
      totalSpeed: totalSpeed(network),
      dragging: network.bobs.some((bob) => bob.dragging),
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
      // The scenario is replayed from rest for every frame, so any index stands alone.
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(
        frameIndex,
        render(networkAfter(frameIndex * STEPS_PER_FRAME, NETWORK_OPTIONS))
      ));
    }
    publishState(0, render(liveNetwork));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const pointer = { x: p.mouseX, y: p.mouseY };
    for (let index = 0; index < STEPS_PER_FRAME; index += 1) {
      step(liveNetwork, pointer);
    }
    publishState(p.frameCount, render(liveNetwork));
  };

  p.mousePressed = () => {
    grab(liveNetwork, { x: p.mouseX, y: p.mouseY });
    return true;
  };

  p.mouseReleased = () => {
    release(liveNetwork);
    return true;
  };
});

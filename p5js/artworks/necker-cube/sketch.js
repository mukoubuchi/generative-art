import { hintMode } from "../shared/hint-mode.js";
import { drawKeyHint } from "../shared/key-hint.js";
import { angleAt, envelope, stripQuads, stripVertices } from "./cube.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CLIP_SECONDS = 6;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
/** The pointer's horizontal position sets the viewing angle. */
const HINT_LEGEND = [
  { cap: "move", text: "the pointer turns the cube" }
];
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The original's edge length was a third of its canvas, and its stroke two pixels of six
// hundred. Both are kept as ratios so the figure is the same at any canvas size.
const RADIUS = BASE_DIMENSION / 3;
const STROKE_WEIGHT = BASE_DIMENSION * (2 / 600);
// The Processing sketch never called this out, but the drawing is turned a quarter turn
// after being placed, so the projected ellipse stands upright.
const FIGURE_ROTATION = Math.PI / 2;
const BACKGROUND = 204;
const TOTAL_FRAMES = PLAYBACK_FPS * CLIP_SECONDS;

// Every far corner trails one radius behind its near corner, so the envelope of the whole
// rotation reaches a radius further one way than the other and the anchor is not its
// middle. Placing the anchor half a radius past the centre puts the envelope on it.
const bounds = envelope(RADIUS);
const ANCHOR_X = LOGICAL_WIDTH / 2;
const ANCHOR_Y = LOGICAL_HEIGHT / 2 - (bounds.left + bounds.right) / 2;

const P5 = window.p5;

new P5((p) => {
  function drawAngle(angle) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(BACKGROUND);
    p.translate(ANCHOR_X, ANCHOR_Y);
    p.rotate(FIGURE_ROTATION);
    p.noFill();
    p.stroke(0);
    p.strokeWeight(STROKE_WEIGHT);
    for (const quad of stripQuads(stripVertices(angle, RADIUS))) {
      p.beginShape();
      for (const vertex of quad) {
        p.vertex(vertex.x, vertex.y);
      }
      p.endShape(p.CLOSE);
    }
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
  }

  function publishState(frameIndex, pointerX, angle) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      pointerX,
      angle,
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
      // The capture walks the pointer from the left edge to just short of the right one,
      // so the clip turns the cube exactly once and its last frame meets its first.
      window.__renderFrame = (frameIndex) => {
        const pointerX = frameIndex * LOGICAL_WIDTH / TOTAL_FRAMES;
        const angle = angleAt(pointerX, LOGICAL_WIDTH);
        drawAngle(angle);
        return Promise.resolve(publishState(frameIndex, pointerX, angle));
      };
    }
    drawAngle(angleAt(0, LOGICAL_WIDTH));
    publishState(0, 0, angleAt(0, LOGICAL_WIDTH));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const pointerX = p.constrain(p.mouseX, 0, LOGICAL_WIDTH);
    const angle = angleAt(pointerX, LOGICAL_WIDTH);
    drawAngle(angle);
    publishState(p.frameCount, pointerX, angle);
  };
});

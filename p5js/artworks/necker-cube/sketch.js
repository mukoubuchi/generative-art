import { hintMode } from "../shared/hint-mode.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  EDGES,
  FACES,
  REST_TURNS,
  ROCK_TURNS,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  declarationAt,
  frontFace,
  shadowAt,
  turnsAt
} from "./cube.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "move", text: "turns the cube" },
  { cap: "press", text: "declares a reading" }
];
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const HALF_EDGE = BASE_DIMENSION * 0.23;
const STROKE_WEIGHT = BASE_DIMENSION * (2.6 / 600);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;

/** The wall, the firelight the shadow is cast in, and a tint for each reading. */
const WALL = [26, 22, 20];
const SHADOW = [238, 226, 200];
const FIRST_READING = [236, 152, 68];
const SECOND_READING = [96, 190, 208];

let liveTurns = 0;
let liveReading = 0;
let pressCount = 0;

const P5 = window.p5;

new P5((p) => {
  /**
   * The shadow, and — only when a reading is being declared — the one thing the two
   * readings disagree about: which face is nearest. The wireframe itself is identical
   * either way and is never touched, which is the artwork's whole claim.
   */
  function drawStep(turns, declaration) {
    const corners = shadowAt(turns, HALF_EDGE);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...WALL);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    if (declaration.reading !== 0 && declaration.amount > 0) {
      const tint = declaration.reading > 0 ? FIRST_READING : SECOND_READING;
      const face = FACES[frontFace(turns, declaration.reading, HALF_EDGE)];
      p.noStroke();
      p.fill(tint[0], tint[1], tint[2], 132 * declaration.amount);
      p.beginShape();
      for (const corner of face) {
        p.vertex(corners[corner].x, corners[corner].y);
      }
      p.endShape(p.CLOSE);
    }

    p.noFill();
    p.stroke(...SHADOW);
    p.strokeWeight(STROKE_WEIGHT);
    for (const [from, to] of EDGES) {
      p.line(corners[from].x, corners[from].y, corners[to].x, corners[to].y);
    }
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
  }

  function publishState(frameIndex, turns, declaration) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      turns,
      reading: declaration.reading,
      declared: declaration.amount,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
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
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index: the cube turns once over the clip
      // and the declarations follow the plan, so any frame can be drawn on its own.
      window.__renderFrame = (frameIndex) => {
        const step = frameIndex * STEPS_PER_FRAME;
        const turns = turnsAt(step);
        const declaration = declarationAt(step);
        drawStep(turns, declaration);
        return Promise.resolve(publishState(frameIndex, turns, declaration));
      };
    }
    drawStep(turnsAt(0), { reading: 0, amount: 0 });
    publishState(0, turnsAt(0), { reading: 0, amount: 0 });
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The pointer turns the cube, as it always has. Crossing the canvas rocks it
    // through the same span the clip does, so the page never flattens it either.
    const across = p.constrain(p.mouseX, 0, LOGICAL_WIDTH) / LOGICAL_WIDTH;
    liveTurns = REST_TURNS + ROCK_TURNS * (2 * across - 1);
    const declaration = { reading: liveReading, amount: liveReading === 0 ? 0 : 1 };
    drawStep(liveTurns, declaration);
    publishState(p.frameCount, liveTurns, declaration);
  };

  // Pressing declares a reading, and pressing again declares the other one — so the
  // reader can hold the cube either way round instead of waiting to be told.
  p.mousePressed = () => {
    pressCount += 1;
    liveReading = pressCount % 3 === 0 ? 0 : (pressCount % 3 === 1 ? 1 : -1);
    return true;
  };
});

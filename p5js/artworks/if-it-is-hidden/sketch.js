import { drawKeyHint } from "../shared/key-hint.js";
import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { SIZE, FPS, DURATION, FRAMES, PAPER, INK, PITCH, COLUMNS, CELLS, DOT_RADII,
  makePaper, makeBloom, frameSheet, frameState, pageFrame } from "./field.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const output = SIZE * scale;
const HINT = hintMode(parameters, CAPTURE_MODE);
const INDICATOR = indicatorShown(parameters, CAPTURE_MODE);
const HINT_LEGEND = [{ cap: "space / touch", text: "hold to stop time" }];
const paper = makePaper();
const bloom = makeBloom();
const sheet = new Uint8Array(CELLS);
const source = new Int32Array(CELLS);

new window.p5((p) => {
  let clock = 0;
  let last;
  let keyHeld = false;
  const pointers = new Set();
  function drawFrame(frame, held = false) {
    const state = frameState(frame, held);
    frameSheet(bloom, paper, frame, sheet, source);
    const context = p.drawingContext;
    context.save();
    context.scale(scale, scale);
    context.fillStyle = `rgb(${PAPER.join(",")})`;
    context.fillRect(0, 0, SIZE, SIZE);
    // Every speck is drawn the same way wherever it lies: one flat disc per inked cell,
    // its size the cell's value. Nothing here is told which cells belong to a petal.
    context.fillStyle = `rgb(${INK.join(",")})`;
    for (let size = 1; size < DOT_RADII.length; size++) {
      const radius = DOT_RADII[size];
      context.beginPath();
      for (let cell = 0; cell < CELLS; cell++) {
        if (sheet[cell] !== size) continue;
        const x = (cell % COLUMNS + 0.5) * PITCH, y = (Math.floor(cell / COLUMNS) + 0.5) * PITCH;
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, 2 * Math.PI);
      }
      context.fill();
    }
    context.restore();
    if (HINT.shown) {
      p.push();
      p.scale(scale);
      drawKeyHint(p, HINT_LEGEND, SIZE, SIZE, HINT.scale);
      p.pop();
    }
    if (INDICATOR && state.recorded) {
      p.push();
      p.scale(scale);
      drawKeyIndicator(p, [{ label: "space", active: true }], SIZE, SIZE);
      p.pop();
    }
    return {
      kind: "video", frameIndex: frame, totalFrames: FRAMES, durationSeconds: DURATION,
      ...state, held,
      logicalSize: { width: SIZE, height: SIZE }, outputSize: { width: output, height: output }
    };
  }
  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }
  p.setup = () => {
    const renderer = p.createCanvas(output, output).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    } else {
      const canvas = renderer.elt;
      canvas.style.touchAction = "none";
      canvas.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        pointers.add(event.pointerId);
        canvas.setPointerCapture(event.pointerId);
      });
      for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
        canvas.addEventListener(eventName, (event) => pointers.delete(event.pointerId));
      }
      window.addEventListener("keydown", (event) => {
        if (event.code !== "Space") return;
        event.preventDefault();
        keyHeld = true;
      });
      window.addEventListener("keyup", (event) => {
        if (event.code !== "Space") return;
        event.preventDefault();
        keyHeld = false;
      });
      const release = () => { keyHeld = false; pointers.clear(); };
      window.addEventListener("blur", release);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) release();
      });
    }
    publishState(drawFrame(0));
    last = performance.now();
  };
  p.draw = () => {
    if (CAPTURE_MODE) return;
    // The page's clock runs only while nothing is held, so a hold stops the sheet where it
    // is and a release takes it up from there.
    const now = performance.now();
    const held = keyHeld || pointers.size > 0;
    if (!held) clock += (now - last) / 1000;
    last = now;
    publishState(drawFrame(pageFrame(clock), held));
  };
});

import { drawKeyHint } from "../shared/key-hint.js";
import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { SIZE, FPS, DURATION, FRAMES, TARGET, NEUTRAL, RIBBON_WIDTH,
  ribbonPoints, makeCells, contextState, cellColour, pageFrame } from "./field.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const output = SIZE * scale;
const HINT = hintMode(parameters, CAPTURE_MODE);
const INDICATOR = indicatorShown(parameters, CAPTURE_MODE);
const HINT_LEGEND = [{ cap: "space / touch", text: "hold to compare" }];
const cells = makeCells();
const points = ribbonPoints();
const ribbon = new Path2D();
points.forEach(([x, y], i) => i ? ribbon.lineTo(x, y) : ribbon.moveTo(x, y));
const paths = cells.map(({ polygon }) => {
  const path = new Path2D();
  polygon.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  path.closePath();
  return path;
});

new window.p5((p) => {
  let started;
  let keyHeld = false;
  const pointers = new Set();
  function drawFrame(frame) {
    const held = keyHeld || pointers.size > 0;
    const state = contextState(frame, held);
    const context = p.drawingContext;
    context.save();
    context.scale(scale, scale);
    context.fillStyle = `rgb(${NEUTRAL.join(",")})`;
    context.fillRect(0, 0, SIZE, SIZE);
    // Skip the cells during the neutral hold: their rasterized edges must vanish too.
    for (let i = 0; state.contrast > 0 && i < cells.length; i++) {
      context.fillStyle = `rgb(${cellColour(cells[i], frame).join(",")})`;
      context.strokeStyle = context.fillStyle;
      // A half-pixel overlap covers raster seams between neighbouring cells.
      context.lineWidth = 0.6;
      context.fill(paths[i]);
      context.stroke(paths[i]);
    }
    context.globalAlpha = 1;
    context.strokeStyle = `rgb(${TARGET.join(",")})`;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = RIBBON_WIDTH;
    context.stroke(ribbon);
    context.restore();
    if (HINT.shown) {
      p.push();
      p.scale(scale);
      drawKeyHint(p, HINT_LEGEND, SIZE, SIZE, HINT.scale);
      p.pop();
    }
    if (INDICATOR && state.comparison) {
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
    started = performance.now();
  };
  p.draw = () => {
    if (!CAPTURE_MODE) publishState(drawFrame(pageFrame((performance.now() - started) / 1000)));
  };
});

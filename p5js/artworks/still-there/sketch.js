import { drawKeyHint } from "../shared/key-hint.js";
import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import {
  SIZE, HALF, COUNT, FPS, CLIP_SECONDS, TOTAL_FRAMES,
  KEY_CAPS, Loom, movingPoint, positionDigest, demoAt
} from "./lattice.js";

const LOGICAL_SIZE = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const GROUND = "#080f19";
const FIELD_SIZE = 584;
const FIELD_X = (LOGICAL_SIZE - FIELD_SIZE) / 2;
const FIELD_Y = 35;
const CELL = FIELD_SIZE / SIZE;
const HINT_LEGEND = [
  { cap: "←", text: "back" }, { cap: "→", text: "forward" },
  { cap: "space", text: "run / pause" }, { cap: "R", text: "reset" }
];
const TONE = { plate: [8, 15, 25, 230], ink: [218, 223, 221, 230], cap: [153, 179, 188, 180] };
const PALETTE = [[224, 119, 66], [241, 184, 108], [208, 218, 196], [79, 164, 171], [48, 102, 137]];

/** Colour belongs to the original tessera. A permutation never recolours a cell. */
function tessera(index) {
  const x = (index % SIZE - HALF) / HALF;
  const y = (Math.floor(index / SIZE) - HALF) / HALF;
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  const petal = r + 0.054 * Math.cos(12 * a) * Math.min(1, r * 5);
  const ring = Math.abs(Math.sin(petal * Math.PI * 13));
  const spoke = Math.abs(Math.sin(12 * a + r * 5));
  const lace = Math.abs(Math.sin(24 * a - r * 13));
  const envelope = r < 0.94 ? Math.min(1, (0.94 - r) * 30) : 0;
  const line = Math.pow(1 - ring, 1.4) * 0.8 + Math.pow(1 - spoke, 5) * 0.5;
  const brightness = envelope * Math.min(1, 0.065 + line + 0.13 * (1 - lace));
  const stripe = Math.floor(petal * 13 + 0.25 * Math.cos(6 * a));
  const colour = PALETTE[((stripe % PALETTE.length) + PALETTE.length) % PALETTE.length];
  const rgb = colour.map((c, i) => Math.round([9, 18, 28][i] + c * brightness * 0.87));
  return { rgb, bright: brightness, colour: `rgb(${rgb})` };
}

const TESSERAE = Array.from({ length: COUNT }, (_, index) => tessera(index));

new window.p5((p) => {
  const loom = new Loom();
  let ctx;
  let lastTime;
  let digest = positionDigest(loom.positions);
  let previousPositions = loom.positions;

  function drawAll(state, pressedKey = null) {
    p.background(GROUND);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.fillStyle = "#0c1722";
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_SIZE, FIELD_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD_X, FIELD_Y, FIELD_SIZE, FIELD_SIZE);
    ctx.clip();
    for (let i = 0; i < COUNT; i += 1) {
      const tile = TESSERAE[i];
      let x = state.positions[i * 2];
      let y = state.positions[i * 2 + 1];
      if (state.active) [x, y] = movingPoint(x, y, state.activeDirection, state.progress);
      const px = FIELD_X + (x + HALF) * CELL;
      const py = FIELD_Y + (y + HALF) * CELL;
      // A tile crossing an edge is also drawn at the opposite edge of the torus.
      const xs = [px];
      const ys = [py];
      if (px + CELL > FIELD_X + FIELD_SIZE) xs.push(px - FIELD_SIZE);
      if (py + CELL > FIELD_Y + FIELD_SIZE) ys.push(py - FIELD_SIZE);
      for (const dx of xs) for (const dy of ys) {
        ctx.fillStyle = tile.colour;
        ctx.fillRect(dx + 0.25, dy + 0.25, CELL - 0.5, CELL - 0.5);
        if (tile.bright > 0.28) {
          ctx.fillStyle = `rgba(255,241,207,${tile.bright * 0.22})`;
          ctx.fillRect(dx + 0.25, dy + 0.25, CELL - 0.5, 0.45);
        }
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(140,168,172,0.27)";
    ctx.lineWidth = 0.65;
    ctx.strokeRect(FIELD_X - 4, FIELD_Y - 4, FIELD_SIZE + 8, FIELD_SIZE + 8);
    // The counter belongs to the operation: it remains useful after the rosette disappears.
    ctx.fillStyle = "rgba(164,187,192,0.75)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    const label = state.active ? (state.activeDirection === 1 ? "FORWARD" : "BACK") : "STILL THERE";
    ctx.fillText(`${label}  ${state.steps > 0 ? "+" : ""}${state.steps}`, FIELD_X + FIELD_SIZE, 20);
    ctx.restore();
    if (HINT.shown) {
      p.push();
      p.scale(RENDER_SCALE);
      drawKeyHint(p, HINT_LEGEND, LOGICAL_SIZE, LOGICAL_SIZE, HINT.scale, TONE);
      p.pop();
    }
    if (INDICATOR && pressedKey) {
      p.push();
      p.scale(RENDER_SCALE);
      drawKeyIndicator(p, [{ label: KEY_CAPS[pressedKey], active: true }], LOGICAL_SIZE, LOGICAL_SIZE);
      p.pop();
    }
  }

  function publishState(state, frameIndex = 0) {
    if (previousPositions !== state.positions) {
      digest = positionDigest(state.positions);
      previousPositions = state.positions;
    }
    const published = {
      kind: "video", frameIndex, totalFrames: TOTAL_FRAMES, durationSeconds: CLIP_SECONDS,
      steps: state.steps, active: state.active, running: state.running,
      direction: state.direction, progress: state.progress, digest,
      cells: COUNT, logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = published;
    window.__ARTWORK_READY__ = true;
    return published;
  }

  p.setup = () => {
    const canvas = p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    ctx = p.drawingContext;
    canvas.elt.setAttribute("aria-label", "Still There. Left steps back; Right steps forward; Space runs or pauses; R resets.");
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        const scene = demoAt(frameIndex);
        drawAll(scene.loom, scene.pressedKey);
        return Promise.resolve(publishState(scene.loom, scene.frame));
      };
    }
    drawAll(loom);
    publishState(loom);
    lastTime = performance.now();
    if (!CAPTURE_MODE) window.addEventListener("keydown", handleKey);
  };

  p.draw = () => {
    if (CAPTURE_MODE) return;
    const now = performance.now();
    // Background tabs do not turn one key press into an unobserved burst of motion.
    loom.advance(Math.min(0.1, (now - lastTime) / 1000));
    lastTime = now;
    drawAll(loom);
    publishState(loom, p.frameCount);
    if (!loom.active) p.noLoop();
  };

  // Listen to native keydown so held-key repeats are also cancelled. p5 can discard
  // repeat events before calling keyPressed, leaving the browser's scroll action live.
  function handleKey(event) {
    if (CAPTURE_MODE || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!["ArrowLeft", "ArrowRight", " ", "r", "R"].includes(event.key)) return;
    if (event.repeat) { event.preventDefault(); return; }
    if (!loom.key(event.key)) return;
    event.preventDefault();
    lastTime = performance.now();
    drawAll(loom);
    publishState(loom, p.frameCount);
    p.loop();
  }
});

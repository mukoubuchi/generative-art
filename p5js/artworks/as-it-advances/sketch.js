import {
  SIZE, FPS, DURATION, FRAMES, GROWTH_FRAMES, POINTS,
  GROUND, STEEL, GOLD, makeHistory, pageFrame, growthFrame
} from "./growth.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT = SIZE * SCALE;
const { contours } = makeHistory();
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const colour = (t) => STEEL.map((v, i) => Math.round(v + (GOLD[i] - v) * t));

function trace(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 1; i < POINTS; i += 1) ctx.lineTo(points[2 * i], points[2 * i + 1]);
  ctx.closePath();
}

new window.p5((p) => {
  let started, ctx, archive, ink, density, archived = -1;

  function addHistory(frame) {
    if (frame < archived) {
      ink.clearRect(0, 0, SIZE, SIZE);
      archived = -1;
    }
    for (let f = archived + 1; f <= frame; f += 1) {
      if (f % 3 !== 0) continue;
      const c = colour(f / GROWTH_FRAMES);
      trace(ink, contours[f]);
      ink.strokeStyle = rgba(c, 0.64);
      ink.lineWidth = 0.62;
      ink.stroke();
      // Material meridians connect consecutive layers rather than floating over them.
      if (f >= 3) {
        ink.beginPath();
        for (let i = 0; i < POINTS; i += 16) {
          ink.moveTo(contours[f - 3][2 * i], contours[f - 3][2 * i + 1]);
          ink.lineTo(contours[f][2 * i], contours[f][2 * i + 1]);
        }
        ink.strokeStyle = rgba(c, 0.17);
        ink.lineWidth = 0.55;
        ink.stroke();
      }
    }
    archived = frame;
  }

  function drawFrame(frame) {
    const front = growthFrame(frame);
    addHistory(front);
    p.background(...GROUND);
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.drawImage(archive, 0, 0, SIZE, SIZE);
    const c = colour(front / GROWTH_FRAMES);
    trace(ctx, contours[front]);
    ctx.lineJoin = "round";
    // The newest contour is lit; its older positions remain in the material.
    ctx.strokeStyle = rgba(c, 0.06); ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = rgba(c, 0.15); ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = rgba(c, 0.9); ctx.lineWidth = 1.25; ctx.stroke();
    ctx.strokeStyle = "rgba(248,250,255,0.7)"; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.restore();
    return {
      kind: "video", frameIndex: frame, totalFrames: FRAMES, durationSeconds: DURATION,
      growthStep: front, logicalSize: { width: SIZE, height: SIZE },
      outputSize: { width: OUTPUT, height: OUTPUT }
    };
  }

  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT, OUTPUT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    ctx = p.drawingContext;
    density = SCALE * p.pixelDensity();
    archive = document.createElement("canvas");
    archive.width = Math.round(SIZE * density);
    archive.height = Math.round(SIZE * density);
    // Request a CPU-backed archive for consistent incremental and random-access painting.
    ink = archive.getContext("2d", { willReadFrequently: true });
    ink.scale(density, density);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));
    started = performance.now();
  };
  p.draw = () => {
    if (CAPTURE_MODE) return;
    const frame = pageFrame((performance.now() - started) / 1000);
    publishState(drawFrame(frame));
    if (frame === FRAMES - 1) p.noLoop();
  };
});

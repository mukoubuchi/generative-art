import {
  WIDTH, HEIGHT, FPS, DURATION, FRAMES, PAPER, INK,
  makeDrawing, inkSegments, travelled, pageFrame
} from "./field.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const drawing = makeDrawing();
const rgba = (alpha) => `rgba(${INK.join(",")},${alpha})`;

new window.p5((p) => {
  let started, ctx;

  function stroke(segments, width, alpha) {
    const bins = Array.from({ length: 8 }, () => []);
    for (const segment of segments) bins[Math.min(7, Math.floor(segment[4] * 8))].push(segment);
    for (let k = 0; k < bins.length; k += 1) {
      ctx.beginPath();
      for (const [x0, y0, x1, y1] of bins[k]) {
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      }
      ctx.strokeStyle = rgba(alpha * (k + 0.5) / 8);
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function drawFrame(frame) {
    const time = frame / FPS;
    p.background(...PAPER);
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.lineCap = "round";
    for (const line of drawing.warp) {
      const distance = travelled(line, time);
      const strong = line.index % 9 === 3;
      stroke(inkSegments(line, 0, distance), strong ? 1.15 : 0.65, strong ? 0.8 : 0.52);
      if (time > line.start && time < line.end) {
        stroke(inkSegments(line, Math.max(0, distance - 14), distance), 1.2, 0.84);
      }
    }
    for (const line of drawing.weft) {
      const distance = travelled(line, time);
      const strong = line.index === 2 || line.index === 5;
      stroke(inkSegments(line, 0, distance), strong ? 2.1 : 1.15, strong ? 0.94 : 0.74);
      if (time > line.start && time < line.end) {
        // The moving mark crosses the blank passage; only its deposited ink is masked.
        stroke(inkSegments(line, Math.max(0, distance - (strong ? 23 : 12)), distance, false),
          strong ? 2.7 : 1.45, strong ? 0.98 : 0.8);
      }
    }
    ctx.restore();
    return {
      kind: "video", frameIndex: frame, totalFrames: FRAMES, durationSeconds: DURATION,
      logicalSize: { width: WIDTH, height: HEIGHT },
      outputSize: { width: WIDTH * SCALE, height: HEIGHT * SCALE }
    };
  }

  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(WIDTH * SCALE, HEIGHT * SCALE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    ctx = p.drawingContext;
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

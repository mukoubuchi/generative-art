import { WIDTH, HEIGHT, FPS, DURATION, FRAMES, PARAMETERS, visibleArcs, stateAt, frameAt } from "./family.js";
const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const outputWidth = WIDTH * scale, outputHeight = HEIGHT * scale;
// The established night, steel and gold palette of the geometric light works.
const GROUND = "rgb(6,7,12)";
const STEEL = [104, 144, 204];
const GOLD = [252, 204, 116];
const HEART = [248, 250, 255];
function pathOf(arcs) {
  const path = new Path2D();
  for (const arc of arcs) arc.forEach(({ xy: [x, y] }, i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  return path;
}
const family = PARAMETERS.map((lambda) => ({ lambda, path: pathOf(visibleArcs(lambda)) }));
new window.p5((p) => {
  let started;
  function drawFrame(frame) {
    const state = stateAt(frame), ctx = p.drawingContext;
    ctx.save(); ctx.scale(scale, scale);
    ctx.fillStyle = GROUND; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    function ink(path, colour, alpha, width) {
      ctx.strokeStyle = `rgba(${colour.join(",")},${alpha})`; ctx.lineWidth = width; ctx.stroke(path);
    }
    // Each retained case is a member of the same family, never a decorative offset.
    for (const member of family) {
      ink(member.path, STEEL, 0.026, 4.2);
      ink(member.path, STEEL, 0.28, 0.65);
      const nearby = Math.exp(-(((member.lambda - state.lambda) / 0.105) ** 2));
      if (nearby > 0.01) ink(member.path, GOLD, 0.30 * nearby, 0.8);
    }
    const selected = pathOf(visibleArcs(state.lambda));
    ink(selected, GOLD, 0.025, 17);
    ink(selected, GOLD, 0.075, 7);
    ink(selected, GOLD, 0.45, 2.2);
    ink(selected, HEART, 0.82, 0.75);
    ctx.restore();
    return { kind: "video", frameIndex: frame, totalFrames: FRAMES, durationSeconds: DURATION,
      ...state, logicalSize: { width: WIDTH, height: HEIGHT },
      outputSize: { width: outputWidth, height: outputHeight } };
  }
  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }
  p.setup = () => {
    p.createCanvas(outputWidth, outputHeight).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0)); started = performance.now();
  };
  p.draw = () => { if (!CAPTURE_MODE) publishState(drawFrame(frameAt((performance.now() - started) / 1000))); };
});

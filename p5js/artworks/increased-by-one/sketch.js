import { WIDTH, HEIGHT, FPS, DURATION, FRAMES, COUNT, SAMPLES, CENTRE, RADIUS,
  ARCHIVE_RADIUS, createChronicle, sample, archivePosition, sectionPoint, stateAt, frameAt, ease } from "./events.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const outputWidth = WIDTH * scale, outputHeight = HEIGHT * scale;
// The same night, steel-blue, gold and ice as A General Process.
const GROUND = "rgb(6,7,12)";
const STEEL = [104, 144, 204], GOLD = [252, 204, 116], ICE = [248, 250, 255];
const events = createChronicle().map((event) => ({ ...event,
  from: sample(event.inherited), to: sample(event.coefficients) }));

function closedPath(at) {
  const path = new Path2D();
  for (let i = 0; i < SAMPLES; i++) {
    const [x, y] = at(i);
    if (i) path.lineTo(x, y); else path.moveTo(x, y);
  }
  path.closePath();
  return path;
}

// Fixed sections are prepared once, keeping normal playback independent of path building.
const lofts = events.map((event) => event.parents.map((parent) =>
  Array.from({ length: 21 }, (_, step) => closedPath((i) =>
    sectionPoint(events[parent].to, event.from, parent, (step + 1) / 22, i)))));

new window.p5((p) => {
  let started;
  function drawFrame(frame) {
    const state = stateAt(frame), ctx = p.drawingContext, active = events[state.event];
    ctx.save(); ctx.scale(scale, scale);
    ctx.fillStyle = GROUND; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    function ink(path, colour, alpha, width) {
      ctx.strokeStyle = `rgba(${colour.join(",")},${alpha})`; ctx.lineWidth = width; ctx.stroke(path);
    }
    function shell(event, centre, radius, novelty, colour, opacity, layers) {
      // Nested sections retain the stages of this event's own formation.
      for (let layer = 1; layer <= layers; layer++) {
        const u = layer / layers, r = radius * (0.17 + 0.83 * u);
        const mix = novelty * ease(u);
        const path = closedPath((i) => [centre[0] + r * (event.from[i][0] * (1 - mix) + event.to[i][0] * mix),
          centre[1] + r * (event.from[i][1] * (1 - mix) + event.to[i][1] * mix)]);
        ink(path, colour, opacity * (0.11 + 0.28 * u), 0.57);
        if (layer === layers) {
          ink(path, colour, opacity * 0.055, 8);
          ink(path, colour, opacity * 0.28, 2.1);
          ink(path, ICE, opacity * 0.73, 0.66);
        }
      }
    }

    // Cross sections and meridians belong to the same interpolating surfaces.
    // The originals stay in place while their copies meet at the inherited mean.
    if (state.active) {
      const child = state.event, event = active, progress = state.gather;
      const strength = (0.9 - 0.15 * state.novelty) * (1 - state.transfer);
      for (const parent of event.parents) {
        for (let step = 1; step <= 21; step++) {
          const t = step / 22;
          if (t > progress) continue;
          const path = lofts[child][parent][step - 1];
          ink(path, STEEL, strength * (0.21 - 0.11 * t), 0.45);
        }
        for (let meridian = 0; meridian < 24; meridian++) {
          const i = meridian * SAMPLES / 24, path = new Path2D();
          for (let step = 0; step <= 32; step++) {
            const t = progress * step / 32;
            const [x, y] = sectionPoint(events[parent].to, event.from, parent, t, i);
            if (step) path.lineTo(x, y); else path.moveTo(x, y);
          }
          ink(path, STEEL, 0.19 * strength, 0.48);
        }
        if (progress > 0 && progress < 1) {
          const front = closedPath((i) => sectionPoint(events[parent].to, event.from, parent, progress, i));
          ink(front, STEEL, 0.06, 5);
          ink(front, ICE, 0.46, 0.65);
        }
      }
    }

    for (let id = 0; id < state.event; id++) {
      shell(events[id], archivePosition(id), ARCHIVE_RADIUS, 1, STEEL, 1, 26);
    }
    if (state.active && state.gather > 0) {
      const destination = archivePosition(state.event), t = state.transfer;
      const centre = CENTRE.map((c, axis) => c * (1 - t) + destination[axis] * t);
      const radius = RADIUS * (1 - t) + ARCHIVE_RADIUS * t;
      const visibility = ease((state.gather - 0.45) / 0.55);
      const colour = GOLD.map((c, axis) => c * (1 - t) + STEEL[axis] * t);
      shell(active, centre, radius, state.novelty, colour, visibility, 26);
      // The inherited boundary remains visible while the new frequency unfolds.
      if (state.novelty > 0 && state.novelty < 1) {
        const mean = closedPath((i) => [CENTRE[0] + RADIUS * active.from[i][0], CENTRE[1] + RADIUS * active.from[i][1]]);
        ink(mean, STEEL, 0.5 * (1 - state.novelty), 0.8);
      }
    }
    ctx.restore();
    return { kind: "video", frameIndex: frame, totalFrames: FRAMES, durationSeconds: DURATION,
      ...state, logicalSize: { width: WIDTH, height: HEIGHT }, outputSize: { width: outputWidth, height: outputHeight } };
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

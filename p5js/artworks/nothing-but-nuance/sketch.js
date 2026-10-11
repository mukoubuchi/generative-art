import { SIZE, FPS, DURATION, FRAMES, GRID, GROUND, frameAt, surfaceAt, makeSampler, colourAt } from "./field.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const output = SIZE * scale;
const sampler = makeSampler();

new window.p5((p) => {
  let started;
  let pixels;
  let packedPixels;
  let lookup;
  let colours;
  let resolution;

  function prepare() {
    resolution = Math.round(output * p.pixelDensity());
    pixels = p.drawingContext.createImageData(resolution, resolution);
    packedPixels = new Uint32Array(pixels.data.buffer);
    lookup = new Float32Array(resolution * resolution * 3);
    // Stationary sampling coordinates and exposure table: no time dependence.
    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        const { u, v } = surfaceAt((x + 0.5) / resolution, (y + 0.5) / resolution);
        const gx = ((u % 1) + 1) % 1 * GRID;
        const gy = ((v % 1) + 1) % 1 * GRID;
        const at = 3 * (y * resolution + x);
        lookup[at] = Math.floor(gy) * GRID + Math.floor(gx);
        lookup[at + 1] = gx - Math.floor(gx);
        lookup[at + 2] = gy - Math.floor(gy);
      }
    }
    // Share native byte order with ImageData, so one store writes all four channels.
    const bytes = new Uint8ClampedArray(16385 * 4);
    for (let i = 0; i <= 16384; i += 1) bytes.set([...colourAt(i / 1024), 255], 4 * i);
    colours = new Uint32Array(bytes.buffer);
  }

  function drawFrame(frame) {
    sampler.at(frame / FRAMES);
    const { re, im } = sampler;
    // GRID is a power of two. These masks wrap adjacent samples on its torus.
    const rowMask = GRID * (GRID - 1), cellMask = GRID * GRID - 1;
    for (let pixel = 0, at = 0; pixel < packedPixels.length; pixel += 1, at += 3) {
      const a = lookup[at];
      const fx = lookup[at + 1], fy = lookup[at + 2];
      const b = (a & rowMask) | ((a + 1) & (GRID - 1));
      const c = (a + GRID) & cellMask, d = (b + GRID) & cellMask;
      const r = (re[a] * (1 - fx) + re[b] * fx) * (1 - fy) + (re[c] * (1 - fx) + re[d] * fx) * fy;
      const i = (im[a] * (1 - fx) + im[b] * fx) * (1 - fy) + (im[c] * (1 - fx) + im[d] * fx) * fy;
      const shade = Math.min(16384, Math.round((r * r + i * i) * 1024));
      packedPixels[pixel] = colours[shade];
    }
    p.drawingContext.putImageData(pixels, 0, 0);
    return {
      kind: "video", frameIndex: frame, totalFrames: FRAMES, durationSeconds: DURATION,
      progress: frame / FRAMES,
      logicalSize: { width: SIZE, height: SIZE }, outputSize: { width: output, height: output }
    };
  }

  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(output, output).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    p.background(...GROUND);
    prepare();
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));
    started = performance.now();
  };
  p.draw = () => {
    if (!CAPTURE_MODE) publishState(drawFrame(frameAt((performance.now() - started) / 1000)));
  };
});

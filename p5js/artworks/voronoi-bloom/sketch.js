import { hsbToRgb } from "../shared/color.js";
import {
  ART_SEED,
  SITE_COUNT,
  connections,
  createSites,
  nearestTwo,
  shade
} from "./bloom.js";

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const TEXTURE_NOISE_X = 0.01125;
const TEXTURE_NOISE_Y = 0.0140625;
const VIGNETTE_SCALE = 0.72;
const GRAIN_COUNT = 15000;

const P5 = window.p5;

new P5((p) => {
  function paintCells(sites) {
    const xs = Float64Array.from(sites, (site) => site.x);
    const ys = Float64Array.from(sites, (site) => site.y);
    const measurement = { index: 0, nearest: 0, gap: 0 };

    p.loadPixels();
    const pixels = p.pixels;
    const halfWidth = LOGICAL_WIDTH * 0.5;
    const halfHeight = LOGICAL_HEIGHT * 0.5;
    // The canvas is as many pixels across as the export scale asks for, times whatever the
    // display puts on top of that: on a Retina screen the backing store is twice the size
    // again. Writing a logical grid into a denser buffer fills one corner of it and leaves
    // the rest untouched, which is what put two copies of this picture in the top quarter
    // of the canvas on such a screen. So the density is read and the backing store is what
    // gets walked. At a density of one this is the loop it has always been, byte for byte;
    // above one the picture is computed at the resolution it is actually shown at.
    const density = p.pixelDensity();
    const backingWidth = OUTPUT_WIDTH * density;
    const backingHeight = OUTPUT_HEIGHT * density;
    const perLogical = RENDER_SCALE * density;
    for (let backingY = 0; backingY < backingHeight; backingY += 1) {
      // The sites live in logical coordinates, so the export scale raises the resolution
      // of the diagram without moving anything in it.
      const logicalY = backingY / perLogical;
      const normalizedY = (logicalY - halfHeight) / (LOGICAL_HEIGHT * VIGNETTE_SCALE);
      for (let backingX = 0; backingX < backingWidth; backingX += 1) {
        const logicalX = backingX / perLogical;
        nearestTwo(xs, ys, SITE_COUNT, logicalX, logicalY, measurement);
        const texture = p.noise(logicalX * TEXTURE_NOISE_X, logicalY * TEXTURE_NOISE_Y);
        const normalizedX = (logicalX - halfWidth) / (LOGICAL_WIDTH * VIGNETTE_SCALE);
        const vignette = Math.max(
          0,
          Math.min(1, 1 - normalizedX * normalizedX - normalizedY * normalizedY)
        );
        const ink = shade(sites[measurement.index], measurement, texture, vignette);
        const [red, green, blue] = hsbToRgb(ink.hue, ink.saturation, ink.brightness);
        const offset = (backingX + backingY * backingWidth) * 4;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
        pixels[offset + 3] = 255;
      }
    }
    p.updatePixels();
  }

  function drawConnections(sites) {
    // Added rather than blended, so where two lines cross the light accumulates.
    p.blendMode(p.ADD);
    p.strokeWeight(0.65);
    for (const [from, to] of connections(sites)) {
      p.stroke(sites[from].hue, 46, 94, 16);
      p.line(sites[from].x, sites[from].y, sites[to].x, sites[to].y);
    }
    p.blendMode(p.BLEND);
  }

  function drawSites(sites) {
    sites.forEach((site, index) => {
      const halo = 8 + p.noise(index * 0.31) * 15;
      p.noFill();
      p.stroke(site.hue, 34, 100, 36);
      p.strokeWeight(0.8);
      p.circle(site.x, site.y, halo);
      p.noStroke();
      p.fill(site.hue, 18, 100, 82);
      p.circle(site.x, site.y, 2.4);
    });
  }

  function addGrain() {
    p.randomSeed(ART_SEED + 1);
    p.strokeWeight(1);
    for (let speck = 0; speck < GRAIN_COUNT; speck += 1) {
      const x = p.random(0, LOGICAL_WIDTH);
      const y = p.random(0, LOGICAL_HEIGHT);
      const alpha = p.random(1.5, 6.0);
      p.stroke(0, 0, p.random(0, 1) < 0.5 ? 100 : 0, alpha);
      p.point(x, y);
    }
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
    p.noLoop();
  };

  p.draw = () => {
    // Seeded here rather than in setup, so the image is a function of the seed alone.
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.colorMode(p.HSB, 360, 100, 100, 100);

    const sites = createSites(
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      (low, high) => p.random(low, high),
      (x, y) => p.noise(x, y)
    );
    // The cells are painted through the pixel buffer, which ignores the transform, so the
    // scale applies only to the strokes drawn over them.
    paintCells(sites);
    p.push();
    p.scale(RENDER_SCALE);
    drawConnections(sites);
    drawSites(sites);
    addGrain();
    p.pop();

    window.__ARTWORK_STATE__ = {
      kind: "image",
      seed: ART_SEED,
      siteCount: sites.length,
      connectionCount: connections(sites).length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});

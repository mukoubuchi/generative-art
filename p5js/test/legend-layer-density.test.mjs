import assert from "node:assert/strict";
import test from "node:test";

/**
 * Platonic Duals draws its legend on a 2D layer laid over its WEBGL frame. The layer was
 * pinned at a density of one wherever it was drawn, while the page's canvas follows the
 * screen, so on a dense display the legend was set at 680 pixels and stretched to 1360:
 * the one soft legend among the nine. Held here: on the page the layer takes the canvas's
 * density, and in a capture, where the canvas itself is pinned at one, the layer is too.
 *
 * The sketch is run on a stand-in for p5 that answers every call, remembers the densities
 * asked of the canvas and of each layer, and reports the density a screen would give it.
 */
async function legendLayerDensities(sketchUrl, search, screenDensity) {
  const asked = { canvas: [], layers: [] };
  const inert = new Proxy(function inert() {}, {
    get: (target, name) => (name === Symbol.toPrimitive ? () => 0 : inert),
    apply: () => inert
  });
  function surface(overrides) {
    return new Proxy(overrides, {
      get: (target, name) => (name in target ? target[name] : inert)
    });
  }
  class RecordingP5 {
    constructor(define) {
      let density = screenDensity;
      const p = surface({
        frameCount: 1,
        mouseX: 0, pmouseX: 0, mouseY: 0, pmouseY: 0,
        createCanvas: () => ({ parent() {} }),
        pixelDensity: (value) => {
          if (value === undefined) return density;
          asked.canvas.push(value);
          density = value;
          return undefined;
        },
        createGraphics: () => {
          const layer = { density: screenDensity };
          asked.layers.push(layer);
          return surface({
            pixelDensity: (value) => {
              if (value === undefined) return layer.density;
              layer.density = value;
              return undefined;
            },
            textWidth: (text) => String(text).length * 7
          });
        }
      });
      define(p);
      p.setup();
      if (typeof p.draw === "function") p.draw();
    }
  }
  const priorWindow = globalThis.window;
  globalThis.window = { p5: RecordingP5, location: { search } };
  try {
    await import(`${sketchUrl.href}?density=${Math.random()}`);
    if (typeof window.__renderFrame === "function") await window.__renderFrame(130);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
  return { canvas: asked.canvas, layers: asked.layers.map(({ density }) => density) };
}

const SKETCH = new URL("../artworks/platonic-duals/sketch.js", import.meta.url);
// The sketch as it shipped in v1.33.1, frozen outside artworks/ with its imports pointed
// back at the tree.
const FROZEN = new URL("./fixtures/legend-layer-density/sketch.js", import.meta.url);

test("Platonic Duals' legend layer takes the page's density, and one when captured", async () => {
  for (const screen of [2, 3]) {
    const page = await legendLayerDensities(SKETCH, "", screen);
    assert.deepEqual(page.canvas, [], "the page's canvas is left to the screen");
    assert.deepEqual(page.layers, [screen], `on a ${screen}x screen the legend layer is drawn at ${screen}x`);
  }
  // A card: captured with the legend, the canvas pinned at one, and the layer with it.
  const card = await legendLayerDensities(SKETCH, "?capture=1&hint=1&hintScale=1.7", 2);
  assert.deepEqual(card.canvas, [1]);
  assert.deepEqual(card.layers, [1]);
});

test("the check catches the layer as it shipped, pinned at one on the page", async () => {
  const page = await legendLayerDensities(FROZEN, "", 2);
  assert.deepEqual(page.layers, [1], "the frozen sketch no longer pins its layer");
  // So the same assertion the live sketch passes fails here.
  assert.notDeepEqual(page.layers, [2]);
});

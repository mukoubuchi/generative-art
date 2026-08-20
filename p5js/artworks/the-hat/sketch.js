import {
  HAT_OUTLINE,
  boundsOf,
  createHatPatch,
  transformPoint
} from "./hat.js";

/**
 * A finite H-supertile from the Hat's substitution system: 169 copies of one polykite,
 * including the reflected copies that count as the same tile under the paper's convention.
 * The reflected stones carry the warm light; every shape around them has the same outline.
 */
const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

const GROUND = [18, 17, 23];
const MORTAR = [28, 26, 34];
const INLAY = [238, 226, 198];
const TILE_COLOURS = {
  H: [184, 168, 139],
  T: [224, 215, 190],
  P: [135, 149, 151],
  F: [91, 105, 113],
  H1: [217, 145, 61]
};
const TILES = createHatPatch(2);
const PATCH_BOUNDS = boundsOf(TILES);
const PATCH_SCALE = Math.min(
  (LOGICAL_WIDTH - 360) / (PATCH_BOUNDS.maxX - PATCH_BOUNDS.minX),
  (LOGICAL_HEIGHT - 70) / (PATCH_BOUNDS.maxY - PATCH_BOUNDS.minY)
);
const PATCH_CENTRE = {
  x: (PATCH_BOUNDS.minX + PATCH_BOUNDS.maxX) / 2,
  y: (PATCH_BOUNDS.minY + PATCH_BOUNDS.maxY) / 2
};

const P5 = window.p5;

new P5((p) => {
  function polygon(vertices) {
    p.beginShape();
    for (const vertex of vertices) {
      p.vertex(vertex.x, vertex.y);
    }
    p.endShape(p.CLOSE);
  }

  function drawTile(tile) {
    const vertices = HAT_OUTLINE.map((vertex) => transformPoint(tile.matrix, vertex));
    const centre = vertices.reduce(
      (sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }),
      { x: 0, y: 0 }
    );
    centre.x /= vertices.length;
    centre.y /= vertices.length;

    p.fill(...TILE_COLOURS[tile.label]);
    p.stroke(...MORTAR);
    p.strokeWeight(0.11);
    polygon(vertices);

    const inset = vertices.map((vertex) => ({
      x: centre.x + (vertex.x - centre.x) * 0.86,
      y: centre.y + (vertex.y - centre.y) * 0.86
    }));
    p.noFill();
    p.stroke(...INLAY, tile.reflected ? 165 : 50);
    p.strokeWeight(tile.reflected ? 0.08 : 0.045);
    polygon(inset);
  }

  function drawAll() {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);

    p.noFill();
    p.stroke(217, 145, 61, 18);
    p.strokeWeight(1);
    for (let radius = 180; radius <= 720; radius += 90) {
      p.circle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, radius);
    }

    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(-Math.PI / 60);
    p.scale(PATCH_SCALE);
    p.translate(-PATCH_CENTRE.x, -PATCH_CENTRE.y);
    for (const tile of TILES.filter((entry) => !entry.reflected)) {
      drawTile(tile);
    }
    for (const tile of TILES.filter((entry) => entry.reflected)) {
      drawTile(tile);
    }
    p.pop();
  }

  function publishState() {
    const labels = Object.fromEntries(Object.keys(TILE_COLOURS).map((label) => [
      label,
      TILES.filter((tile) => tile.label === label).length
    ]));
    const state = {
      kind: "image",
      substitutionRounds: 2,
      tiles: TILES.length,
      reflectedTiles: TILES.filter((tile) => tile.reflected).length,
      labels,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    // A still: the complete substitution patch is present in the first and only drawing.
    p.noLoop();
    drawAll();
    publishState();
  };
});

import {
  HAT_OUTLINE,
  boundsOf,
  createHatPatch,
  transformPoint
} from "./hat.js";

/**
 * A finite H-supertile from the Hat's substitution system: 169 copies of one polykite,
 * including the reflected copies that count as the same tile under the paper's convention.
 * One current of light crosses the whole masonry. The substitution labels shift only its
 * value, while a pearl inner seam quietly reveals each reflected copy.
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

const GROUND = [13, 18, 27];
const STONE_SHADOW = [196, 106, 74];
const STONE_LIGHT = [236, 208, 160];
const PEARL = [246, 244, 236];
const SEAM = [222, 158, 96];
/** Small value steps within one stone family keep the substitution ancestry legible. */
const LABEL_LIFT = {
  H: 0.04,
  T: 0.12,
  P: -0.02,
  F: -0.1,
  H1: 0.04
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

function mixColour(first, second, amount) {
  return first.map(
    (channel, index) => channel + (second[index] - channel) * amount
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

const P5 = window.p5;

new P5((p) => {
  function polygon(vertices) {
    p.beginShape();
    for (const vertex of vertices) {
      p.vertex(vertex.x, vertex.y);
    }
    p.endShape(p.CLOSE);
  }

  function tileDrawing(tile) {
    const vertices = HAT_OUTLINE.map((vertex) => transformPoint(tile.matrix, vertex));
    const centre = vertices.reduce(
      (sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }),
      { x: 0, y: 0 }
    );
    centre.x /= vertices.length;
    centre.y /= vertices.length;
    return { ...tile, vertices, centre };
  }

  const drawings = TILES.map(tileDrawing);

  /** A continuous light from the upper right passes through every label family. */
  function stoneColour(drawing) {
    const across = (drawing.centre.x - PATCH_BOUNDS.minX)
      / (PATCH_BOUNDS.maxX - PATCH_BOUNDS.minX);
    const down = (drawing.centre.y - PATCH_BOUNDS.minY)
      / (PATCH_BOUNDS.maxY - PATCH_BOUNDS.minY);
    const light = clamp(
      0.44 + 0.22 * across - 0.12 * down + LABEL_LIFT[drawing.label],
      0,
      1
    );
    const stone = mixColour(STONE_SHADOW, STONE_LIGHT, light);
    return drawing.reflected ? mixColour(stone, PEARL, 0.22) : stone;
  }

  function drawStone(drawing) {
    p.noStroke();
    p.fill(...stoneColour(drawing));
    polygon(drawing.vertices);
  }

  function drawSeam(drawing) {
    p.noFill();
    p.stroke(...SEAM, 48);
    p.strokeWeight(0.045);
    polygon(drawing.vertices);
  }

  function drawReflectedLight(drawing) {
    const inset = drawing.vertices.map((vertex) => ({
      x: drawing.centre.x + (vertex.x - drawing.centre.x) * 0.82,
      y: drawing.centre.y + (vertex.y - drawing.centre.y) * 0.82
    }));
    p.noFill();
    p.stroke(...PEARL, 145);
    p.strokeWeight(0.035);
    polygon(inset);
  }

  function drawGroundLight() {
    const context = p.drawingContext;
    context.save();
    context.scale(RENDER_SCALE, RENDER_SCALE);
    const glow = context.createRadialGradient(545, 270, 20, 545, 270, 500);
    glow.addColorStop(0, "rgba(222, 158, 96, 0.16)");
    glow.addColorStop(0.55, "rgba(196, 106, 74, 0.08)");
    glow.addColorStop(1, "rgba(13, 18, 27, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    context.restore();
  }

  function drawAll() {
    p.push();
    p.background(...GROUND);
    drawGroundLight();

    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(-Math.PI / 60);
    p.scale(PATCH_SCALE);
    p.translate(-PATCH_CENTRE.x, -PATCH_CENTRE.y);
    // Faces, seams, then reflected inlays: no tile's edge is buried by a later face.
    for (const drawing of drawings) {
      drawStone(drawing);
    }
    for (const drawing of drawings) {
      drawSeam(drawing);
    }
    for (const drawing of drawings.filter((entry) => entry.reflected)) {
      drawReflectedLight(drawing);
    }
    p.pop();
  }

  function publishState() {
    const labels = Object.fromEntries(Object.keys(LABEL_LIFT).map((label) => [
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

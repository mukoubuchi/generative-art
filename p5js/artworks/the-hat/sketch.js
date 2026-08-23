import {
  HAT_OUTLINE,
  boundsOf,
  createHatPatch,
  nestingRounds,
  transformPoint,
  transformedOutline
} from "./hat.js";

/**
 * A finite H-supertile from the Hat's substitution system: 169 copies of one polykite,
 * including the reflected copies that count as the same tile under the paper's convention.
 * One current of light crosses the whole masonry. Kiln variation distinguishes the pieces,
 * while a deeper firing and shallow relief reveal each reflected copy.
 *
 * The clip is the substitution, laid. The patch of two rounds holds a copy of the patch
 * of one round, which holds the bare H metatile of four hats, so the masonry can be built
 * in the order the rule makes it: four bricks, then the twenty-one that turn them into a
 * round-one patch, then the hundred and forty-four that turn that into this one. Every
 * brick is at its final place from the moment it is laid — the stages are nested, not
 * rescaled — so nothing in the picture ever moves, and the last frame is the whole patch.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const PLAYBACK_FPS = 30;

/**
 * The clip's plan, in frames: each round of the substitution is laid and then held, so a
 * reader is given the finished shape of every stage rather than a wall that never stops
 * arriving. The rounds get longer because they have more to lay -- four bricks, then
 * twenty-one, then a hundred and forty-four -- and the last hold carries the whole patch.
 */
const STAGE_PLAN = [
  { laying: 0, holding: 30 },
  { laying: 60, holding: 30 },
  { laying: 150, holding: 30 }
];
const TOTAL_FRAMES = STAGE_PLAN.reduce(
  (total, stage) => total + stage.laying + stage.holding,
  0
);

const GROUND = [230, 224, 208];
const BRICK_LIGHT = [236, 208, 160];
const HEADER_BURN = [132, 57, 42];
const RELIEF_SHADOW = [126, 73, 52];
const MORTAR_GAP = 0.045;
const RELIEF_SHIFT = 0.07;
const KILN_PALETTE = [
  [174, 72, 55],
  [196, 106, 74],
  [216, 91, 52],
  [190, 91, 48],
  [222, 158, 96],
  [207, 146, 70],
  [201, 126, 111],
  [161, 103, 104]
];
/** Small value steps within one brick family keep the substitution ancestry legible. */
const LABEL_LIFT = {
  H: 0.025,
  T: 0.075,
  P: -0.015,
  F: -0.06,
  H1: 0.025
};
const TILES = createHatPatch(2);
const PATCH_BOUNDS = boundsOf(TILES);
const PATCH_TILT = -Math.PI / 60;

function turned(point, angle) {
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle)
  };
}

/**
 * The masonry is fitted by the ink it actually puts down rather than by the bounds of the
 * unturned patch. The patch is nearly square — 33.000 by 32.909 — and the slight tilt it
 * is laid at moves the ink off the centre of those bounds, so measuring the turned outline
 * is what lets the same margin be left on all four sides.
 */
const PATCH_MIDDLE = {
  x: (PATCH_BOUNDS.minX + PATCH_BOUNDS.maxX) / 2,
  y: (PATCH_BOUNDS.minY + PATCH_BOUNDS.maxY) / 2
};
const INK = (() => {
  const turnedVertices = TILES.flatMap(transformedOutline).map(
    (vertex) => turned({ x: vertex.x - PATCH_MIDDLE.x, y: vertex.y - PATCH_MIDDLE.y }, PATCH_TILT)
  );
  const minX = Math.min(...turnedVertices.map((vertex) => vertex.x));
  const maxX = Math.max(...turnedVertices.map((vertex) => vertex.x));
  const minY = Math.min(...turnedVertices.map((vertex) => vertex.y));
  const maxY = Math.max(...turnedVertices.map((vertex) => vertex.y));
  return { width: maxX - minX, height: maxY - minY, midX: (minX + maxX) / 2, midY: (minY + maxY) / 2 };
})();

/** The bed of page left round the masonry, in logical pixels, the same on every side. */
const PATCH_MARGIN = 35;
const PATCH_SCALE = Math.min(
  (LOGICAL_WIDTH - 2 * PATCH_MARGIN) / INK.width,
  (LOGICAL_HEIGHT - 2 * PATCH_MARGIN) / INK.height
);

/** Turned back into patch coordinates, this is the point that lands on the page's centre. */
const PATCH_CENTRE = (() => {
  const back = turned({ x: INK.midX, y: INK.midY }, -PATCH_TILT);
  return { x: PATCH_MIDDLE.x + back.x, y: PATCH_MIDDLE.y + back.y };
})();

/**
 * The current of light is placed on the masonry rather than on the page: its centre and
 * its two radii are fractions of the drawn patch, so it keeps its bearing on the bricks
 * — up and to the right of centre, agreeing with the across-and-down gradient the kiln
 * colours are mixed on — whatever size the page is.
 */
const INK_WIDTH_ON_PAGE = INK.width * PATCH_SCALE;
const INK_HEIGHT_ON_PAGE = INK.height * PATCH_SCALE;
const LIGHT = {
  x: (LOGICAL_WIDTH - INK_WIDTH_ON_PAGE) / 2 + 0.6173 * INK_WIDTH_ON_PAGE,
  y: (LOGICAL_HEIGHT - INK_HEIGHT_ON_PAGE) / 2 + 0.4277 * INK_HEIGHT_ON_PAGE,
  inner: 0.03504 * INK_WIDTH_ON_PAGE,
  outer: 0.876 * INK_WIDTH_ON_PAGE
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

  const drawings = TILES.map((tile, index) => ({ ...tileDrawing(tile), index }));

  /**
   * The order the bricks are laid in: by the round of the substitution that first put each
   * one on the paper, and within a round outward from the seed, so the masonry grows from
   * the four hats it starts as rather than filling in from a corner.
   */
  const ROUNDS = nestingRounds(2, (candidates, covered) => {
    // Variant B: of the copies a round can sit in, the one whose ink is nearest the middle
    // of the page. The patch is the same patch either way -- what this settles is which of
    // its own sub-patches the clip walks into, and so where the seed stands.
    const reach = (tiles) => {
      const points = tiles.flatMap(transformedOutline);
      const middle = {
        x: points.reduce((total, point) => total + point.x, 0) / points.length,
        y: points.reduce((total, point) => total + point.y, 0) / points.length
      };
      return Math.hypot(middle.x - PATCH_CENTRE.x, middle.y - PATCH_CENTRE.y);
    };
    let best = 0;
    covered.forEach((tiles, index) => {
      if (reach(tiles) < reach(covered[best])) {
        best = index;
      }
    });
    return candidates[best];
  });
  const SEED_CENTRE = (() => {
    const seed = drawings.filter((unused, index) => ROUNDS[index] === 0);
    const sum = seed.reduce(
      (total, drawing) => ({ x: total.x + drawing.centre.x, y: total.y + drawing.centre.y }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / seed.length, y: sum.y / seed.length };
  })();
  const LAYING_ORDER = drawings
    .map((drawing, index) => ({
      index,
      round: ROUNDS[index],
      reach: Math.hypot(drawing.centre.x - SEED_CENTRE.x, drawing.centre.y - SEED_CENTRE.y)
    }))
    .sort((first, second) => first.round - second.round || first.reach - second.reach);
  /** Where each brick stands in that order, so a reveal is a comparison and not a search. */
  const LAID_AT = (() => {
    const places = new Array(drawings.length);
    LAYING_ORDER.forEach((entry, place) => {
      places[entry.index] = place;
    });
    return places;
  })();

  /**
   * How many bricks are standing at `frameIndex`. A pure function of the index: a frame
   * asked for twice is the same frame, which is what lets a thumbnail jump to one.
   */
  function laidBy(frameIndex) {
    let standing = 0;
    let start = 0;
    for (let stage = 0; stage < STAGE_PLAN.length; stage += 1) {
      const target = ROUNDS.filter((round) => round <= stage).length;
      const { laying, holding } = STAGE_PLAN[stage];
      if (frameIndex < start + laying) {
        const part = laying === 0 ? 1 : (frameIndex - start) / laying;
        return Math.round(standing + (target - standing) * part);
      }
      if (frameIndex < start + laying + holding) {
        return target;
      }
      standing = target;
      start += laying + holding;
    }
    return drawings.length;
  }

  function insetVertices(drawing) {
    return drawing.vertices.map((vertex) => ({
      x: drawing.centre.x + (vertex.x - drawing.centre.x) * (1 - MORTAR_GAP),
      y: drawing.centre.y + (vertex.y - drawing.centre.y) * (1 - MORTAR_GAP)
    }));
  }

  function kilnIndex(drawing) {
    const seed = drawing.centre.x * 12.9898
      + drawing.centre.y * 78.233
      + drawing.matrix[0] * 37.719
      + drawing.matrix[3] * 19.913;
    const value = Math.sin(seed) * 43758.5453;
    return Math.floor((value - Math.floor(value)) * KILN_PALETTE.length);
  }

  /** A continuous light crosses the individual variation of one kiln load. */
  function brickColour(drawing) {
    const across = (drawing.centre.x - PATCH_BOUNDS.minX)
      / (PATCH_BOUNDS.maxX - PATCH_BOUNDS.minX);
    const down = (drawing.centre.y - PATCH_BOUNDS.minY)
      / (PATCH_BOUNDS.maxY - PATCH_BOUNDS.minY);
    const light = clamp(
      0.07 + 0.09 * across - 0.05 * down + LABEL_LIFT[drawing.label],
      0,
      0.24
    );
    const brick = mixColour(KILN_PALETTE[kilnIndex(drawing)], BRICK_LIGHT, light);
    return drawing.reflected ? mixColour(brick, HEADER_BURN, 0.72) : brick;
  }

  function drawReliefShadow(drawing) {
    p.noStroke();
    p.fill(...RELIEF_SHADOW, 120);
    polygon(insetVertices(drawing).map((vertex) => ({
      x: vertex.x + RELIEF_SHIFT,
      y: vertex.y + RELIEF_SHIFT * 1.25
    })));
  }

  function drawBrick(drawing) {
    p.noStroke();
    p.fill(...brickColour(drawing));
    polygon(insetVertices(drawing));
  }

  function drawGroundLight() {
    const context = p.drawingContext;
    context.save();
    context.scale(RENDER_SCALE, RENDER_SCALE);
    const glow = context.createRadialGradient(
      LIGHT.x, LIGHT.y, LIGHT.inner,
      LIGHT.x, LIGHT.y, LIGHT.outer
    );
    glow.addColorStop(0, "rgba(222, 158, 96, 0.10)");
    glow.addColorStop(0.55, "rgba(196, 106, 74, 0.045)");
    glow.addColorStop(1, "rgba(230, 224, 208, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    context.restore();
  }

  /**
   * The masonry with `standing` bricks laid. The bricks are walked in the order the patch
   * hands them out rather than the order they are laid in, so which brick's relief falls
   * over which never depends on how far the clip has got: the last frame is the drawing
   * this artwork has always been, shape for shape.
   */
  function drawAll(standing = drawings.length) {
    const laid = (drawing) => LAID_AT[drawing.index] < standing;
    p.push();
    p.background(...GROUND);
    drawGroundLight();

    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(PATCH_TILT);
    p.scale(PATCH_SCALE);
    p.translate(-PATCH_CENTRE.x, -PATCH_CENTRE.y);
    for (const drawing of drawings.filter(laid)) {
      drawBrick(drawing);
    }
    // Warm offset fills give the reflected headers shallow relief without dark outlines.
    for (const drawing of drawings.filter((entry) => entry.reflected && laid(entry))) {
      drawReliefShadow(drawing);
    }
    for (const drawing of drawings.filter((entry) => entry.reflected && laid(entry))) {
      drawBrick(drawing);
    }
    p.pop();
  }

  function publishState(frameIndex, standing) {
    const labels = Object.fromEntries(Object.keys(LABEL_LIFT).map((label) => [
      label,
      TILES.filter((tile) => tile.label === label).length
    ]));
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      standingTiles: standing,
      tilesByRound: [0, 1, 2].map((round) => ROUNDS.filter((entry) => entry === round).length),
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

  /** Draws the masonry as far as `frameIndex` has laid it, and says how far that was. */
  function drawFrame(frameIndex) {
    const standing = laidBy(frameIndex);
    drawAll(standing);
    return standing;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page lays the patch to the same plan the clip follows, frame for frame.
    publishState(p.frameCount, drawFrame(p.frameCount));
    if (p.frameCount >= TOTAL_FRAMES) {
      p.noLoop();
    }
  };
});

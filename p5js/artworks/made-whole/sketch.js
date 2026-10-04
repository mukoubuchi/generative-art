import {
  ACTS,
  COMPLETED_SIDE,
  CORNER_WAVES,
  DURATION_SECONDS,
  GIVEN_AREA,
  LOGICAL_SIZE,
  PAGE_MARGIN,
  PLAYBACK_FPS,
  REGIONS,
  ROOT_COEFFICIENT,
  ROOT_TILES,
  TOTAL_FRAMES,
  UNKNOWN_SIDE,
  UNKNOWN_TILES,
  UNIT_ON_PAGE,
  eased,
  regionOnPage,
  sceneAt
} from "./made-whole.js";

/**
 * A square, ten roots, and the corner that completes them, counted tile by tile.
 *
 * This is the second of al-Khwarizmi's two geometric explanations of x² + 10x = 39. The
 * unknown square is laid one unit tile at a time, nine of them; the two roots of five,
 * fifteen and fifteen; the empty corner is outlined; its twenty-five tiles arrive in
 * diagonal waves; and the side of the whole is counted along its top, eight, of which the
 * corner's five fall away and leave the three. There are no labels on the page: the tiles,
 * their colours and the marks along the top do all the saying.
 */

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/** The paper the gallery prints on, and one near-black ink for edges and marks. */
const PAPER = [230, 224, 208];
const INK = [38, 34, 40];
/**
 * One colour to each part of the proof, from the paper works' own: One Yin, One Yang's
 * blue for the unknown square, Herringbone's russet for the roots, One Yin, One Yang's
 * ochre for the corner that completes them.
 */
const COLOURS = Object.freeze({
  unknown: [56, 78, 112],
  root: [166, 110, 66],
  completion: [214, 152, 58]
});

const UNKNOWN = REGIONS.find((region) => region.id === "unknown");
const HORIZONTAL_ROOT = REGIONS.find((region) => region.id === "root-horizontal");
const VERTICAL_ROOT = REGIONS.find((region) => region.id === "root-vertical");
const COMPLETION = REGIONS.find((region) => region.id === "completion");

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function corners(rectangle) {
  const { x, y, width, height } = rectangle;
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
}

const P5 = window.p5;

new P5((p) => {
  function polygon(points, colour, alpha = 255) {
    p.noStroke();
    p.fill(...colour, alpha);
    p.beginShape();
    for (const [x, y] of points) p.vertex(x, y);
    p.endShape(p.CLOSE);
  }

  function outline(points, colour, alpha, weight) {
    p.noFill();
    p.stroke(...colour, alpha);
    p.strokeWeight(weight);
    p.beginShape();
    for (const [x, y] of points) p.vertex(x, y);
    p.endShape(p.CLOSE);
  }

  /**
   * Unit tiles with a joint between them, the first `count` of them laid, in reading order
   * or in diagonal waves. A tile part-laid is still settling: it fades in as it drops the
   * last fourteen pixels into its place.
   */
  function drawTiles(rectangle, colour, count, order = "rows") {
    const columns = Math.round(rectangle.width / UNIT_ON_PAGE);
    const rows = Math.round(rectangle.height / UNIT_ON_PAGE);
    const list = [];
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) list.push([column, row]);
    if (order === "diagonal") list.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    list.forEach(([column, row], index) => {
      const shown = order === "diagonal" ? clamp01(count - (column + row)) : clamp01(count - index);
      if (shown <= 0) return;
      const size = UNIT_ON_PAGE - 4;
      const lift = (1 - eased(shown)) * 14;
      polygon(corners({
        x: rectangle.x + column * UNIT_ON_PAGE + 2,
        y: rectangle.y + row * UNIT_ON_PAGE + 2 - lift,
        width: size,
        height: size
      }), colour, 255 * eased(shown));
    });
  }

  /** The empty corner, outlined while the thirty-nine wait for it. */
  function drawGap(scene) {
    if (scene.gap <= 0) return;
    const gap = regionOnPage(COMPLETION);
    p.drawingContext.setLineDash([6, 6]);
    outline(corners(gap), INK, 200 * scene.gap, 1.4);
    p.drawingContext.setLineDash([]);
  }

  /**
   * The count: the whole square's edge, the side counted unit by unit along the top, eight
   * marks, then the five of the corner's side falling away and the three of the unknown
   * remaining, with the unknown square drawn heavy.
   */
  function drawCount(scene) {
    if (scene.count <= 0) return;
    const whole = { x: PAGE_MARGIN, y: PAGE_MARGIN, width: COMPLETED_SIDE * UNIT_ON_PAGE, height: COMPLETED_SIDE * UNIT_ON_PAGE };
    outline(corners(whole), INK, 255 * scene.count, 2.6);
    for (let index = 0; index < COMPLETED_SIDE; index += 1) {
      const shown = clamp01(scene.sideCount - index);
      if (shown <= 0) continue;
      const fade = index >= UNKNOWN_SIDE ? 1 - scene.fallAway : 1;
      const x = PAGE_MARGIN + index * UNIT_ON_PAGE;
      p.noStroke();
      p.fill(...INK, 255 * shown * fade);
      p.rect(x + 6, PAGE_MARGIN - 22, UNIT_ON_PAGE - 12, 8, 2);
    }
    if (scene.fallAway > 0) {
      const three = { x: PAGE_MARGIN, y: PAGE_MARGIN, width: UNKNOWN_SIDE * UNIT_ON_PAGE, height: UNKNOWN_SIDE * UNIT_ON_PAGE };
      outline(corners(three), INK, 255 * scene.fallAway, 2 + 2.4 * scene.fallAway);
    }
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...PAPER);
    p.push();
    p.scale(RENDER_SCALE);
    drawTiles(regionOnPage(UNKNOWN), COLOURS.unknown, scene.unknownTiles);
    drawTiles(regionOnPage(HORIZONTAL_ROOT), COLOURS.root, Math.min(ROOT_TILES / 2, scene.rootTiles));
    drawTiles(regionOnPage(VERTICAL_ROOT), COLOURS.root, Math.max(0, scene.rootTiles - ROOT_TILES / 2));
    drawGap(scene);
    drawTiles(regionOnPage(COMPLETION), COLOURS.completion, scene.cornerWave, "diagonal");
    drawCount(scene);
    p.pop();
    return scene;
  }

  function publishState(scene) {
    const state = {
      kind: "video",
      frameIndex: scene.frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
      actName: ACTS[scene.act],
      tiles: {
        unknown: scene.unknownTiles,
        roots: scene.rootTiles,
        cornerWaves: scene.cornerWave,
        of: [UNKNOWN_TILES, ROOT_TILES, CORNER_WAVES]
      },
      sideCount: scene.sideCount,
      proof: {
        roots: ROOT_COEFFICIENT,
        givenArea: GIVEN_AREA,
        completedSide: COMPLETED_SIDE,
        unknownSide: UNKNOWN_SIDE
      },
      palette: "blue, russet and ochre on paper",
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(drawFrame(frameIndex));
  };
});

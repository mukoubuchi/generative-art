import {
  ACTS,
  COMPLETED_SIDE,
  COMPLETED_SIDE_ON_PAGE,
  DURATION_SECONDS,
  GIVEN_AREA,
  HALF_UNIT_ON_PAGE,
  LOGICAL_SIZE,
  PAGE_MARGIN,
  PLAYBACK_FPS,
  REGIONS,
  ROOT_COEFFICIENT,
  TOTAL_FRAMES,
  UNKNOWN_SIDE,
  UNIT_ON_PAGE,
  regionOnPage,
  sceneAt
} from "./made-whole.js";

/**
 * A square, ten roots, and the corner that completes them.
 *
 * This is the second of al-Khwarizmi's two geometric explanations of x² + 10x = 39.
 * Five roots are laid along each of two sides of the unknown square, leaving a five-by-five
 * corner. When that corner drops into place, the completed field is eight by eight and the
 * unknown at its upper left is three by three. There are no labels on the page: the unit
 * grid, the direction of the hatching, and the weight of the boundaries do all the saying.
 */

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/** Paper and ink are shared with the two still plates in the same register. */
const PAPER = [230, 224, 208];
const INK = [38, 34, 40];
/** One earth colour, confined to the piece that was absent from the equation. */
const UMBER = [156, 100, 66];
const COMPLETION_INK = UMBER;

const UNKNOWN = REGIONS.find((region) => region.id === "unknown");
const HORIZONTAL_ROOT = REGIONS.find((region) => region.id === "root-horizontal");
const VERTICAL_ROOT = REGIONS.find((region) => region.id === "root-vertical");
const COMPLETION = REGIONS.find((region) => region.id === "completion");

const P5 = window.p5;

new P5((p) => {
  function drawHatch(rectangle, direction, colour, alpha, spacing) {
    p.noFill();
    p.stroke(...colour, alpha);
    p.strokeWeight(0.75);

    if (direction === "horizontal" || direction === "cross") {
      for (let offset = spacing; offset < rectangle.height; offset += spacing) {
        p.line(
          rectangle.x + 3,
          rectangle.y + offset,
          rectangle.x + rectangle.width - 3,
          rectangle.y + offset
        );
      }
    }
    if (direction === "vertical" || direction === "cross") {
      for (let offset = spacing; offset < rectangle.width; offset += spacing) {
        p.line(
          rectangle.x + offset,
          rectangle.y + 3,
          rectangle.x + offset,
          rectangle.y + rectangle.height - 3
        );
      }
    }
    if (direction === "diagonal" || direction === "cross") {
      for (
        let intercept = -rectangle.height + spacing;
        intercept < rectangle.width;
        intercept += spacing
      ) {
        const fromY = Math.max(0, -intercept);
        const toY = Math.min(rectangle.height, rectangle.width - intercept);
        if (toY <= fromY) {
          continue;
        }
        p.line(
          rectangle.x + intercept + fromY,
          rectangle.y + fromY,
          rectangle.x + intercept + toY,
          rectangle.y + toY
        );
      }
    }
  }

  function drawCellGrid(rectangle, colour, alpha) {
    p.noFill();
    p.stroke(...colour, alpha);
    p.strokeWeight(0.65);
    for (let offset = UNIT_ON_PAGE; offset < rectangle.width - 0.5; offset += UNIT_ON_PAGE) {
      p.line(
        rectangle.x + offset,
        rectangle.y,
        rectangle.x + offset,
        rectangle.y + rectangle.height
      );
    }
    for (let offset = UNIT_ON_PAGE; offset < rectangle.height - 0.5; offset += UNIT_ON_PAGE) {
      p.line(
        rectangle.x,
        rectangle.y + offset,
        rectangle.x + rectangle.width,
        rectangle.y + offset
      );
    }
  }

  function drawField(rectangle, colour, alpha) {
    p.noStroke();
    p.fill(...colour, alpha);
    p.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  }

  /**
   * A border kept inside its rectangle. Canvas strokes straddle their path, which makes a
   * 480-pixel square occupy 481 pixel columns and leaves one raster margin a pixel shorter
   * than its opposite. Four narrow fields keep the mathematical edge and the PNG edge the
   * same edge: the final plate has equal integer margins on all four sides.
   */
  function drawInsideBorder(rectangle, colour, alpha, weight) {
    p.noStroke();
    p.fill(...colour, alpha);
    p.rect(rectangle.x, rectangle.y, rectangle.width, weight);
    p.rect(rectangle.x, rectangle.y + rectangle.height - weight, rectangle.width, weight);
    p.rect(rectangle.x, rectangle.y, weight, rectangle.height);
    p.rect(rectangle.x + rectangle.width - weight, rectangle.y, weight, rectangle.height);
  }

  function drawRegion(region, options = {}) {
    const rectangle = regionOnPage(region);
    const reveal = options.reveal ?? 1;
    if (region.id === "root-horizontal") {
      rectangle.width *= reveal;
    } else if (region.id === "root-vertical") {
      rectangle.height *= reveal;
    }
    rectangle.y += (options.offsetTwice ?? 0) * HALF_UNIT_ON_PAGE;
    if (rectangle.width <= 0 || rectangle.height <= 0) {
      return;
    }

    const colour = options.colour ?? INK;
    // Each part is a sheet of the same paper, not a translucent wash. This is what lets
    // the missing corner pass behind the thirty-nine rather than show through it.
    drawField(rectangle, PAPER, 255);
    drawField(rectangle, colour, options.fillAlpha ?? 12);
    drawHatch(
      rectangle,
      options.hatch ?? "diagonal",
      colour,
      options.hatchAlpha ?? 80,
      options.spacing ?? 12
    );
    drawCellGrid(rectangle, colour, options.gridAlpha ?? 32);
    drawInsideBorder(
      rectangle,
      colour,
      options.borderAlpha ?? 190,
      options.borderWeight ?? 1.5
    );
  }

  function drawCountingGrid(amount) {
    if (amount <= 0) {
      return;
    }
    const edge = PAGE_MARGIN + COMPLETED_SIDE_ON_PAGE;
    p.noFill();
    p.stroke(...INK, 32 + 76 * amount);
    p.strokeWeight(0.55 + 0.35 * amount);
    for (let index = 1; index < COMPLETED_SIDE; index += 1) {
      const at = PAGE_MARGIN + index * UNIT_ON_PAGE;
      p.line(at, PAGE_MARGIN, at, edge);
      p.line(PAGE_MARGIN, at, edge, at);
    }
    const whole = {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN,
      width: COMPLETED_SIDE_ON_PAGE,
      height: COMPLETED_SIDE_ON_PAGE
    };
    drawInsideBorder(whole, INK, 190 + 50 * amount, 1.8 + 0.8 * amount);

    // The original square is the three-by-three count at the upper-left of the whole.
    drawInsideBorder({
      x: PAGE_MARGIN,
      y: PAGE_MARGIN,
      width: UNKNOWN_SIDE * UNIT_ON_PAGE,
      height: UNKNOWN_SIDE * UNIT_ON_PAGE
    }, INK, 205 + 45 * amount, 2.2 + 1.2 * amount);
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...PAPER);
    p.push();
    p.scale(RENDER_SCALE);
    p.strokeCap(p.SQUARE);
    p.strokeJoin(p.MITER);

    // The missing corner travels behind the thirty-nine already on the page. Clipping it to
    // the final gap keeps the part still above the construction hidden as it falls.
    if (scene.completion > 0) {
      const isMoving = scene.completion < 1;
      if (isMoving) {
        const gap = regionOnPage(COMPLETION);
        p.drawingContext.save();
        p.drawingContext.beginPath();
        p.drawingContext.rect(gap.x, gap.y, gap.width, gap.height);
        p.drawingContext.clip();
      }
      drawRegion(COMPLETION, {
        offsetTwice: scene.completionOffsetTwice,
        colour: COMPLETION_INK,
        fillAlpha: 28,
        hatchAlpha: 142,
        gridAlpha: 54,
        borderAlpha: 185,
        borderWeight: 1.35,
        hatch: "diagonal",
        spacing: 13
      });
      if (isMoving) {
        p.drawingContext.restore();
      }
    }

    drawRegion(UNKNOWN, {
      fillAlpha: 20,
      hatchAlpha: 88,
      gridAlpha: 44,
      borderAlpha: 225,
      borderWeight: 2.4,
      hatch: "cross",
      spacing: 14
    });
    if (scene.horizontalRoot > 0) {
      drawRegion(HORIZONTAL_ROOT, {
        reveal: scene.horizontalRoot,
        fillAlpha: 11,
        hatchAlpha: 82,
        gridAlpha: 36,
        borderAlpha: 198,
        borderWeight: 1.7,
        hatch: "horizontal",
        spacing: 11
      });
    }
    if (scene.verticalRoot > 0) {
      drawRegion(VERTICAL_ROOT, {
        reveal: scene.verticalRoot,
        fillAlpha: 11,
        hatchAlpha: 82,
        gridAlpha: 36,
        borderAlpha: 198,
        borderWeight: 1.7,
        hatch: "vertical",
        spacing: 11
      });
    }
    drawCountingGrid(scene.count);
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
      rootProgress: [scene.horizontalRoot, scene.verticalRoot],
      completionProgress: scene.completion,
      countProgress: scene.count,
      proof: {
        roots: ROOT_COEFFICIENT,
        givenArea: GIVEN_AREA,
        completedSide: COMPLETED_SIDE,
        unknownSide: UNKNOWN_SIDE
      },
      palette: "umber",
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

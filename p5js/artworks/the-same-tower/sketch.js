import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawPointerIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  DURATION_SECONDS,
  FLOOR_COUNT,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  RIM_SEGMENTS,
  STAGE_SCALE,
  TOTAL_FRAMES,
  leverAtFrame,
  leverFromPointer,
  pointerAtLever,
  sceneAtLever
} from "./the-same-tower.js";

/**
 * A tower drawn in hairlines on a night ground, and an eye that walks towards it. Far
 * off, the floors are circles and the tower a cylinder; close to, they are squares and
 * the tower a prism; on the way they are neither. Nothing about the tower changes. The
 * eye keeps the tower at one size as it walks -- the field of view narrows with the
 * distance -- so what the reader watches is a shape changing and not a thing approaching.
 *
 * On the page the pointer is the walk: left is far, right is near. The clip replays a
 * recorded walk in and back out, resting at both stations, with the hand drawn where it
 * would have to be.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "move", text: "walk towards the tower and back" }
];
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/**
 * The night the collection's darkest artworks stand on, and the crown of Lorenz
 * Ribbons' leader ramp for the lines: the one ground nearest to black in the catalogue
 * and the one line nearest to white, so the tower is drawn and not painted.
 */
const GROUND = [6, 7, 12];
const LINE = [246, 244, 236];
const LINE_WEIGHT = 1.4;

/** The stage's clipping planes, in stage units, well outside the walk and the tower. */
const NEAR_PLANE = STAGE_SCALE * 0.5;
const FAR_PLANE = STAGE_SCALE * 40;

/**
 * The tower's coordinates onto p5's stage: across stays across, up becomes negative
 * `y` because the stage's `y` points down, and depth away from the eyes becomes
 * negative `z` because the stage's `z` points at the viewer.
 */
function onStage([x, y, z]) {
  // Negating a zero would leave a negative zero, which draws the same but reads as a
  // different number when the eye's place is compared with the module's.
  const negate = (value) => (value === 0 ? 0 : -value);
  return [x * STAGE_SCALE, negate(z * STAGE_SCALE), negate(y * STAGE_SCALE)];
}

const P5 = window.p5;

new P5((p) => {
  function drawPolyline(points) {
    for (let index = 1; index < points.length; index += 1) {
      p.line(...onStage(points[index - 1]), ...onStage(points[index]));
    }
  }

  function drawScene(scene) {
    p.background(...GROUND);
    // The eye of this frame: its field of view is the one that keeps the tower at its
    // size, and the eye and what it looks at are the module's own points on the stage.
    p.perspective(scene.fieldOfView, 1, NEAR_PLANE, FAR_PLANE);
    p.camera(...onStage(scene.eye), ...onStage(scene.lookAt), 0, 1, 0);
    p.noFill();
    p.stroke(...LINE);
    p.strokeWeight(LINE_WEIGHT * RENDER_SCALE);
    for (const floor of scene.floors) {
      drawPolyline(floor);
    }
    for (const [from, to] of scene.verticals) {
      p.line(...onStage(from), ...onStage(to));
    }
  }

  /**
   * The legend is 2D type, and WEBGL will not set type without a font loaded for it --
   * so it is drawn on a plain surface of its own and laid over the frame as an image,
   * under the stage's default eye rather than the walking one.
   */
  let overlay;

  function drawOverlay(draw) {
    if (!overlay) {
      overlay = p.createGraphics(OUTPUT_SIZE, OUTPUT_SIZE);
      overlay.pixelDensity(1);
    }
    overlay.clear();
    overlay.push();
    overlay.scale(RENDER_SCALE);
    draw(overlay);
    overlay.pop();
    p.push();
    p.perspective();
    p.camera();
    p.resetMatrix();
    p.image(overlay, -OUTPUT_SIZE / 2, -OUTPUT_SIZE / 2);
    p.pop();
  }

  function drawLegend() {
    drawOverlay((surface) => {
      drawKeyHint(surface, HINT_LEGEND, LOGICAL_SIZE, LOGICAL_SIZE, HINT.scale);
    });
  }

  /**
   * The hand is circles, which WEBGL draws without a font, so it goes straight onto the
   * frame under the default eye: the exported clip must stay one canvas, because the
   * renderer screenshots the page's only canvas frame by frame.
   */
  function drawHand(lever) {
    const hand = pointerAtLever(lever, LOGICAL_SIZE, LOGICAL_SIZE);
    p.push();
    p.perspective();
    p.camera();
    p.resetMatrix();
    p.translate(-OUTPUT_SIZE / 2, -OUTPUT_SIZE / 2);
    p.scale(RENDER_SCALE);
    drawPointerIndicator(p, hand.x, hand.y, LOGICAL_SIZE, LOGICAL_SIZE);
    p.pop();
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      lever: scene.lever,
      distance: scene.distance,
      fieldOfView: scene.fieldOfView,
      eye: scene.eye,
      floors: FLOOR_COUNT,
      rimSegments: RIM_SEGMENTS,
      verticals: scene.verticals.length,
      palette: "night",
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE, p.WEBGL).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists. Before it, p5 has
    // nothing to set the density on and the call is quietly ignored; on a Retina screen
    // the backing store then comes out twice the size asked for. Left alone in the
    // browser, so a reader on such a screen gets the picture drawn at their own
    // resolution -- and pinned here, so an export is the size the manifest says
    // rather than whatever density the machine doing the rendering happens to have.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.setAttributes("preserveDrawingBuffer", true);
    // One weight for every line wherever it stands: a drawing's hairline, not a wire
    // that thickens as it comes nearer. It is also what lets the far station's picture be
    // held against a drawn circle pixel for pixel -- the floor's points lie at other
    // depths than the circle's, and a stroke scaled by depth would differ in width where
    // the geometry does not differ at all.
    p.linePerspective(false);
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is the walk read at its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => {
        const scene = sceneAtLever(leverAtFrame(frameIndex));
        p.push();
        drawScene(scene);
        p.pop();
        if (INDICATOR) {
          // The hand that is walking the eye, where the page would have it.
          drawHand(scene.lever);
        }
        if (HINT.shown) {
          drawLegend();
        }
        return Promise.resolve(publishState(frameIndex, scene));
      };
    }
    const opening = sceneAtLever(0);
    p.push();
    drawScene(opening);
    p.pop();
    // The legend's surface is a second canvas, and a capture is checked at load for
    // having exactly one; a thumbnail asks for the legend through __renderFrame anyway.
    if (HINT.shown && !CAPTURE_MODE) {
      drawLegend();
    }
    publishState(0, opening);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The pointer's place across the canvas is how far the eye has walked.
    const lever = leverFromPointer(p.mouseX, LOGICAL_SIZE);
    const scene = sceneAtLever(lever);
    p.push();
    drawScene(scene);
    p.pop();
    if (HINT.shown) {
      drawLegend();
    }
    publishState(p.frameCount % TOTAL_FRAMES, scene);
  };
});

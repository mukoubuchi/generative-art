import { pinLogicalCamera } from "../shared/camera-scale.js";
import { hintMode } from "../shared/hint-mode.js";
import { drawKeyHint } from "../shared/key-hint.js";
import { edgesOf } from "./geometry.js";
import { TOTAL_FRAMES, nestedSolids, sceneState } from "./staging.js";

/**
 * Two solids trading places forever. The icosahedron ignites a spark on the centre of
 * each face; the sparks are already the dodecahedron's corners, and once its edges
 * close around them the old solid thins to a ghost and goes. Then the dodecahedron
 * does the same, and what its sparks assemble is the icosahedron again, smaller by the
 * square of the one ratio both solids share. The camera closes in at that ratio's
 * pace, the stage turns a fifth of a turn, and the clip's last frame is its first.
 *
 * Everything is drawn as crystal: translucent faces with the depth test off, layered
 * inner to outer, because nested convex solids cannot share a depth buffer without one
 * of them losing — and the point of the nesting is to see it.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "drag", text: "the stage turns in your hand" }
];
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

/** The outer solid's circumradius in logical pixels; the zoom keeps the reigning one here. */
const MODEL_SCALE = 252;
/** The camera's standing tilt, gentle enough that the vertical five-fold axis reads. */
const STAGE_TILT = 0.42;
/** Sparks: the coming solid's corners, born on the going solid's faces. */
const SPARK_RADIUS = 7;

const BACKGROUND = [11, 13, 19];
/** The icosahedron's family: gold. */
const GOLD_FACE = [222, 166, 96];
const GOLD_EDGE = [252, 204, 116];
/** The dodecahedron's family: steel. */
const STEEL_FACE = [104, 144, 204];
const STEEL_EDGE = [156, 192, 240];
/** Face ink is a whisper; the crystal look is the whisper layered. */
const FACE_ALPHA = 46;
const EDGE_ALPHA = 235;

/** Directions light arrives from, unit length, fixed to the stage. */
const KEY_LIGHT = [-0.42, 0.52, -0.74];
const FILL_LIGHT = [0.66, -0.3, 0.69];

const SOLIDS = nestedSolids();
const BANDS = [
  { name: "inner", solid: SOLIDS.inner, face: GOLD_FACE, edge: GOLD_EDGE },
  { name: "middle", solid: SOLIDS.middle, face: STEEL_FACE, edge: STEEL_EDGE },
  { name: "outer", solid: SOLIDS.outer, face: GOLD_FACE, edge: GOLD_EDGE }
];
for (const band of BANDS) {
  band.edges = edgesOf(band.solid);
  band.normals = band.solid.faces.map((face) => {
    const [a, b, c] = face.map((index) => band.solid.vertices[index]);
    const first = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const second = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const raw = [
      first[1] * second[2] - first[2] * second[1],
      first[2] * second[0] - first[0] * second[2],
      first[0] * second[1] - first[1] * second[0]
    ];
    const size = Math.hypot(...raw);
    return raw.map((part) => part / size);
  });
}

const P5 = window.p5;

/** Shading folded in |N . L|: a crystal has no inside to keep the sign for. */
function shade(base, normal) {
  const key = Math.abs(
    normal[0] * KEY_LIGHT[0] + normal[1] * KEY_LIGHT[1] + normal[2] * KEY_LIGHT[2]
  );
  const fill = Math.abs(
    normal[0] * FILL_LIGHT[0] + normal[1] * FILL_LIGHT[1] + normal[2] * FILL_LIGHT[2]
  );
  return base.map((component) => component * (0.35 + 0.5 * key + 0.25 * fill));
}

const drag = { active: false, spin: 0, tilt: 0 };

new P5((p) => {
  function drawBand(band, alphas) {
    if (alphas.faceAlpha <= 0 && alphas.edgeAlpha <= 0) {
      return;
    }
    if (alphas.faceAlpha > 0) {
      p.noStroke();
      band.solid.faces.forEach((face, faceIndex) => {
        p.fill(...shade(band.face, band.normals[faceIndex]), FACE_ALPHA * alphas.faceAlpha);
        p.beginShape();
        for (const index of face) {
          p.vertex(...band.solid.vertices[index].map((part) => part * MODEL_SCALE));
        }
        p.endShape(p.CLOSE);
      });
    }
    if (alphas.edgeAlpha > 0) {
      p.noFill();
      p.stroke(...band.edge, EDGE_ALPHA * alphas.edgeAlpha);
      p.strokeWeight(1.7 * RENDER_SCALE);
      for (const [from, to] of band.edges) {
        p.line(
          ...band.solid.vertices[from].map((part) => part * MODEL_SCALE),
          ...band.solid.vertices[to].map((part) => part * MODEL_SCALE)
        );
      }
    }
  }

  function drawSparks(solid, family, strength) {
    if (strength <= 0) {
      return;
    }
    p.noStroke();
    for (const vertex of solid.vertices) {
      p.push();
      p.translate(...vertex.map((part) => part * MODEL_SCALE));
      p.fill(...family, 140 * strength);
      p.sphere(SPARK_RADIUS * strength * 1.9, 10, 8);
      p.fill(...family, 250 * strength);
      p.sphere(SPARK_RADIUS * strength, 10, 8);
      p.pop();
    }
  }

  function drawScene(state) {
    p.background(...BACKGROUND);
    const gl = p.drawingContext;
    gl.disable(gl.DEPTH_TEST);
    p.rotateX(STAGE_TILT + drag.tilt);
    p.rotateY(state.spin + drag.spin);
    p.scale(state.zoom);
    drawBand(BANDS[0], state.inner);
    drawBand(BANDS[1], state.middle);
    drawBand(BANDS[2], state.outer);
    // The sparks: the middle solid's corners rising out of the outer solid's faces,
    // then the inner solid's corners out of the middle's.
    drawSparks(SOLIDS.middle, STEEL_EDGE, state.sparks.onOuter);
    drawSparks(SOLIDS.inner, GOLD_EDGE, state.sparks.onMiddle);
    gl.enable(gl.DEPTH_TEST);
  }

  function publishState(frameIndex, state) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      zoom: state.zoom,
      spin: state.spin,
      outerEdgeAlpha: state.outer.edgeAlpha,
      innerEdgeAlpha: state.inner.edgeAlpha,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  /**
   * The legend is 2D type, and WEBGL will not set type without a font loaded for it —
   * it drew the plate and the empty key-cap and no words at all. So the note is drawn
   * on a plain 2D surface of its own and laid over the frame as an image, which needs
   * no font of its own and keeps the legend identical to every other artwork's.
   */
  let legendLayer;

  function drawLegend() {
    if (!legendLayer) {
      legendLayer = p.createGraphics(OUTPUT_WIDTH, OUTPUT_HEIGHT);
      legendLayer.pixelDensity(1);
    }
    legendLayer.clear();
    legendLayer.push();
    legendLayer.scale(RENDER_SCALE);
    drawKeyHint(legendLayer, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    legendLayer.pop();
    p.push();
    p.resetMatrix();
    p.image(legendLayer, -OUTPUT_WIDTH / 2, -OUTPUT_HEIGHT / 2);
    p.pop();
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT, p.WEBGL).parent("artwork");
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
    // An export is this same view at more pixels, not a larger model in a larger frame.
    pinLogicalCamera(p, LOGICAL_HEIGHT, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => {
        p.push();
        drawScene(sceneState(frameIndex));
        p.pop();
        // The exported clip carries no legend — it cannot be dragged — but the gallery
        // thumbnail is a picture of a page that can be, so it asks for one and gets it.
        if (HINT.shown) {
          drawLegend();
        }
        return Promise.resolve(publishState(frameIndex, sceneState(frameIndex)));
      };
    }
    p.push();
    drawScene(sceneState(0));
    p.pop();
    publishState(0, sceneState(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    p.push();
    drawScene(sceneState(frameIndex));
    p.pop();
    if (HINT.shown) {
      drawLegend();
    }
    publishState(frameIndex, sceneState(frameIndex));
  };

  p.mouseDragged = () => {
    // The hand turns the stage on top of the staging's own motion.
    drag.spin += (p.mouseX - p.pmouseX) * 0.01;
    drag.tilt = Math.max(
      -1.2,
      Math.min(1.2, drag.tilt + (p.mouseY - p.pmouseY) * 0.008)
    );
    return false;
  };
});

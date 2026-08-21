import { pinLogicalCamera } from "../shared/camera-scale.js";
import {
  STAGE_TURNS,
  backToFront,
  bandRows,
  cellCentres,
  glassShade,
  sceneState,
  viewDirection
} from "./geometry.js";

/**
 * The first WEBGL artwork in the collection. The staging conventions are the 2D ones —
 * logical units, capture mode, one pure function from frame index to scene — with one
 * mode-specific difference worth knowing: the drawing buffer is asked to persist, because
 * the thumbnail capture reads the canvas from a later task than the one that drew it,
 * which with a transient buffer reads black.
 */
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;
const PLAYBACK_FPS = 30;
const DURATION_SECONDS = 5;
const TOTAL_FRAMES = DURATION_SECONDS * PLAYBACK_FPS;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

// The band itself, in logical units. The half-width keeps the outer sweep inside the
// short side of the frame once the stage is tilted towards the viewer.
const RING_RADIUS = 185;
const HALF_WIDTH = 62;
const SEGMENTS_AROUND = 180;
const SEGMENTS_ACROSS = 8;
// The camera's standing tilt: enough to see the twist as depth, not so much that the
// band collapses into an ellipse.
const STAGE_TILT = 0.9;
// How far the stage is raised so the figure sits centred in the frame. The tilted ring
// projects taller above its centre than below, so it needs lifting; how far cannot be
// reasoned out, because the lift acts in camera space under a perspective projection, so
// a point nearer the eye rises further up the frame than a point behind it, and the
// silhouette is stretched by the lift as well as moved by it. The number is therefore
// measured, against the union of all 150 frames' silhouettes: at this value that union
// stands 121 pixels clear of the top of the frame and 121 clear of the bottom, and the
// 144 either side is what the ring's own sweep gives. Its predecessor, -56, left 101
// above and 151 below.
const STAGE_LIFT = -32;

/**
 * A dark water and the glass, and nothing else on the stage. The band is modelled in the
 * lightness of its own glass, so the half twist — which is the whole of what the artwork
 * claims — reads as a turn of a surface rather than as a change of paint.
 *
 * The ground is Nautilus's abyss teal taken down to night, so the collection's two
 * artworks of glass and water stand on the same dark; the band is that shell's sea glass
 * brought up until one thickness of it is pale and two are readable.
 */
const BACKGROUND = [8, 22, 24];
const GLASS = [168, 206, 198];

const ROWS = bandRows(SEGMENTS_AROUND, SEGMENTS_ACROSS, RING_RADIUS, HALF_WIDTH);
const CENTRES = cellCentres(ROWS);

const P5 = window.p5;

new P5((p) => {
  function drawBand(view) {
    // Painted from the back, cell by cell, because transparency has no depth buffer to
    // fall back on: what is drawn later is simply mixed over what is already there. The
    // order is recomputed every frame, and it is still a pure function of the frame.
    p.noStroke();
    p.beginShape(p.TRIANGLES);
    for (const index of backToFront(CENTRES, view)) {
      const { i, j } = CENTRES[index];
      // Two triangles per cell, each vertex carrying its own shade so the twist reads
      // as one smooth gradient instead of facet by facet.
      const cell = [
        ROWS[i][j], ROWS[i + 1][j], ROWS[i + 1][j + 1],
        ROWS[i][j], ROWS[i + 1][j + 1], ROWS[i][j + 1]
      ];
      for (const { point, normal } of cell) {
        p.fill(...glassShade(normal, view, GLASS));
        p.vertex(...point);
      }
    }
    p.endShape();
  }

  function drawScene(state) {
    p.background(...BACKGROUND);
    p.translate(0, STAGE_LIFT, 0);
    p.rotateX(STAGE_TILT);
    // A turntable turn, about the ring's own axis: the tilted silhouette holds still
    // while the twist — which is not a rotational symmetry — sweeps visibly around.
    p.rotateZ(state.spin);

    // Depth writing stays off for the whole band, which is now the whole picture. The
    // sort is by cell, and where the band runs through itself the crossing passes
    // through cells rather than between them, so the cell painted later is not always
    // the nearer one. Written into the buffer, those cells cut pieces out of each other;
    // left alone, the paint order decides, which is what the back-to-front sort is for.
    // It is restored afterwards rather than simply left off, so the state the renderer
    // hands to the next frame is the state it handed to this one.
    // Nothing on the stage is opaque any more, so the depth buffer has no work left to
    // do and is kept out of the way. The sort decides the order; a fragment the sort put
    // late is one the depth test would throw away rather than mix in, and glass that is
    // thrown away has stopped being see-through. It earns its two lines: 38 to 70 pixels
    // of the frame at the four stations measured, and they fall where the band turns
    // over and runs through itself, which is the one place the picture is about.
    const gl = p.drawingContext;
    gl.depthMask(false);
    drawBand(viewDirection(STAGE_TILT, state.spin));
    gl.depthMask(true);
  }

  function publishState(frameIndex) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      stageTurns: STAGE_TURNS,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  function frameState(frameIndex) {
    return sceneState(frameIndex, TOTAL_FRAMES);
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
      // Nothing accumulates between frames: every frame is recomputed from its index, so
      // any one of them is reproducible on its own.
      window.__renderFrame = (frameIndex) => {
        p.push();
        drawScene(frameState(frameIndex));
        p.pop();
        return Promise.resolve(publishState(frameIndex));
      };
    }
    p.push();
    drawScene(frameState(0));
    p.pop();
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    p.push();
    drawScene(frameState(frameIndex));
    p.pop();
    publishState(frameIndex);
  };
});

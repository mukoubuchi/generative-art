import {
  STAGE_TURNS,
  backToFront,
  bandRows,
  cellCentres,
  edgePoint,
  glassShade,
  sceneState,
  viewDirection
} from "./geometry.js";

/**
 * The first WEBGL artwork in the collection. The staging conventions are the 2D ones —
 * logical units, capture mode, one pure function from frame index to scene — with two
 * mode-specific differences worth knowing. Stroke weights in WEBGL are screen pixels and
 * ignore the model transform, so they are multiplied by the export scale by hand. And the
 * drawing buffer is asked to persist, because the thumbnail capture reads the canvas from
 * a later task than the one that drew it, which with a transient buffer reads black.
 */
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;
const PLAYBACK_FPS = 30;
const DURATION_SECONDS = 10;
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

// The traveller: a bead on the centre line carrying a pin along the surface normal. The
// pin is what makes the one-sidedness visible — the bead's own path repeats every lap.
const MARKER_RADIUS = 9;
const PIN_LENGTH = 40;
const PIN_TIP_RADIUS = 4.5;

/**
 * A dark water, the glass, and one gold. Three colours, where there were seven: the band
 * had a warm face and a cool one, a gold rim, a white centre line, a pale bead and a red
 * pin, and between them the half twist — which is the whole of what the artwork claims —
 * was the hardest thing in the picture to find. The band is modelled in the lightness of
 * its own glass and nothing else, so the twist reads as a turn of a surface rather than
 * as a change of paint.
 *
 * The ground is Nautilus's abyss teal taken down to night, so the collection's two
 * artworks of glass and water stand on the same dark; the band is that shell's sea glass
 * brought up until one thickness of it is pale and two are readable. The traveller is
 * Toggle Color Ball's settled gold, warm against a cold band and legible on both arcs —
 * where the old terracotta was loud enough to be the first thing seen.
 */
const BACKGROUND = [8, 22, 24];
const GLASS = [168, 206, 198];
const PIN = [214, 152, 58];

const EDGE_SAMPLES = 2 * SEGMENTS_AROUND;
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

  function drawEdge() {
    // One closed stroke, deliberately: the rim needs both laps to come home, and drawing
    // it as a single 4 PI curve is the claim that the band has a single edge. On glass it
    // is also the brightest thing in the picture, which is how a pane of glass is found:
    // by its edge, where the light it has been carrying comes out.
    p.noFill();
    p.stroke(...GLASS.map((component) => Math.min(255, component * 1.22)));
    p.strokeWeight(2 * RENDER_SCALE);
    p.beginShape();
    for (let i = 0; i < EDGE_SAMPLES; i += 1) {
      p.vertex(...edgePoint((i / EDGE_SAMPLES) * 4 * Math.PI, RING_RADIUS, HALF_WIDTH));
    }
    p.endShape(p.CLOSE);
  }

  function drawMarker(marker) {
    // Once, solid, and first of everything. The traveller is the only opaque thing on the
    // stage, so it goes down before the glass and writes its depth; the band then covers
    // whatever stands behind it and lets the rest read through. What the band hides is no
    // longer painted twice to be readable — the glass itself does that now, and the
    // hidden half is the story: the point of the journey is exactly the part that happens
    // on the other side.
    const [x, y, z] = marker.position;
    const tip = marker.position.map(
      (component, index) => component + marker.normal[index] * PIN_LENGTH
    );
    p.stroke(...PIN);
    p.strokeWeight(2.5 * RENDER_SCALE);
    p.line(x, y, z, ...tip);
    p.noStroke();
    p.fill(...PIN);
    p.push();
    p.translate(...tip);
    p.sphere(PIN_TIP_RADIUS, 12, 8);
    p.pop();
    p.push();
    p.translate(x, y, z);
    p.sphere(MARKER_RADIUS, 16, 12);
    p.pop();
  }

  function drawScene(state) {
    p.background(...BACKGROUND);
    p.scale(RENDER_SCALE);
    // The tilted ring projects taller above its centre than below, so the figure is
    // lifted a little to sit optically centred in the frame.
    p.translate(0, -56, 0);
    p.rotateX(STAGE_TILT);
    // A turntable turn, about the ring's own axis: the tilted silhouette holds still
    // while the twist — which is not a rotational symmetry — sweeps visibly around.
    p.rotateZ(state.spin);

    // The opaque thing first, writing depth; then everything see-through over it with
    // the depth test still on and the writing off, so no transparent surface can hide
    // another one behind it.
    const gl = p.drawingContext;
    drawMarker(state.marker);
    gl.depthMask(false);
    drawBand(viewDirection(STAGE_TILT, state.spin));
    drawEdge();
    gl.depthMask(true);
  }

  function publishState(frameIndex, state) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      stageTurns: STAGE_TURNS,
      markerU: state.marker.u,
      markerSide: state.marker.side,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  function frameState(frameIndex) {
    return sceneState(frameIndex, TOTAL_FRAMES, RING_RADIUS);
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
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Nothing accumulates between frames: every frame is recomputed from its index, so
      // any one of them is reproducible on its own.
      window.__renderFrame = (frameIndex) => {
        p.push();
        drawScene(frameState(frameIndex));
        p.pop();
        return Promise.resolve(publishState(frameIndex, frameState(frameIndex)));
      };
    }
    p.push();
    drawScene(frameState(0));
    p.pop();
    publishState(0, frameState(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    p.push();
    drawScene(frameState(frameIndex));
    p.pop();
    publishState(frameIndex, frameState(frameIndex));
  };
});

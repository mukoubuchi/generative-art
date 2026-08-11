import { STAGE_TURNS, bandRows, edgePoint, sceneState } from "./geometry.js";

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

const BACKGROUND = [13, 18, 27];
const BAND_COLOR = [214, 148, 96];
const BAND_COOL_COLOR = [96, 118, 152];
const EDGE_COLOR = [252, 202, 92];
const CENTER_LINE_COLOR = [255, 255, 255, 60];
const MARKER_COLOR = [240, 244, 248];
const PIN_COLOR = [244, 106, 90];

// Directions light arrives from, unit length, in the band's own frame.
const KEY_LIGHT = [-0.37, 0.45, -0.81];
const FILL_LIGHT = [0.63, -0.36, 0.68];

const EDGE_SAMPLES = 2 * SEGMENTS_AROUND;
const ROWS = bandRows(SEGMENTS_AROUND, SEGMENTS_ACROSS, RING_RADIUS, HALF_WIDTH);

const P5 = window.p5;

/**
 * Shading computed here, not by the renderer's lights, and folded in |N . L|: on a
 * one-sided surface "which way the normal points" is not a fact about the surface — carry
 * a normal around the ring and it comes back negated — so any shading that reads the sign
 * of the normal must tear somewhere, and a lit Möbius band shows that tear as a seam.
 * The absolute value is exactly the part of the lighting that is well defined on the
 * band, and shading with it is what lets the surface look like one unbroken thing.
 */
function shade(normal) {
  const key = Math.abs(
    normal[0] * KEY_LIGHT[0] + normal[1] * KEY_LIGHT[1] + normal[2] * KEY_LIGHT[2]
  );
  const fill = Math.abs(
    normal[0] * FILL_LIGHT[0] + normal[1] * FILL_LIGHT[1] + normal[2] * FILL_LIGHT[2]
  );
  return BAND_COLOR.map((component, channel) =>
    component * (0.26 + 0.62 * key) + BAND_COOL_COLOR[channel] * 0.30 * fill);
}

new P5((p) => {
  function drawBand() {
    p.noStroke();
    p.beginShape(p.TRIANGLES);
    for (let i = 0; i < SEGMENTS_AROUND; i += 1) {
      for (let j = 0; j < SEGMENTS_ACROSS; j += 1) {
        // Two triangles per cell, each vertex carrying its own shade so the twist reads
        // as one smooth gradient instead of facet by facet.
        const cell = [
          ROWS[i][j], ROWS[i + 1][j], ROWS[i + 1][j + 1],
          ROWS[i][j], ROWS[i + 1][j + 1], ROWS[i][j + 1]
        ];
        for (const { point, normal } of cell) {
          p.fill(...shade(normal));
          p.vertex(...point);
        }
      }
    }
    p.endShape();
  }

  function drawEdge() {
    // One closed stroke, deliberately: the rim needs both laps to come home, and drawing
    // it as a single 4 PI curve is the claim that the band has a single edge.
    p.noFill();
    p.stroke(...EDGE_COLOR);
    p.strokeWeight(2.5 * RENDER_SCALE);
    p.beginShape();
    for (let i = 0; i < EDGE_SAMPLES; i += 1) {
      p.vertex(...edgePoint((i / EDGE_SAMPLES) * 4 * Math.PI, RING_RADIUS, HALF_WIDTH));
    }
    p.endShape(p.CLOSE);
    p.stroke(...CENTER_LINE_COLOR);
    p.strokeWeight(1 * RENDER_SCALE);
    p.beginShape();
    for (let i = 0; i < SEGMENTS_AROUND; i += 1) {
      p.vertex(...edgePoint((i / SEGMENTS_AROUND) * 2 * Math.PI, RING_RADIUS, 0));
    }
    p.endShape(p.CLOSE);
  }

  function drawMarkerShapes(marker, pinColor, markerColor) {
    const [x, y, z] = marker.position;
    const tip = marker.position.map(
      (component, index) => component + marker.normal[index] * PIN_LENGTH
    );
    p.stroke(...pinColor);
    p.strokeWeight(2.5 * RENDER_SCALE);
    p.line(x, y, z, ...tip);
    p.noStroke();
    p.fill(...pinColor);
    p.push();
    p.translate(...tip);
    p.sphere(PIN_TIP_RADIUS, 12, 8);
    p.pop();
    p.fill(...markerColor);
    p.push();
    p.translate(x, y, z);
    p.sphere(MARKER_RADIUS, 16, 12);
    p.pop();
  }

  function drawMarker(marker) {
    // Twice: first as a ghost with the depth test off, then solid with it on. Whatever
    // the band hides — the pin through to the far side, the whole traveller on the far
    // arc — stays readable as a dim silhouette, and that hidden half is the story: the
    // point of the journey is exactly the part that happens on the other side.
    const gl = p.drawingContext;
    gl.disable(gl.DEPTH_TEST);
    drawMarkerShapes(marker, [...PIN_COLOR, 88], [...MARKER_COLOR, 72]);
    gl.enable(gl.DEPTH_TEST);
    drawMarkerShapes(marker, PIN_COLOR, MARKER_COLOR);
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
    drawBand();
    drawEdge();
    drawMarker(state.marker);
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
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT, p.WEBGL).parent("artwork");
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

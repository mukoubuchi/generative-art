import {
  DURATION_SECONDS,
  FLOOR_COUNT,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  RIM_SEGMENTS,
  STAGE_SCALE,
  TOTAL_FRAMES,
  sceneAt
} from "./the-same-tower.js";
import { CORE_WEIGHT, GROUND, SEA_GLASS, STARLIGHT, onStage, towerEtching } from "./etching.js";

/**
 * One fixed tower, drawn as an etching in starlight and sea glass. Its central floor
 * lines still carry the two exact appearances. Fine companions and quiet vertical
 * hatches describe its depth; the space between them is left open.
 *
 * The eye walks in, swings round and up to reveal the bent floors, then returns.
 * Live playback and export share the same twelve-second staging.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/** Two restrained light passes mark arrival without filling the open linework. */
const HEART_WHITE = [248, 250, 255];
const HEART_ALPHA = 0.025;
const HEART_SPREAD = 1.2;
const HEART_THRESHOLD = 1.02;
const HALO_LAYERS = 2;
const HALO_ALPHA = 0.018;
const HALO_SPREAD = 1.2;

const NEAR_PLANE = STAGE_SCALE * 0.5;
const FAR_PLANE = STAGE_SCALE * 40;
const ETCHING = towerEtching();
const HATCH_LINES = ETCHING.reduce((count, layer) => count + layer.segments.length, 0);

const P5 = window.p5;

new P5((p) => {
  let inkLayers;
  let floorGeometry;
  let playbackStartedAt;

  function drawFloors(alpha, weight, tint = STARLIGHT) {
    p.stroke(tint[0], tint[1], tint[2], alpha);
    p.strokeWeight(weight * RENDER_SCALE);
    p.model(floorGeometry);
  }

  function drawScene(scene) {
    p.background(...GROUND);
    // The eye of this frame: the module's own point and its own field of view.
    p.perspective(scene.fieldOfView, 1, NEAR_PLANE, FAR_PLANE);
    p.camera(...onStage(scene.eye), ...onStage(scene.lookAt), 0, 1, 0);
    // Open, translucent linework: the rear hatches remain visible through the front.
    const gl = p.drawingContext;
    gl.disable(gl.DEPTH_TEST);
    p.noFill();
    for (const { geometry, colour, alpha, weight } of inkLayers) {
      p.stroke(...colour, alpha);
      p.strokeWeight(weight * RENDER_SCALE);
      p.model(geometry);
    }
    // The measured station glow and its arrival beat light only the exact central rim.
    const strength = Math.max(scene.circleGlow, scene.squareGlow) * scene.arrival;
    if (strength >= 0.01) {
      p.blendMode(p.ADD);
      for (let layer = 1; layer <= HALO_LAYERS; layer += 1) {
        drawFloors(255 * strength * HALO_ALPHA, CORE_WEIGHT * (1 + HALO_SPREAD * layer), layer === 1 ? SEA_GLASS : STARLIGHT);
      }
      // The arrival's heart, so that the beat reads as light rather than as more colour.
      if (strength > HEART_THRESHOLD) {
        drawFloors(255 * (strength - 1) * HEART_ALPHA, CORE_WEIGHT * HEART_SPREAD, HEART_WHITE);
      }
      p.blendMode(p.BLEND);
    }
    gl.enable(gl.DEPTH_TEST);
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
      walk: scene.walk,
      turn: scene.turn,
      arrival: scene.arrival,
      onLine: scene.onLine,
      distance: scene.distance,
      fieldOfView: scene.fieldOfView,
      eye: scene.eye,
      circleGlow: scene.circleGlow,
      squareGlow: scene.squareGlow,
      floors: FLOOR_COUNT,
      rimSegments: RIM_SEGMENTS,
      walls: 0,
      hatchLines: HATCH_LINES,
      drawingLayers: inkLayers.length,
      palette: "starlight and sea glass",
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
    // Each tonal group owns one retained model. More hairlines add detail without
    // bringing back the thousands of draw calls that slowed the original page.
    inkLayers = ETCHING.map((layer) => ({
      ...layer,
      geometry: p.buildGeometry(() => {
        p.noFill();
        for (const [from, to] of layer.segments) p.line(...from, ...to);
      })
    }));
    floorGeometry = inkLayers.find((layer) => layer.role === "floor-core").geometry;
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is the staging read at its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => {
        const scene = sceneAt(frameIndex);
        p.push();
        drawScene(scene);
        p.pop();
        return Promise.resolve(publishState(frameIndex, scene));
      };
    }
    const opening = sceneAt(0);
    p.push();
    drawScene(opening);
    p.pop();
    publishState(0, opening);
    // p5 resets millis() after setup. The browser's monotonic clock keeps one origin
    // across that reset, with loading and geometry building outside the performance.
    playbackStartedAt = window.performance.now();
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // A missed draw skips ahead in the staging instead of making the whole walk slow.
    // Export still addresses every frame explicitly through __renderFrame above.
    const elapsed = window.performance.now() - playbackStartedAt;
    const frameIndex = Math.floor(elapsed * PLAYBACK_FPS / 1000) % TOTAL_FRAMES;
    const scene = sceneAt(frameIndex);
    p.push();
    drawScene(scene);
    p.pop();
    publishState(frameIndex, scene);
  };
});

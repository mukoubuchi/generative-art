import {
  CUBE_SIZE,
  CUBES,
  DURATION_SECONDS,
  EYE_DISTANCE,
  GROUND,
  INK,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  STAGE_SCALE,
  STROKE_WEIGHT,
  TOTAL_FRAMES,
  onStage,
  sceneAt
} from "./eyed-awry.js";

/**
 * Fifteen cubes in black single lines on warm white. The eye holds the closed
 * triangle, walks off the axis until the joints split, holds the three beams,
 * closes them from the other station, and comes home. Live playback and export
 * share the same thirteen-second staging.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

const NEAR_PLANE = (EYE_DISTANCE - 12) * STAGE_SCALE;
const FAR_PLANE = (EYE_DISTANCE + 12) * STAGE_SCALE;
const BOX = CUBE_SIZE * STAGE_SCALE;

const P5 = window.p5;

new P5((p) => {
  let cubes;
  let playbackStartedAt;

  function drawScene(scene) {
    p.background(...GROUND);
    p.ortho(-scene.orthoHalf, scene.orthoHalf, -scene.orthoHalf, scene.orthoHalf, NEAR_PLANE, FAR_PLANE);
    const eye = onStage(scene.eye);
    p.camera(...eye, ...onStage(scene.lookAt), 0, -1, 0);
    // Flat paper faces, no lights: a face is the ground it stands on, and what
    // it does is hide the strokes behind it. The picture is the edges.
    p.noLights();
    p.fill(...GROUND);
    p.stroke(...INK);
    p.strokeWeight(STROKE_WEIGHT * RENDER_SCALE);
    p.model(cubes);
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
      turn: scene.turn,
      closed: scene.closed,
      cubes: CUBES.length,
      palette: "black on warm white",
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE, p.WEBGL).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.setAttributes("preserveDrawingBuffer", true);
    // One weight wherever a line stands: a drawing's stroke, not a wire that
    // thickens as it comes nearer. The two cubes of a joint sit at different
    // depths, and a stroke scaled by depth would split the corner the geometry
    // has already closed.
    p.linePerspective(false);
    p.frameRate(PLAYBACK_FPS);
    cubes = p.buildGeometry(() => {
      p.fill(...GROUND);
      p.stroke(...INK);
      for (const { cell } of CUBES) {
        p.push();
        p.translate(...onStage(cell));
        p.box(BOX);
        p.pop();
      }
    });
    if (CAPTURE_MODE) {
      p.noLoop();
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
    playbackStartedAt = window.performance.now();
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const elapsed = window.performance.now() - playbackStartedAt;
    const frameIndex = Math.floor(elapsed * PLAYBACK_FPS / 1000) % TOTAL_FRAMES;
    const scene = sceneAt(frameIndex);
    p.push();
    drawScene(scene);
    p.pop();
    publishState(frameIndex, scene);
  };
});

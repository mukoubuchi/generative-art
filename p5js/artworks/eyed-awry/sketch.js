import {
  CUBE_SIZE,
  CUBES,
  DURATION_SECONDS,
  EYE_DISTANCE,
  GROUND,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  STAGE_SCALE,
  STROKE_WEIGHT,
  TOTAL_FRAMES,
  onStage,
  sceneAt
} from "./eyed-awry.js";

/**
 * Fifteen cubes, a beam to each of three earths, lit, on warm white. The eye holds the
 * closed triangle, is whipped off the axis until the three beams stand apart, holds them,
 * comes back into the closing, goes over the top to the station behind, and comes home.
 * Live playback and export share the same thirteen-second staging.
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
/**
 * One earth to a beam, from the paper works' own: Herringbone's russet, Pinwheel's lighter
 * russet, Herringbone's steel. A beam is its own colour, so off the axis the eye sees three
 * things; along it, the three colours meet in one triangle.
 */
const BEAM_EARTH = Object.freeze({ a: [166, 110, 66], b: [206, 158, 96], c: [88, 104, 124] });
const EDGE_INK = [38, 34, 40];

const P5 = window.p5;

new P5((p) => {
  let playbackStartedAt;

  function drawScene(scene) {
    p.background(...GROUND);
    p.ortho(-scene.orthoHalf, scene.orthoHalf, -scene.orthoHalf, scene.orthoHalf, NEAR_PLANE, FAR_PLANE);
    const eye = onStage(scene.eye);
    p.camera(...eye, ...onStage(scene.lookAt), 0, -1, 0);
    p.strokeWeight(STROKE_WEIGHT * RENDER_SCALE);
    // One light from above and to the left, fixed to the figure, so each of the three face
    // directions keeps one tone as the figure turns. The beam's earth is the ambient
    // material; the diffuse colour stays p5's own white.
    p.ambientLight(175);
    p.directionalLight(110, 110, 110, 0.35, 0.9, 0.45);
    p.stroke(...EDGE_INK);
    for (const { cell, beam } of CUBES) {
      p.ambientMaterial(...BEAM_EARTH[beam]);
      p.push();
      p.translate(...onStage(cell));
      p.box(BOX);
      p.pop();
    }
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
      tilt: scene.tilt,
      closed: scene.closed,
      cubes: CUBES.length,
      palette: "three earths on warm white",
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

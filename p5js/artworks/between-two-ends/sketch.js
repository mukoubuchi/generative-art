import {
  DURATION_SECONDS,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  sceneAt
} from "./between-two-ends.js";

/**
 * Two tangent circles and the point they carry between the ends of a diameter.
 * The manuscript's successive diagrams become one continuous, closed motion.
 * Paper and ink belong to the same register as the earlier geometric plates.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const PAPER = [230, 224, 208];
const INK = [38, 34, 40];
const P5 = window.p5;

new P5((p) => {
  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...PAPER);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_SIZE / 2, LOGICAL_SIZE / 2);
    p.noFill();

    // This diameter is fixed in the page, through the initial point of contact.
    p.stroke(...INK, 100);
    p.strokeWeight(0.7);
    p.line(-scene.largeRadius, 0, scene.largeRadius, 0);

    p.stroke(...INK, 230);
    p.strokeWeight(1.4);
    p.circle(0, 0, 2 * scene.largeRadius);

    p.stroke(...INK, 230);
    p.strokeWeight(1.7);
    p.circle(...scene.smallCenter, 2 * scene.smallRadius);

    p.noStroke();
    p.fill(...INK);
    p.circle(...scene.materialPoint, 8);
    p.pop();
    return scene;
  }

  function publishState(scene) {
    const state = {
      kind: "video",
      frameIndex: scene.frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      smallCenter: scene.smallCenter,
      materialPoint: scene.materialPoint,
      tangentPoint: scene.tangentPoint,
      largeRadius: scene.largeRadius,
      smallRadius: scene.smallRadius,
      rotations: scene.rotations,
      palette: "ink",
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
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));
  };

  p.draw = () => publishState(drawFrame(p.frameCount % TOTAL_FRAMES));
});

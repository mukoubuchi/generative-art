import {
  DIAMETER_ANGLES,
  DURATION_SECONDS,
  LARGE_RADIUS,
  LOGICAL_SIZE,
  NESTED_POINT_COUNT,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  nestedTrace,
  sceneAt
} from "./between-two-ends.js";

/**
 * Four couples, each with a couple inside it, and the curves their points run.
 * The sentence's own mechanism is the first stage: a point of the small circle
 * on a diameter of the large one. The rest turns that mechanism on its own
 * premises, and the standing lines and curves are what the motion leaves.
 *
 * Paper and ink belong to the same register as the earlier geometric plates.
 * Nothing is drawn twice: two diameters, not four, and three curves, not
 * twelve, because a line is its own half turn and an astroid its own quarter.
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

/** The standing curves do not move, so they are sampled once. */
const TRACES = Array.from({ length: NESTED_POINT_COUNT }, (unused, index) => nestedTrace(index));

new P5((p) => {
  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...PAPER);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_SIZE / 2, LOGICAL_SIZE / 2);
    p.noFill();

    // The two diameters are fixed in the page, through the contact points the
    // four couples start from; the three astroids are what the nested points
    // leave behind. Both stand at the lightest weight the plate uses.
    p.stroke(...INK, 100);
    p.strokeWeight(0.7);
    for (const angle of DIAMETER_ANGLES) {
      const reach = [LARGE_RADIUS * Math.cos(angle), LARGE_RADIUS * Math.sin(angle)];
      p.line(-reach[0], -reach[1], reach[0], reach[1]);
    }
    for (const path of TRACES) {
      for (let index = 1; index < path.length; index += 1) {
        p.line(path[index - 1][0], path[index - 1][1], path[index][0], path[index][1]);
      }
    }

    p.stroke(...INK, 230);
    p.strokeWeight(1.4);
    p.circle(0, 0, 2 * scene.largeRadius);
    for (const couple of scene.couples) {
      p.stroke(...INK, 230);
      p.strokeWeight(1.7);
      p.circle(...couple.smallCenter, 2 * couple.smallRadius);
      p.stroke(...INK, 170);
      p.strokeWeight(1.7);
      p.circle(...couple.nestedCenter, 2 * couple.nestedRadius);
    }

    p.noStroke();
    p.fill(...INK);
    for (const couple of scene.couples) {
      p.circle(...couple.materialPoint, 8);
      for (const point of couple.nestedPoints) {
        p.circle(...point, 8);
      }
    }
    p.pop();
    return scene;
  }

  function publishState(scene) {
    const state = {
      kind: "video",
      frameIndex: scene.frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      couples: scene.couples.length,
      nestedPointsPerCouple: NESTED_POINT_COUNT,
      diameters: DIAMETER_ANGLES.length,
      traces: TRACES.length,
      materialPoints: scene.couples.map((couple) => couple.materialPoint),
      nestedPoints: scene.couples.map((couple) => couple.nestedPoints),
      largeRadius: scene.largeRadius,
      smallRadius: scene.couples[0].smallRadius,
      nestedRadius: scene.couples[0].nestedRadius,
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

import {
  DURATION_SECONDS,
  FLOOR_COUNT,
  FLOOR_HEIGHTS,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  RIM_SEGMENTS,
  STAGE_SCALE,
  TOTAL_FRAMES,
  rimAt,
  sceneAt,
  verticals,
  wallQuads
} from "./the-same-tower.js";

/**
 * A tower of crystal in starlight, and an eye that walks towards it and then is whipped
 * off the line. Far off, the floors are circles and the walls turn round like a
 * cylinder's; close to, the floors are squares and four walls lie flat. Then a third eye
 * swings round and up in six tenths of a second and the floors show for what they are:
 * bent curves on one footprint, neither circles nor squares. Nothing about the tower
 * changes.
 *
 * The clip carries the whole of it, as one continuous move. The page plays the same clip,
 * because a hand on a lever did not let a reader see the trick: the tower has to be shown
 * from where the trick is visible and from where it is not, and that is a staging, not a
 * control.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/**
 * Recursive Pentagram's ground and its starlight, which is the whole register: a face ink
 * that is a whisper of it and an edge that is not, layered with the depth test off so that
 * the far wall shows through the near one, and one white for the heart of an arrival. The
 * two lights are the two Platonic Duals is lit by, fixed to the stage.
 */
const GROUND = [10, 12, 18];
const STARLIGHT_FACE = [202, 192, 232];
const STARLIGHT_EDGE = [202, 192, 232];
const HEART_WHITE = [248, 250, 255];
/** How faint the arrival's white heart is, and how much swell it takes before it shows. */
const HEART_ALPHA = 0.05;
const HEART_SPREAD = 1.6;
const HEART_THRESHOLD = 1.02;
const FACE_ALPHA = 46;
const EDGE_ALPHA = 235;
const KEY_LIGHT = [-0.42, 0.52, -0.74];
const FILL_LIGHT = [0.66, -0.3, 0.69];
const LINE_WEIGHT = 1.4;
/**
 * The station glow: additive halos laid over the floor lines, four widening layers at a
 * faint alpha each, scaled by how nearly the picture is the station's figure. A signal
 * that the eye has arrived, not a second colour.
 */
const HALO_LAYERS = 4;
const HALO_ALPHA = 0.045;
const HALO_SPREAD = 1.2;

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

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Shading folded in |N . L|, as the duals are: crystal has no inside to keep the sign for. */
function crystal(normal) {
  const stageNormal = [normal[0], 0, -normal[1]];
  const key = Math.abs(dot(stageNormal, KEY_LIGHT));
  const fill = Math.abs(dot(stageNormal, FILL_LIGHT));
  return STARLIGHT_FACE.map((component) => component * (0.35 + 0.5 * key + 0.25 * fill));
}

/** The tower is fixed; only the eye moves. So the geometry is built once. */
const RIMS = FLOOR_HEIGHTS.map((height) => rimAt(height));
const WALLS = wallQuads(RIMS).map((quad) => ({
  corners: quad.corners.map(onStage),
  colour: [...crystal(quad.normal), FACE_ALPHA]
}));
const CORNERS = verticals().map(([from, to]) => [onStage(from), onStage(to)]);
const FLOORS = RIMS.map((rim) => rim.map(onStage));

const P5 = window.p5;

new P5((p) => {
  function drawWalls() {
    p.noStroke();
    p.beginShape(p.TRIANGLES);
    for (const { corners, colour } of WALLS) {
      const [a, b, c, d] = corners;
      p.fill(...colour);
      p.vertex(...a); p.vertex(...b); p.vertex(...c);
      p.vertex(...a); p.vertex(...c); p.vertex(...d);
    }
    p.endShape();
  }

  function drawFloors(alpha, weight, tint = STARLIGHT_EDGE) {
    p.stroke(tint[0], tint[1], tint[2], alpha);
    p.strokeWeight(weight * RENDER_SCALE);
    for (const floor of FLOORS) {
      for (let index = 1; index < floor.length; index += 1) {
        p.line(...floor[index - 1], ...floor[index]);
      }
    }
  }

  function drawScene(scene) {
    p.background(...GROUND);
    // The eye of this frame: the module's own point and its own field of view.
    p.perspective(scene.fieldOfView, 1, NEAR_PLANE, FAR_PLANE);
    p.camera(...onStage(scene.eye), ...onStage(scene.lookAt), 0, 1, 0);
    // Everything on the stage is translucent, so the depth buffer has no work to do and
    // would only cut the far wall out from behind the near one. The paint order is the
    // order the walls are built in, which is one frame's order as much as another's.
    const gl = p.drawingContext;
    gl.disable(gl.DEPTH_TEST);
    drawWalls();
    p.noFill();
    p.stroke(...STARLIGHT_EDGE, EDGE_ALPHA);
    p.strokeWeight(LINE_WEIGHT * RENDER_SCALE);
    for (const [from, to] of CORNERS) {
      p.line(...from, ...to);
    }
    drawFloors(EDGE_ALPHA, LINE_WEIGHT);
    // The station's light: added rather than painted, so the layers pile up into a glow.
    // The measured glow is what the halo is worth; the arrival beat is what it is
    // multiplied by in the frames just after a station, and it is staging, not measure.
    const strength = Math.max(scene.circleGlow, scene.squareGlow) * scene.arrival;
    if (strength >= 0.01) {
      p.blendMode(p.ADD);
      for (let layer = 1; layer <= HALO_LAYERS; layer += 1) {
        drawFloors(255 * strength * HALO_ALPHA, LINE_WEIGHT * (1 + HALO_SPREAD * layer));
      }
      // The arrival's heart, so that the beat reads as light rather than as more colour.
      if (strength > HEART_THRESHOLD) {
        drawFloors(255 * (strength - 1) * HEART_ALPHA, LINE_WEIGHT * HEART_SPREAD, HEART_WHITE);
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
      walls: WALLS.length,
      palette: "starlight",
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
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    const scene = sceneAt(frameIndex);
    p.push();
    drawScene(scene);
    p.pop();
    publishState(frameIndex, scene);
  };
});

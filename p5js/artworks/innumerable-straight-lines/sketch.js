import { pinLogicalCamera } from "../shared/camera-scale.js";
import {
  DURATION_SECONDS,
  HEIGHT,
  PLAYBACK_FPS,
  RADIUS,
  ROD_COUNT,
  TOTAL_FRAMES,
  WIDTH,
  sceneAt
} from "./innumerable-straight-lines.js";

/**
 * Thirty-six straight rods between two collars on a night ground, the collars turning
 * against each other and back while the stage turns a sixth. Untwisted, the rods stand as
 * a cylinder; twisted, they lean and the surface they lie on pinches to a waist, and every
 * rod is still straight -- which is the whole of what the picture says.
 *
 * Nothing here is a face. A rod is a bundle of hairlines standing where the surface of a
 * rod would have been, each line coloured from its own normal by the two lights Platonic
 * Duals is lit by, so that the round of the rod is read from the brightness across the
 * bundle rather than from a filled tube; a collar is four thin rings, the same lines round
 * the ring its tube would have made. A work about the straight lines a curved surface is
 * made of is drawn in straight lines. No lights are asked of the renderer, and nothing on
 * the stage is a letter, a numeral or an arrow.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = HEIGHT * RENDER_SCALE;

/**
 * The register is three metals: silver for the thirty rods, in the collection's bone;
 * copper for the six that mark every sixth, in Kissing Circles' terracotta; and gold for
 * the collars, in Platonic Duals' edge. The night is the ground the collection's darkest
 * artworks stand on, and the two lights are the duals' own, fixed to the stage. The mark
 * every sixth rod carries is what lets the eye follow the turn, and its sixfold period is
 * why a sixth of a turn closes the loop, so the copper is a reading of the figure rather
 * than a decoration.
 */
const GROUND = [6, 7, 12];
const ROD = [246, 244, 236];
const ACCENT = [196, 106, 74];
const COLLAR = [252, 204, 116];
const KEY_LIGHT = [-0.42, 0.52, -0.74];
const FILL_LIGHT = [0.66, -0.3, 0.69];

/** Stage units per collar radius, and the rods' and collars' thicknesses in logical pixels. */
const STAGE_SCALE = 160;
const ROD_RADIUS = 2.6;
const ACCENT_RADIUS = 3.4;
const COLLAR_TUBE = 5.5;
const COLLAR_AROUND = 72;
/**
 * How many hairlines stand for one rod and one collar, and how thick each is. A rod's
 * lines are spread evenly round the circle its tube would have had, so the bundle is the
 * tube's own generators; a collar's rings stand at four points round its tube.
 */
const ROD_LINES = 5;
const ACCENT_LINES = 7;
const COLLAR_RINGS = 4;
const HAIRLINE = 1.1;
const ACCENT_HAIRLINE = 1.3;
const COLLAR_HAIRLINE = 1.6;
/** The camera's standing tilt and the bearing the stage starts from. */
const STAGE_TILT = -0.32;
const STAGE_YAW = 0.35;
/**
 * How far the stage is raised so the figure sits centred. The tilted collars project
 * taller above their centre than below, so the sculpture needs lifting; the number is
 * measured against the union of all frames' silhouettes rather than reasoned out, the
 * lift acting in camera space under a perspective projection.
 */
const STAGE_LIFT = -27;

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalise(v) {
  const length = Math.hypot(...v);
  return v.map((part) => part / length);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Shading folded in |N . L|, as the duals are: a face lit from either side alike. */
function shade(base, normal) {
  const key = Math.abs(dot(normal, KEY_LIGHT));
  const fill = Math.abs(dot(normal, FILL_LIGHT));
  return base.map((component) => Math.min(255, component * (0.35 + 0.5 * key + 0.25 * fill)));
}

/** The sculpture's coordinates onto the stage: across stays across, up becomes negative y. */
function onStage([x, y, z]) {
  return [x * STAGE_SCALE, -y * STAGE_SCALE, z * STAGE_SCALE];
}

const P5 = window.p5;

new P5((p) => {
  /** The frame a rod stands in: its own direction and two directions across it. */
  function frameOf(from, to) {
    const axis = normalise([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
    const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalise(cross(axis, helper));
    return { u, v: cross(axis, u) };
  }

  /**
   * One rod as a bundle: `count` hairlines standing on the circle of radius `radius` about
   * the rod's own line, each drawn in the colour its own normal takes from the two lights.
   * Nothing is filled, so the rod is round by its shading and by nothing else.
   */
  function bundle(from, to, radius, colour, count, weight) {
    const { u, v } = frameOf(from, to);
    p.strokeWeight(weight * RENDER_SCALE);
    for (let index = 0; index < count; index += 1) {
      const angle = 2 * Math.PI * index / count;
      const normal = u.map((part, axis) => part * Math.cos(angle) + v[axis] * Math.sin(angle));
      p.stroke(...shade(colour, normal));
      p.line(
        from[0] + radius * normal[0], from[1] + radius * normal[1], from[2] + radius * normal[2],
        to[0] + radius * normal[0], to[1] + radius * normal[1], to[2] + radius * normal[2]
      );
    }
  }

  /**
   * A collar at stage height `y`: four rings round the circle of the rods' ends, standing
   * where its tube's surface would have been, each segment shaded by the tube's normal.
   */
  function collar(y) {
    const major = RADIUS * STAGE_SCALE;
    p.strokeWeight(COLLAR_HAIRLINE * RENDER_SCALE);
    for (let ring = 0; ring < COLLAR_RINGS; ring += 1) {
      const about = 2 * Math.PI * ring / COLLAR_RINGS;
      const radius = major + COLLAR_TUBE * Math.cos(about);
      const rise = COLLAR_TUBE * Math.sin(about);
      let previous = null;
      for (let step = 0; step <= COLLAR_AROUND; step += 1) {
        const around = 2 * Math.PI * step / COLLAR_AROUND;
        const point = [radius * Math.cos(around), y + rise, radius * Math.sin(around)];
        if (previous !== null) {
          const normal = [Math.cos(about) * Math.cos(around), Math.sin(about), Math.cos(about) * Math.sin(around)];
          p.stroke(...shade(COLLAR, normal));
          p.line(previous[0], previous[1], previous[2], point[0], point[1], point[2]);
        }
        previous = point;
      }
    }
  }

  function drawScene(scene) {
    p.background(...GROUND);
    p.push();
    p.translate(0, STAGE_LIFT, 0);
    p.rotateX(STAGE_TILT);
    p.rotateY(STAGE_YAW + scene.spin);
    p.noFill();
    for (const rod of scene.rods) {
      bundle(
        onStage(rod.bottom), onStage(rod.top),
        rod.accent ? ACCENT_RADIUS : ROD_RADIUS,
        rod.accent ? ACCENT : ROD,
        rod.accent ? ACCENT_LINES : ROD_LINES,
        rod.accent ? ACCENT_HAIRLINE : HAIRLINE
      );
    }
    collar(-scene.height / 2 * STAGE_SCALE);
    collar(scene.height / 2 * STAGE_SCALE);
    p.pop();
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      lever: scene.lever,
      twist: scene.twist,
      height: scene.height,
      waist: scene.waist,
      spin: scene.spin,
      rods: ROD_COUNT,
      palette: "three metals",
      logicalSize: { width: WIDTH, height: HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
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
    pinLogicalCamera(p, HEIGHT, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    // One weight for every line wherever it stands: the rods are one thickness, and a
    // hairline that thinned with distance would make the far side of the figure a
    // different rod from the near side.
    p.linePerspective(false);
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is the twist and the turn read at its index, so any one can stand alone.
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

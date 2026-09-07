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
 * Thirty-six terracotta rods between two gold collars on a night ground, the collars
 * turning against each other and back while the stage turns a sixth. Untwisted, the rods
 * stand as a cylinder; twisted, they lean and the surface they lie on pinches to a waist,
 * and every rod is still straight -- which is the whole of what the picture says.
 *
 * Everything is drawn as shaded faces: a rod is an eight-sided tube, a collar a ring of
 * quads, each face coloured from its own normal by the two lights Platonic Duals is lit
 * by. No lights are asked of the renderer, and nothing on the stage is a letter, a numeral
 * or an arrow.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = HEIGHT * RENDER_SCALE;

/**
 * The register: Kissing Circles' terracotta for the rods and its sand for the six
 * accents, Platonic Duals' gold edge for the collars, and the night the collection's
 * darkest artworks stand on. The two lights are the duals' own, fixed to the stage.
 */
const GROUND = [6, 7, 12];
const ROD = [196, 106, 74];
const ACCENT = [222, 158, 96];
const COLLAR = [252, 204, 116];
const KEY_LIGHT = [-0.42, 0.52, -0.74];
const FILL_LIGHT = [0.66, -0.3, 0.69];

/** Stage units per collar radius, and the rods' and collars' thicknesses in logical pixels. */
const STAGE_SCALE = 160;
const ROD_RADIUS = 2.6;
const ACCENT_RADIUS = 3.4;
const COLLAR_TUBE = 5.5;
const TUBE_SIDES = 8;
const COLLAR_AROUND = 72;
const COLLAR_SIDES = 10;
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
  /** A tube from `from` to `to` on the stage, its faces shaded by their outward normals. */
  function tube(from, to, radius, colour) {
    const axis = normalise([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
    const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalise(cross(axis, helper));
    const v = cross(axis, u);
    p.beginShape(p.TRIANGLES);
    for (let side = 0; side < TUBE_SIDES; side += 1) {
      const angle0 = 2 * Math.PI * side / TUBE_SIDES;
      const angle1 = 2 * Math.PI * (side + 1) / TUBE_SIDES;
      const n0 = u.map((part, axisIndex) => part * Math.cos(angle0) + v[axisIndex] * Math.sin(angle0));
      const n1 = u.map((part, axisIndex) => part * Math.cos(angle1) + v[axisIndex] * Math.sin(angle1));
      const shaded = shade(colour, normalise([n0[0] + n1[0], n0[1] + n1[1], n0[2] + n1[2]]));
      const a0 = from.map((part, axisIndex) => part + radius * n0[axisIndex]);
      const a1 = from.map((part, axisIndex) => part + radius * n1[axisIndex]);
      const b0 = to.map((part, axisIndex) => part + radius * n0[axisIndex]);
      const b1 = to.map((part, axisIndex) => part + radius * n1[axisIndex]);
      p.fill(...shaded);
      p.vertex(...a0); p.vertex(...a1); p.vertex(...b1);
      p.vertex(...a0); p.vertex(...b1); p.vertex(...b0);
    }
    p.endShape();
  }

  /** A collar at stage height `y`: a ring of quads round the circle of the rods' ends. */
  function collar(y) {
    const major = RADIUS * STAGE_SCALE;
    p.beginShape(p.TRIANGLES);
    for (let around = 0; around < COLLAR_AROUND; around += 1) {
      const t0 = 2 * Math.PI * around / COLLAR_AROUND;
      const t1 = 2 * Math.PI * (around + 1) / COLLAR_AROUND;
      for (let side = 0; side < COLLAR_SIDES; side += 1) {
        const f0 = 2 * Math.PI * side / COLLAR_SIDES;
        const f1 = 2 * Math.PI * (side + 1) / COLLAR_SIDES;
        const point = (t, f) => [
          (major + COLLAR_TUBE * Math.cos(f)) * Math.cos(t),
          y + COLLAR_TUBE * Math.sin(f),
          (major + COLLAR_TUBE * Math.cos(f)) * Math.sin(t)
        ];
        const normal = (t, f) => [Math.cos(f) * Math.cos(t), Math.sin(f), Math.cos(f) * Math.sin(t)];
        const corners = [point(t0, f0), point(t1, f0), point(t1, f1), point(t0, f1)];
        const normals = [normal(t0, f0), normal(t1, f0), normal(t1, f1), normal(t0, f1)];
        for (const index of [0, 1, 2, 0, 2, 3]) {
          p.fill(...shade(COLLAR, normals[index]));
          p.vertex(...corners[index]);
        }
      }
    }
    p.endShape();
  }

  function drawScene(scene) {
    p.background(...GROUND);
    p.push();
    p.translate(0, STAGE_LIFT, 0);
    p.rotateX(STAGE_TILT);
    p.rotateY(STAGE_YAW + scene.spin);
    p.noStroke();
    for (const rod of scene.rods) {
      tube(onStage(rod.bottom), onStage(rod.top), rod.accent ? ACCENT_RADIUS : ROD_RADIUS, rod.accent ? ACCENT : ROD);
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
      palette: "terracotta",
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

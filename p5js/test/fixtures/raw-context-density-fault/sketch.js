/**
 * Loxodrome as it stood at 8324b32, the sketch that shipped in v1.23.1 and broke on every
 * dense display. Frozen on purpose: this is the fault a reader on a Retina screen actually
 * saw, kept as a specimen for the density check to be aimed at.
 *
 * One thing is wrong with it, and it is wanted here. `drawScene` draws to the raw context
 * and opens with `context.setTransform(1, 0, 0, 1, 0, 0)`, which replaces p5's transform --
 * and with it the pixel density p5 folds into that transform. On a display of density two
 * p5 backs a 680-pixel canvas with 1360 device pixels; the reset draws 680 device pixels,
 * which is the top-left quarter of the canvas, and the other three quarters are never
 * written to. The courses, drawn past the frame on purpose, run out of the painted quarter
 * onto the transparent rest, and the legend, drawn through p5's own API, lands at the foot
 * of the canvas three hundred pixels below the picture.
 *
 * It went unseen because every check before publication ran at a density of one, where
 * the reset is harmless; and the density check that did run at two looked only at the
 * sketches that write `p.pixels` by hand, which this one does not.
 *
 * Nothing here is to be followed or repaired. It is not an artwork: it sits outside
 * `artworks/`, it is absent from the manifest, and the site build never copies it, so the
 * detectors that hold the live sketches to the opposite of all this neither see it nor have
 * to make room for it. The check that opens this page is asking whether it can still see a
 * fault that was really made, and the answer stops meaning anything the moment this file
 * is brought up to date.
 *
 * Three lines differ from the commit, all imports: the same live modules, named by a
 * longer path, because this file sits further away from them. They are deliberately left
 * live. The fault is in the transform rather than in the geometry, so no change to
 * `loxodrome.js` can make the lower three quarters of this canvas get painted. Two
 * constants the page's controls used are carried below since the live module dropped
 * them; the drawing they steer is the drawing the reader saw.
 */
import { hintMode } from "../../../artworks/shared/hint-mode.js";
import { drawKeyHint } from "../../../artworks/shared/key-hint.js";
import {
  COURSES,
  DURATION_SECONDS,
  LOGICAL_SIZE,
  OPENING_BEARING,
  PLAYBACK_FPS,
  RESTING_TILT,
  TOTAL_FRAMES,
  courseCurves,
  degrees,
  depthFloor,
  figureFrame,
  graticuleCurves,
  gridInk,
  morphAt,
  sceneAt,
  splitByDepth,
  viewCurve
} from "../../../artworks/loxodrome/loxodrome.js";

// The page's bearing limits as they stood at 8324b32. The live module dropped them when
// the page stopped being an instrument, so they are carried here rather than imported;
// nothing about the fault depends on their values.
const MINIMUM_BEARING = 0;
const MAXIMUM_BEARING = degrees(80);

/**
 * Six courses held at one bearing, on the globe and on the chart drawn for them.
 *
 * On the globe each course is a spiral: it cuts every meridian at the same angle, so it
 * winds about the pole without end, and the six of them close into a blaze there. The
 * globe then relaxes onto the cylinder the chart is taken from, the cylinder unrolls, and
 * the same six courses are a ruled field of parallel straight lines — with nothing at all
 * where the blaze was, because the chart that straightens them has put the pole an
 * infinite distance up the page.
 *
 * The page hands the three things the clip performs to the reader: the globe turns under
 * the hand, the arrow keys open and close the bearing, and space unrolls the chart. The
 * clip performs them instead, because a clip cannot be dragged or typed at.
 *
 * The figure is three-dimensional and the module holds all of it, projection included:
 * every point reaching this file has already been morphed, turned and scaled into the
 * picture plane, with its depth carried alongside so the half turned away can be drawn
 * fainter. What is left here is stroking polylines, which is why the canvas is the plain
 * one rather than WEBGL. The figure is around thirteen thousand points a frame, and p5's
 * WEBGL renderer builds a stroke's geometry per vertex in JavaScript: measured on this
 * machine it draws 12,780 points in 137 milliseconds, which is eight frames a second. The
 * same points through the two-dimensional context, where the path is stroked natively,
 * take 0.36 milliseconds.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "drag", text: "turn the globe" },
  { cap: "← →", text: "change the bearing" },
  { cap: "space", text: "unroll the chart" }
];
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/**
 * A night sea, a cold grid, a warm course.
 *
 * The grid is painted: one weight of line wherever it is drawn, because it is the sheet
 * rather than anything happening on it. The courses are added instead, and each is drawn
 * twice — a wide faint halo and a narrow bright core — so that a single course on open
 * water is a line with some light around it, and six of them closing on a pole are a
 * blaze. That blaze is the whole of what the chart cannot show: unroll the sheet and the
 * same light is spread up a page that never ends.
 */
const GROUND = [9, 13, 24];
const GRATICULE = [96, 132, 178];
const COURSE = [250, 219, 156];
/** Turned towards the eye, and turned away from it. */
const GRATICULE_NEAR = 96;
const GRATICULE_FAR = 34;
const COURSE_NEAR = 104;
const COURSE_FAR = 34;
const HALO_NEAR = 20;
const HALO_FAR = 7;
const GRATICULE_WEIGHT = 1;
const COURSE_WEIGHT = 1.4;
const HALO_WEIGHT = 5;

/** How fast the page answers: forty degrees of bearing a second, and an unrolling in one. */
const BEARING_RATE = degrees(40) / PLAYBACK_FPS;
const OPEN_RATE = 1 / (PLAYBACK_FPS * 1.2);
/** The globe's own drift on the page, so the figure is alive before it is touched. */
const DRIFT = 2 * Math.PI / (PLAYBACK_FPS * 90);

const GRATICULE_CURVES = graticuleCurves().map((curve) => curve.points);

const P5 = window.p5;

new P5((p) => {
  let context;
  let courseCache = { bearing: null, curves: null };
  const live = {
    spin: 0,
    tilt: RESTING_TILT,
    bearing: OPENING_BEARING,
    open: 0,
    openTarget: 0
  };

  function courseCurvesFor(bearing) {
    if (courseCache.bearing !== bearing) {
      courseCache = {
        bearing,
        curves: courseCurves(bearing).flatMap((course) => course.pieces)
      };
    }
    return courseCache.curves;
  }

  /** The figure's polylines for a frame, each marked near or far. */
  function runsOf(curves, scene) {
    const floor = depthFloor(scene.scale);
    const runs = [];
    for (const points of curves) {
      for (const run of splitByDepth(viewCurve(points, scene), floor)) {
        runs.push(run);
      }
    }
    return runs;
  }

  /**
   * One weight of one colour, a stroke to each run.
   *
   * Added ink accumulates between strokes and not within one: a path laid down in a single
   * stroke composites once however many times it crosses itself, so gathering the whole
   * side into one path put the courses on the page and took the blaze off the poles. Each
   * run is therefore stroked on its own — and the runs a course is cut into are its turns,
   * because the chart cuts it once a turn, so the light of a coil closing on a pole piles
   * up turn over turn, which is what there is to see there.
   */
  function strokeSide(runs, near, colour, alpha, weight) {
    context.strokeStyle = `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${alpha / 255})`;
    context.lineWidth = weight * RENDER_SCALE;
    for (const run of runs) {
      if (run.near !== near) {
        continue;
      }
      const points = run.points;
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index][0], points[index][1]);
      }
      context.stroke();
    }
  }

  function drawLayer(runs, colour, near, far, weight, roundness) {
    // The half turned away is drawn fainter, and by less the flatter the figure has
    // become: paper has no half turned away, and the difference has to be gone before it
    // becomes a line across the picture.
    strokeSide(runs, false, colour, near + (far - near) * roundness, weight);
    strokeSide(runs, true, colour, near, weight);
  }

  function drawScene(scene) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = `rgb(${GROUND[0]}, ${GROUND[1]}, ${GROUND[2]})`;
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    // The module returns the picture plane with the origin at the middle of the figure and
    // the second axis pointing up, as the figure's own does; a canvas counts down from the
    // top, so the axis is turned over here and nowhere else.
    context.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    context.scale(1, -1);
    context.lineCap = "round";
    context.lineJoin = "round";

    const framed = { ...scene, scale: scene.scale * RENDER_SCALE };
    const grid = runsOf(GRATICULE_CURVES, framed);
    const courses = runsOf(courseCurvesFor(scene.bearing), framed);
    // The grid gives way as the sheet opens; the courses do not.
    const ink = gridInk(scene.open);
    drawLayer(grid, GRATICULE, GRATICULE_NEAR * ink, GRATICULE_FAR * ink, GRATICULE_WEIGHT, scene.roundness);
    context.globalCompositeOperation = "lighter";
    drawLayer(courses, COURSE, HALO_NEAR, HALO_FAR, HALO_WEIGHT, scene.roundness);
    drawLayer(courses, COURSE, COURSE_NEAR, COURSE_FAR, COURSE_WEIGHT, scene.roundness);
    context.restore();
  }

  function drawLegend() {
    p.push();
    p.scale(RENDER_SCALE);
    drawKeyHint(p, HINT_LEGEND, LOGICAL_SIZE, LOGICAL_SIZE, HINT.scale);
    p.pop();
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act ?? "live",
      bearingDegrees: scene.bearing * 180 / Math.PI,
      open: scene.open,
      sphereness: scene.sphereness,
      wrap: scene.wrap,
      roundness: scene.roundness,
      spin: scene.spin,
      tilt: scene.tilt,
      scale: scene.scale,
      courses: COURSES,
      palette: "warm course on a night grid",
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  function liveScene() {
    const { sphereness, wrap } = morphAt(live.open);
    const { centre, roundness, scale } = figureFrame(live.open);
    return {
      spin: live.spin,
      tilt: live.tilt,
      bearing: live.bearing,
      open: live.open,
      sphereness,
      wrap,
      centre,
      roundness,
      scale
    };
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists: an export is the size
    // the manifest says rather than whatever density the rendering machine has.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    context = p.drawingContext;
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => {
        const scene = sceneAt(frameIndex);
        drawScene(scene);
        // The clip carries no legend: it cannot be dragged or typed at. The gallery
        // thumbnail is a picture of a page that can be, so it asks for one.
        if (HINT.shown) {
          drawLegend();
        }
        return Promise.resolve(publishState(frameIndex, scene));
      };
    }
    const opening = CAPTURE_MODE ? sceneAt(0) : liveScene();
    drawScene(opening);
    if (!CAPTURE_MODE && HINT.shown) {
      drawLegend();
    }
    publishState(0, opening);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    if (p.keyIsDown(p.LEFT_ARROW)) {
      live.bearing = Math.max(MINIMUM_BEARING, live.bearing - BEARING_RATE);
    }
    if (p.keyIsDown(p.RIGHT_ARROW)) {
      live.bearing = Math.min(MAXIMUM_BEARING, live.bearing + BEARING_RATE);
    }
    live.open = live.openTarget > live.open
      ? Math.min(live.openTarget, live.open + OPEN_RATE)
      : Math.max(live.openTarget, live.open - OPEN_RATE);
    // The globe keeps its own slow turn; the chart, once unrolled, stays put.
    live.spin += DRIFT * (1 - live.open);
    const scene = liveScene();
    drawScene(scene);
    if (HINT.shown) {
      drawLegend();
    }
    publishState(p.frameCount, scene);
  };

  p.keyPressed = () => {
    if (p.key === " ") {
      live.openTarget = live.openTarget > 0.5 ? 0 : 1;
      return false;
    }
    // The arrows scroll a page by default, and this one is a canvas being steered.
    if (p.keyCode === p.LEFT_ARROW || p.keyCode === p.RIGHT_ARROW) {
      return false;
    }
    return true;
  };

  p.mouseDragged = () => {
    live.spin += (p.mouseX - p.pmouseX) * 0.01;
    live.tilt = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, live.tilt + (p.mouseY - p.pmouseY) * 0.008)
    );
    return false;
  };
});

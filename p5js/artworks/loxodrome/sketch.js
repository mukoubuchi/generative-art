import {
  COURSES,
  DURATION_SECONDS,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  WIDEST_STROKE,
  courseCurves,
  depthFloor,
  graticuleCurves,
  gridInk,
  sceneAt,
  splitByDepth,
  viewCurve
} from "./loxodrome.js";

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
 * The page plays the same twelve-second staging the clip is rendered from, advanced from
 * elapsed time so that a missed draw skips ahead rather than stretching the performance,
 * and loops. There is nothing for the reader to do, so there is no legend: the figure was
 * an instrument once, and the instrument told nothing the staging does not.
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
const HALO_WEIGHT = WIDEST_STROKE;

const GRATICULE_CURVES = graticuleCurves().map((curve) => curve.points);

const P5 = window.p5;

new P5((p) => {
  let context;
  let playbackStartedAt;
  let courseCache = { bearing: null, curves: null };

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
    // The context is drawn to directly, so p5's own transform is replaced here -- and
    // with it the pixel density it carries. On a Retina screen p5 backs a 680-pixel
    // canvas with 1360 device pixels and scales every drawing call by two; a transform
    // reset to the identity draws 680 device pixels, which is the top-left quarter of the
    // canvas, and the rest of it is left transparent. So the density is put back first.
    // While capturing it is pinned to one, and nothing below changes.
    const density = p.pixelDensity();
    context.setTransform(density, 0, 0, density, 0, 0);
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

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
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
        return Promise.resolve(publishState(frameIndex, scene));
      };
    }
    const opening = sceneAt(0);
    drawScene(opening);
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
    drawScene(scene);
    publishState(frameIndex, scene);
  };
});

import { BOX } from "./foam.js";
import { DURATION_SECONDS, LOGICAL_SIZE, PLAYBACK_FPS, TOTAL_FRAMES, createRun } from "./homo-bulla.js";

/**
 * A foam coarsening on a torus, drawn as its films, with the camera standing back as it
 * coarsens.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
/** The pale ground, and the films drawn over it in a slate blue: 0.7 of a screen pixel wide. */
const GROUND = [234, 240, 244];
const FILM = [64, 88, 108];
const FILM_ALPHA = 0.85;
const FILM_WIDTH = 0.7;
/**
 * A bubble's sides shown as light: short of six it is shaded with the film's colour, up to
 * DARKER_ALPHA; past six it is lit with white, up to LIGHTER_ALPHA; the further from six,
 * the more, up to three sides away. A hexagon is left the colour of the ground.
 */
const DARKER_ALPHA = 0.12;
const LIGHTER = [255, 255, 255];
const LIGHTER_ALPHA = 0.6;
/** How far along each film, in screen pixels, the liquid where three films meet reaches. */
const BORDER_REACH = 5;
const P5 = window.p5;

const RUN = createRun();

/** How far the camera stands back at a frame: enough to keep the mean bubble its first size. */
function zoomAt(frameIndex) {
  return Math.sqrt(RUN.frames[0].count / RUN.frame(frameIndex).count);
}

function arcPath(context, ox, oy, dx, dy, sine, start) {
  const c = Math.sqrt(dx * dx + dy * dy);
  if (c === 0) return;
  const ux = dx / c;
  const uy = dy / c;
  const rx = uy;
  const ry = -ux;
  const cosine = Math.sqrt(1 - sine * sine);
  const tanHalf = sine / (1 + cosine);
  const sag = (c / 2) * tanHalf;
  const mx = ox + dx / 2 + rx * sag;
  const my = oy + dy / 2 + ry * sag;
  const halfCos = Math.sqrt((1 + cosine) / 2);
  const reach = Math.sqrt((c / 2) ** 2 + sag * sag) / 2 / halfCos;
  if (start) context.moveTo(ox, oy);
  context.quadraticCurveTo(ox + (cosine * ux + sine * rx) * reach, oy + (cosine * uy + sine * ry) * reach, mx, my);
  const ex = ox + dx;
  const ey = oy + dy;
  context.quadraticCurveTo(ex - (cosine * ux - sine * rx) * reach, ey - (cosine * uy - sine * ry) * reach, ex, ey);
}

new P5((p) => {
  let playbackStartedAt = 0;

  function drawFrame(frameIndex) {
    const frame = RUN.frame(frameIndex);
    const zoom = zoomAt(frameIndex);
    const context = p.drawingContext;
    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    // World to canvas: the torus's centre at the canvas's centre, BOX·zoom world units across.
    const scale = LOGICAL_SIZE / (BOX * zoom);
    context.translate(LOGICAL_SIZE / 2, LOGICAL_SIZE / 2);
    context.scale(scale, scale);
    context.translate(-BOX / 2, -BOX / 2);
    const half = (BOX * zoom) / 2;
    const low = BOX / 2 - half;
    const high = BOX / 2 + half;
    const tiles = [];
    for (let i = Math.floor(low / BOX) - 1; i <= Math.floor(high / BOX) + 1; i += 1) tiles.push(i);
    const films = frame.films;
    // A bubble short of six sides is shaded, one past six lit, and a hexagon left alone.
    let cursor = 0;
    for (let b = 0; b < frame.bubbles.length; b += 2) {
      const sides = frame.bubbles[b + 1];
      const ring = frame.rings.subarray(cursor, cursor + sides);
      cursor += sides;
      if (sides === 6) continue;
      const share = Math.min(1, Math.abs(sides - 6) / 3);
      const colour = sides < 6 ? FILM : LIGHTER;
      const alpha = share * (sides < 6 ? DARKER_ALPHA : LIGHTER_ALPHA);
      context.fillStyle = `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha})`;
      const first = ring[0];
      const k0 = Math.abs(first) - 1;
      let px = first > 0 ? films[k0 * 5] : films[k0 * 5] + films[k0 * 5 + 2];
      let py = first > 0 ? films[k0 * 5 + 1] : films[k0 * 5 + 1] + films[k0 * 5 + 3];
      for (const ti of tiles) {
        for (const tj of tiles) {
          context.beginPath();
          let x = px + ti * BOX;
          let y = py + tj * BOX;
          let startPath = true;
          for (const entry of ring) {
            const k = Math.abs(entry) - 1;
            const dx = entry > 0 ? films[k * 5 + 2] : -films[k * 5 + 2];
            const dy = entry > 0 ? films[k * 5 + 3] : -films[k * 5 + 3];
            const sine = entry > 0 ? films[k * 5 + 4] : -films[k * 5 + 4];
            arcPath(context, x, y, dx, dy, sine, startPath);
            startPath = false;
            x += dx;
            y += dy;
          }
          context.closePath();
          context.fill();
        }
      }
    }
    const filmPath = new Path2D();
    for (let k = 0; k < films.length / 5; k += 1) {
      const ox = films[k * 5];
      const oy = films[k * 5 + 1];
      const dx = films[k * 5 + 2];
      const dy = films[k * 5 + 3];
      const sine = films[k * 5 + 4];
      for (const ti of tiles) {
        const x = ox + ti * BOX;
        if (Math.max(x, x + dx) < low - 2 || Math.min(x, x + dx) > high + 2) continue;
        for (const tj of tiles) {
          const y = oy + tj * BOX;
          if (Math.max(y, y + dy) < low - 2 || Math.min(y, y + dy) > high + 2) continue;
          arcPath(filmPath, x, y, dx, dy, sine, true);
        }
      }
    }
    const [fr, fg, fb] = FILM;
    context.lineCap = "round";
    context.strokeStyle = `rgba(${fr},${fg},${fb},${FILM_ALPHA})`;
    context.lineWidth = FILM_WIDTH / scale;
    context.stroke(filmPath);
    // Where three films meet, the liquid they drain into: a small triangle whose three
    // sides curve in, each touching two films. Drawn, not simulated: the model's films
    // have no thickness.
    const reach = BORDER_REACH / scale;
    const corners = frame.corners;
    const borders = new Path2D();
    for (let v = 0; v < corners.length; v += 8) {
      for (const ti of tiles) {
        const px = corners[v] + ti * BOX;
        if (px < low - 8 || px > high + 8) continue;
        for (const tj of tiles) {
          const py = corners[v + 1] + tj * BOX;
          if (py < low - 8 || py > high + 8) continue;
          const q = [0, 1, 2].map((k) => [px + corners[v + 2 + 2 * k] * reach, py + corners[v + 3 + 2 * k] * reach]);
          borders.moveTo(q[0][0], q[0][1]);
          borders.quadraticCurveTo(px, py, q[1][0], q[1][1]);
          borders.quadraticCurveTo(px, py, q[2][0], q[2][1]);
          borders.quadraticCurveTo(px, py, q[0][0], q[0][1]);
          borders.closePath();
        }
      }
    }
    context.fillStyle = `rgba(${fr},${fg},${fb},${FILM_ALPHA})`;
    context.fill(borders);
    p.pop();
    return frame;
  }

  function publishState(frameIndex, frame) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      bubbles: frame.count,
      sidesTotal: frame.sidesTotal,
      swaps: frame.swaps,
      vanished: frame.vanished,
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
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
    playbackStartedAt = window.performance.now();
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const elapsed = window.performance.now() - playbackStartedAt;
    let frameIndex = Math.floor(elapsed * PLAYBACK_FPS / 1000) % TOTAL_FRAMES;
    // The foam is a history: frames not yet lived through are computed, a few at a time.
    const known = RUN.frames.length - 1;
    if (frameIndex > known + 6) frameIndex = known + 6;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});

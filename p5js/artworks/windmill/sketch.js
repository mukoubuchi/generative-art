import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import { mulberry32 } from "../shared/random.js";
import {
  CALM_STEPS,
  GALE_WIND,
  GUST_SEED,
  RELEASE_STEP,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  advanceMill,
  captureWindAt,
  createMill,
  gustTrack,
  millAfter
} from "./mill.js";
import { sailSegments, towerShape } from "./silhouette.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const ACCELERATE_KEY = "k";
const KEY_HINT = [
  { cap: "K", text: "hold to raise the wind" },
  { cap: "release", text: "let it fall" }
];

/** Where the giant stands: hub, sail reach, horizon, tower footing. */
const HUB_X = 340;
const HUB_Y = 292;
const SAIL_LENGTH = 232;
const HORIZON_Y = 560;
const TOWER = towerShape({
  hubX: HUB_X,
  crownY: 278,
  baseY: 620,
  crownWidth: 52,
  baseWidth: 98,
  capOverhang: 9,
  capHeight: 42
});

/** Dusk over the plain: violet zenith through rose to an ember horizon. */
const SKY_TOP = [22, 15, 41];
const SKY_MID = [76, 36, 66];
const SKY_MID_Y = 310;
const SKY_HORIZON = [193, 100, 50];
const PLAIN = [13, 11, 15];
const HILL = [16, 13, 17];
const MILL_INK = [17, 13, 19];
const WINDOW_EMBER = [255, 178, 88];
const STREAK_IVORY = [236, 208, 164];
const STAR_TINT = [220, 210, 235];

/** The fixed stars and the streaks the wind carries; both seeded, both deterministic. */
const STAR_SEED = 7;
const STAR_COUNT = 46;
const GRAIN_SEED = 13;
const GRAIN_COUNT = 2200;
const STREAK_SEED = 11;
const STREAK_COUNT = 24;
const STREAK_SPAN = 140;
const STREAK_DRIFT = 14;

function seededStars() {
  const random = mulberry32(STAR_SEED);
  return Array.from({ length: STAR_COUNT }, () => {
    const y = 30 + random() * 220;
    return { x: random() * LOGICAL_WIDTH, y, size: 1 + random() * 1.2, fade: 1 - y / 280 };
  });
}

function seededGrain() {
  const random = mulberry32(GRAIN_SEED);
  return Array.from({ length: GRAIN_COUNT }, () => ({
    x: random() * LOGICAL_WIDTH,
    y: random() * HORIZON_Y,
    light: random() < 0.5
  }));
}

function seededStreaks() {
  const random = mulberry32(STREAK_SEED);
  return Array.from({ length: STREAK_COUNT }, () => ({
    y: 70 + random() * 440,
    offset: random() * (LOGICAL_WIDTH + STREAK_SPAN),
    jitter: 0.7 + 0.6 * random()
  }));
}

const STARS = seededStars();
const GRAIN = seededGrain();
const STREAKS = seededStreaks();
const SAILS = sailSegments(SAIL_LENGTH);
const SAIL_WEIGHTS = { spar: 6, stringer: 3.2, rung: 2.6 };

const LIVE_TRACK = gustTrack(GUST_SEED);
const liveMill = createMill();
let liveStep = 0;
let liveEnvelope = 0;
let holding = false;

const P5 = window.p5;

new P5((p) => {
  function mix(from, to, amount) {
    return [
      from[0] + (to[0] - from[0]) * amount,
      from[1] + (to[1] - from[1]) * amount,
      from[2] + (to[2] - from[2]) * amount
    ];
  }

  function drawSky() {
    p.noStroke();
    for (let y = 0; y < HORIZON_Y; y += 1) {
      const color = y < SKY_MID_Y
        ? mix(SKY_TOP, SKY_MID, y / SKY_MID_Y)
        : mix(SKY_MID, SKY_HORIZON, (y - SKY_MID_Y) / (HORIZON_Y - SKY_MID_Y));
      p.fill(...color);
      p.rect(0, y, LOGICAL_WIDTH, 1);
    }
    // A static seeded grain breaks the banding an eight-bit gradient cannot avoid.
    for (const grain of GRAIN) {
      if (grain.light) {
        p.fill(255, 255, 255, 7);
      } else {
        p.fill(0, 0, 0, 9);
      }
      p.rect(grain.x, grain.y, 1.4, 1.4);
    }
    for (const star of STARS) {
      p.fill(STAR_TINT[0], STAR_TINT[1], STAR_TINT[2], 85 * star.fade);
      p.circle(star.x, star.y, star.size);
    }
  }

  /** The wind made visible: streaks whose length and light are the moment's wind. */
  function drawStreaks(wind, windTravel) {
    if (wind <= 0) {
      return;
    }
    const alpha = 64 * (wind / GALE_WIND) ** 1.5;
    p.stroke(STREAK_IVORY[0], STREAK_IVORY[1], STREAK_IVORY[2], alpha);
    p.strokeWeight(1.7);
    p.strokeCap(p.ROUND);
    for (const streak of STREAKS) {
      const span = LOGICAL_WIDTH + STREAK_SPAN;
      const head = ((streak.offset + windTravel * STREAK_DRIFT) % span + span) % span - STREAK_SPAN;
      const length = (12 + 8.5 * wind) * streak.jitter;
      p.line(head - length, streak.y, head, streak.y);
    }
  }

  function drawGround() {
    p.noStroke();
    p.fill(...PLAIN);
    p.rect(0, HORIZON_Y, LOGICAL_WIDTH, LOGICAL_HEIGHT - HORIZON_Y);
    p.fill(...HILL);
    p.ellipse(HUB_X, 705, 1060, 300);
  }

  function drawTower() {
    p.noStroke();
    p.fill(...MILL_INK);
    p.beginShape();
    for (const point of TOWER.body) {
      p.vertex(point.x, point.y);
    }
    p.endShape(p.CLOSE);
    p.beginShape();
    for (const point of TOWER.cap) {
      p.vertex(point.x, point.y);
    }
    p.endShape(p.CLOSE);
    // One lit window, because it is a mill and someone is home — not a giant.
    p.fill(...WINDOW_EMBER);
    p.rect(HUB_X - 6, 470, 12, 18, 6, 6, 0, 0);
  }

  function drawSails(angle) {
    p.push();
    p.translate(HUB_X, HUB_Y);
    p.rotate(angle);
    p.stroke(...MILL_INK);
    p.strokeCap(p.ROUND);
    for (const sail of SAILS) {
      for (const segment of sail) {
        p.strokeWeight(SAIL_WEIGHTS[segment.role]);
        p.line(segment.x1, segment.y1, segment.x2, segment.y2);
      }
    }
    p.pop();
    p.noStroke();
    p.fill(...MILL_INK);
    p.circle(HUB_X, HUB_Y, 26);
  }

  function drawFrame(mill, wind) {
    p.push();
    p.scale(RENDER_SCALE);
    drawSky();
    drawStreaks(wind, mill.windTravel);
    drawGround();
    drawTower();
    drawSails(mill.angle);
    if (HINT.shown) {
      drawKeyHint(p, KEY_HINT, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
    p.pop();
  }

  function publishState(frameIndex, mill, wind, accelerating) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      speed: mill.speed,
      angle: mill.angle,
      wind,
      accelerating,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is the fold of the seeded scenario up to its own step, so any
      // frame can be rebuilt on its own and the whole clip is reproducible.
      window.__renderFrame = (frameIndex) => {
        const steps = (frameIndex + 1) * STEPS_PER_FRAME;
        const mill = millAfter(steps);
        const wind = captureWindAt(steps);
        const held = steps > CALM_STEPS && steps <= RELEASE_STEP;
        drawFrame(mill, wind);
        if (INDICATOR) {
          // The key that is raising this wind, lit while the scenario holds it.
          p.push();
          p.scale(RENDER_SCALE);
          drawKeyIndicator(p, [{ label: "K", active: held }], LOGICAL_WIDTH, LOGICAL_HEIGHT);
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, mill, wind, held));
      };
    }
    drawFrame(liveMill, 0);
    publishState(0, liveMill, 0, false);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The live wind: the same seeded gusts, gated by an envelope that chases the key.
    const windAtLive = (step) => liveEnvelope * LIVE_TRACK.speedAt(step);
    let wind = 0;
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      liveEnvelope += ((holding ? 1 : 0) - liveEnvelope) * 0.05;
      advanceMill(liveMill, windAtLive, liveStep);
      liveStep += 1;
      wind = windAtLive(liveStep);
    }
    drawFrame(liveMill, wind);
    publishState(p.frameCount, liveMill, wind, holding);
  };

  // p5 2.x reports keys through `key`; `keyCode` still holds the legacy number.
  p.keyPressed = () => {
    if (p.key?.toLowerCase() !== ACCELERATE_KEY) {
      return true;
    }
    holding = true;
    return false;
  };

  p.keyReleased = () => {
    if (p.key?.toLowerCase() !== ACCELERATE_KEY) {
      return true;
    }
    holding = false;
    return false;
  };
});

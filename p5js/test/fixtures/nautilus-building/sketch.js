import { buildChambers, fitToCanvas } from "./geometry.js";

/**
 * A shell built one chamber at a time, none thrown away.
 *
 * The chambers are the eased shrink schedule the artwork has always had, read in the
 * order the animal lived it: smallest first, each outgrowing the last. Colour is age —
 * the low-vaulted early rooms sit in abyss teal, the latest great chamber arrives in
 * pearl — and every chamber is translucent, so where the spiral packs the rooms deep
 * the paint stacks into nacre. The page builds the shell chamber by chamber, because
 * the building is the poem; the capture takes the finished shell.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const FILL_RATIO = 0.88;
/** The original's 1 px stroke against a start radius of 200, kept as that fraction. */
const STROKE_WEIGHT = 1 / 200;
/** One chamber a frame: the whole shell in five and a quarter seconds. */
const CHAMBERS_PER_FRAME = 1;

/** The deep the shell is built in. */
const GROUND = [8, 11, 14];
/** Age's colour, oldest room first: abyss teal, sea glass, sand, pearl. */
const AGE_STOPS = [
  [24, 86, 88],
  [88, 144, 128],
  [196, 178, 132],
  [252, 238, 200]
];
/**
 * Walls are the age colour at a whisper — every chamber shares the anchor corner, so
 * near the pole all hundred and fifty-eight walls stack and the whisper accumulates
 * into the shell's luminous heart. The rims carry the age plainly: the spiral of
 * chamber edges is where the palette tells its teal-to-pearl story.
 */
const FILL_ALPHA = 22;
const RIM_ALPHA = 235;

const CHAMBERS = buildChambers();
const PLACEMENT = fitToCanvas(
  CHAMBERS.map((chamber) => chamber.corners),
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  FILL_RATIO
);

/**
 * Age's colour, paced by the room's own size rather than its ordinal. The radius is a
 * faithful clock — it rises strictly with every chamber built, which is pinned — but
 * the first eighty rooms fit inside a coin, so a palette walked by ordinal would spend
 * half its colours where the eye cannot follow. Squaring the radius spreads the teal
 * of the early life across the visible heart of the shell and saves the pearl for the
 * great chambers that earn it.
 */
function ageColor(chamber) {
  const scaled = chamber.radius ** 2 * (AGE_STOPS.length - 1);
  const stop = Math.min(Math.floor(scaled), AGE_STOPS.length - 2);
  const within = scaled - stop;
  return AGE_STOPS[stop].map(
    (channel, componentIndex) =>
      channel + (AGE_STOPS[stop + 1][componentIndex] - channel) * within
  );
}

const P5 = window.p5;

new P5((p) => {
  let built = 0;

  /**
   * The shell with its first `count` chambers standing, walls under rims.
   *
   * Two passes rather than one. Every chamber shares the anchor corner, so a later
   * room's translucent wall lands on top of every earlier room — a hundred layers
   * deep at the pole — and rims painted in one pass with their walls end up buried
   * under the rooms built after them. The walls are laid down first and the rims over
   * them all, so the oldest teal edge stays as legible as the newest pearl one.
   */
  function drawShell(count) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(PLACEMENT.offsetX, PLACEMENT.offsetY);
    p.scale(PLACEMENT.scale);
    p.noStroke();
    for (let index = 0; index < count; index += 1) {
      p.fill(...ageColor(CHAMBERS[index]), FILL_ALPHA);
      p.beginShape();
      for (const corner of CHAMBERS[index].corners) {
        p.vertex(corner.x, corner.y);
      }
      p.endShape(p.CLOSE);
    }
    p.noFill();
    p.strokeWeight(STROKE_WEIGHT);
    for (let index = 0; index < count; index += 1) {
      p.stroke(...ageColor(CHAMBERS[index]), RIM_ALPHA);
      p.beginShape();
      for (const corner of CHAMBERS[index].corners) {
        p.vertex(corner.x, corner.y);
      }
      p.endShape(p.CLOSE);
    }
    p.pop();
  }

  function publishState(builtChambers) {
    window.__ARTWORK_STATE__ = {
      kind: "image",
      chambers: CHAMBERS.length,
      builtChambers,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists. Before it, p5 has
    // nothing to set the density on and the call is quietly ignored; on a Retina screen
    // the backing store then comes out twice the size asked for. Left alone in the
    // browser, so a reader on such a screen gets the picture drawn at their own
    // resolution -- and pinned here, so an export is the size the manifest says
    // rather than whatever density the machine doing the rendering happens to have.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    p.background(...GROUND);
    if (CAPTURE_MODE) {
      p.noLoop();
      drawShell(CHAMBERS.length);
      publishState(CHAMBERS.length);
      return;
    }
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE || built >= CHAMBERS.length) {
      return;
    }
    built = Math.min(built + CHAMBERS_PER_FRAME, CHAMBERS.length);
    // The whole shell so far is redrawn each frame: a hundred and fifty-eight shapes
    // at most, cheap enough that the growing picture can stay exactly the finished
    // picture's prefix.
    drawShell(built);
    publishState(built);
  };
});

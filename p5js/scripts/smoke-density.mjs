#!/usr/bin/env node

/**
 * Opens the artworks that a dense display can break, on a dense display.
 *
 * The unit tests run without a browser by design, so they hold this ground statically: no
 * sketch sets a pixel density before it has a canvas, and a sketch that writes pixels
 * indexes by the backing store. Both are properties of the source. Neither of them looks at
 * a canvas, and the fault they were written for -- three artworks drawing themselves into
 * the top quarter of a Retina buffer -- was only ever visible on one.
 *
 * So this runs where the unit tests will not: a browser at a device pixel ratio of two,
 * which is what the fault needed to appear. It lives with the gallery build rather than
 * with the unit tests, because that is where a browser is already installed and where the
 * repository has decided browser-shaped checks belong.
 *
 * What is checked depends on what an artwork is. The ones that write pixels by hand set
 * every pixel of the canvas themselves, so anything short of the whole buffer being written
 * to is the fault itself. The clips that accumulate cannot be checked that way -- a crystal
 * on a dark ground writes the whole buffer while covering very little of it -- so they are
 * asked two things instead. That they move: their opening frame, an early frame and their
 * last must all differ. And that a frame is a function of its index and nothing else, which
 * is the claim their capture path actually rests on: a frame is reached by walking forward
 * from wherever the sketch has got to, over code that keeps its place between calls and can
 * be asked to go back. Three paths arrive at the final frame -- the renderer's walk from
 * the opening, the thumbnail's jump on a page that has drawn nothing, and a walk resumed
 * after being sent back -- and if they disagree, the thumbnail on the gallery card is not
 * the end of the clip it is standing for.
 *
 * The measure has to be able to say no, or a green run means nothing, so it is checked
 * twice before it is believed. Once against a canvas painted only across its top quarter,
 * which needs no p5 and no artwork. And once against the fault as it was really made: a
 * frozen copy of the sketch that shipped broken, which must still read as mostly unpainted.
 * The first only proves the arithmetic; the second proves the measure would have caught
 * what a reader caught, which is a stronger claim than any defect written to be caught.
 */

import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { loadCatalog } from "../lib/catalog.mjs";
import { startStaticServer } from "../lib/render.mjs";

const DEVICE_PIXEL_RATIO = 2;
const BANDS = 8;

/**
 * The unrepaired sketch, frozen under test/fixtures rather than fetched from history: the
 * gallery workflow checks out at depth one, so the commit this came from is not there to
 * be read.
 */
const SPECIMEN_PATH = "/p5js/test/fixtures/retina-density-fault/index.html";
const SPECIMEN_COMMIT = "facea56";

/**
 * The specimen wrote a grid of half the width into its buffer, which fills the top quarter
 * of the canvas and leaves the rest of it bare: six of eight bands, measured, the two at the
 * top being the quarter it did paint. Four is required rather than six, because the exact
 * figure depends on how far the strokes drawn over the cells happen to reach and a change
 * of p5 could move it, while "the bottom half was never written to" is the fault itself.
 */
const SPECIMEN_BARE_BANDS = 4;

/**
 * The clips whose frames are walked up to rather than drawn from nothing. A frame of one of
 * these depends on the frames before it, which is the shape that can go wrong quietly, and
 * they are all recent. Pinned so that a new one has to be added here on purpose.
 */
const ACCUMULATING = [
  "circle-packing",
  "dla-frost",
  "flow-field",
  "strange-attractor",
  "ulam-spiral"
];

/** The frame every clip is asked to arrive at three ways, and an early one to pass through. */
const EARLY_FRAME = 12;

function sourceOf(artworkId) {
  return readFileSync(new URL(`../artworks/${artworkId}/sketch.js`, import.meta.url), "utf8");
}

/**
 * The share of each horizontal band of the canvas that has been written to at all.
 *
 * Written to, rather than any judgement about colour. These three artworks set every pixel
 * of the canvas themselves, alpha and all, and a canvas starts out transparent -- so the
 * question "was this part of the buffer reached" is answered by the alpha channel and by
 * nothing else. Asking about colour instead is what makes this kind of check unreliable:
 * ground colour varies across a picture, "not black" counts a stray speck as a painted
 * band, and taking the ground from the top row is worst of all here, since the top of the
 * canvas is precisely the strip the fault does paint.
 */
const measureBands = (bands) => {
  const canvas = document.querySelector("canvas");
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const shares = [];
  for (let band = 0; band < bands; band += 1) {
    const y = Math.floor((height * (band + 0.5)) / bands);
    const row = context.getImageData(0, y, width, 1).data;
    let written = 0;
    for (let x = 0; x < width; x += 1) {
      if (row[x * 4 + 3] > 8) {
        written += 1;
      }
    }
    shares.push(Math.round((written / width) * 100));
  }
  return { backing: `${width}x${height}`, shares };
};

async function open(browser, url) {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
    deviceScaleFactor: DEVICE_PIXEL_RATIO
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ARTWORK_READY__ === true, undefined, { timeout: 60_000 });
  return { page, errors };
}

const failures = [];
const note = (line) => process.stdout.write(`${line}\n`);

const { manifest } = await loadCatalog();
const server = await startStaticServer();
const browser = await chromium.launch();
try {
  // A canvas painted only across its top quarter -- which is the shape the fault had -- must
  // come back with its lower bands empty. No p5 and no artwork are involved, so this says
  // only that the arithmetic can report a gap.
  const control = await browser.newPage({ deviceScaleFactor: DEVICE_PIXEL_RATIO });
  await control.setContent('<canvas id="c" width="400" height="400"></canvas>');
  await control.evaluate(() => {
    const context = document.querySelector("canvas").getContext("2d");
    context.fillStyle = "#e8e2d0";
    context.fillRect(0, 0, 400, 100);
  });
  const controlBands = await control.evaluate(measureBands, BANDS);
  await control.close();
  const lower = controlBands.shares.slice(2);
  if (controlBands.shares[0] !== 100 || lower.some((share) => share !== 0)) {
    failures.push(`the measure cannot tell a quarter-painted canvas from a whole one: ${controlBands.shares}`);
  }
  note(`control (painted top quarter only): ${controlBands.shares.join(" ")}`);

  // And the same measure, unchanged, against the sketch that actually shipped broken: real
  // p5, a real page, the density the reader had. This is the one that matters, because a
  // fault written in order to be caught tells you nothing about the fault you did not see.
  const specimen = await open(browser, `${server.baseUrl}${SPECIMEN_PATH}`);
  const specimenBands = await specimen.page.evaluate(measureBands, BANDS);
  await specimen.page.close();
  const bare = specimenBands.shares.filter((share) => share < 95).length;
  note(
    `${`specimen ${SPECIMEN_COMMIT}`.padEnd(26)} backing ${specimenBands.backing.padEnd(11)}`
    + ` bands ${specimenBands.shares.join(" ")}`
    + `   ${bare} of ${BANDS} unpainted (the fault as it shipped)`
  );
  if (bare < SPECIMEN_BARE_BANDS) {
    failures.push(
      `the measure reads ${bare} of ${BANDS} bands as unpainted on the unrepaired sketch,`
      + ` which drew into the top quarter of the canvas and nowhere else`
    );
  }
  if (specimen.errors.length > 0) {
    failures.push(`the specimen page: ${specimen.errors[0]}`);
  }

  // Artworks that write every pixel by hand. Derived rather than listed, so one that starts
  // writing pixels is checked without anybody remembering to add it.
  const writers = manifest.artworks
    .filter((artwork) => sourceOf(artwork.id).includes("p.pixels"))
    .map((artwork) => artwork.id);
  if (writers.length === 0) {
    failures.push("no artwork writes pixels by hand, so this check is looking at nothing");
  }
  for (const artworkId of writers) {
    const { page, errors } = await open(
      browser,
      `${server.baseUrl}/p5js/artworks/${artworkId}/index.html`
    );
    const { backing, shares } = await page.evaluate(measureBands, BANDS);
    const unpainted = shares.filter((share) => share < 95);
    note(`${artworkId.padEnd(26)} backing ${backing.padEnd(11)} bands ${shares.join(" ")}`);
    if (unpainted.length > 0) {
      failures.push(`${artworkId} leaves ${unpainted.length} of ${BANDS} bands unpainted at ${DEVICE_PIXEL_RATIO}x`);
    }
    if (errors.length > 0) {
      failures.push(`${artworkId}: ${errors[0]}`);
    }
    await page.close();
  }

  // Clips whose frames are walked up to. Asked to advance rather than to cover, and asked
  // through the capture path, which is where a frame is meant to be a function of its index.
  const accumulating = manifest.artworks
    .filter((artwork) => /function \w+UpTo\(/u.test(sourceOf(artwork.id)))
    .map((artwork) => artwork.id)
    .sort();
  if (accumulating.join(",") !== ACCUMULATING.join(",")) {
    failures.push(`the roll of accumulating clips has changed: ${accumulating.join(", ")}`);
  }
  for (const artworkId of accumulating) {
    const artwork = manifest.artworks.find((entry) => entry.id === artworkId);
    const lastFrame = Math.round(artwork.render.durationSeconds * manifest.defaults.fps) - 1;
    const { page, errors } = await open(
      browser,
      `${server.baseUrl}/p5js/artworks/${artworkId}/index.html?capture=1&renderScale=1`
    );
    const shot = (frame) => page.evaluate(async (index) => {
      await window.__renderFrame(index);
      return document.querySelector("canvas").toDataURL("image/png");
    }, frame);

    // Asked for first, on a page that has drawn nothing: the jump the thumbnail makes.
    const cold = await shot(lastFrame);
    // Asking for the opening frame now is a step backwards, which is the branch that throws
    // the picture away and starts again. So everything after it is a walk forward, and the
    // final frame is arrived at a second time by a different road than the thumbnail took.
    const opening = await shot(0);
    const early = await shot(EARLY_FRAME);
    const walked = await shot(lastFrame);

    const advances = opening !== early && early !== walked;
    const goesBack = opening !== cold;
    const agrees = cold === walked;
    note(
      `${artworkId.padEnd(26)} frames 0 < ${EARLY_FRAME} < ${lastFrame} all differ: ${advances ? "yes" : "NO"}`
      + `   jumped and walked frame ${lastFrame} agree: ${agrees ? "yes" : "NO"}`
    );
    if (!advances) {
      failures.push(`${artworkId} does not advance between its opening, an early frame and its last`);
    }
    if (!goesBack) {
      failures.push(`${artworkId} keeps its last frame when asked for its first, so it never goes back`);
    }
    if (!agrees) {
      failures.push(
        `${artworkId} draws frame ${lastFrame} differently depending on how it was reached,`
        + ` so its thumbnail is not the end of its clip`
      );
    }
    if (errors.length > 0) {
      failures.push(`${artworkId}: ${errors[0]}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`FAIL ${failure}\n`);
  }
  process.exitCode = 1;
} else {
  note(`\nAll clear at ${DEVICE_PIXEL_RATIO}x.`);
}

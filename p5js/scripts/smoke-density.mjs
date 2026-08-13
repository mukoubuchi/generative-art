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
 * asked instead to move: their opening frame, an early frame and their last must all differ,
 * asked for through the capture path where a frame is a function of its index.
 *
 * The measure is checked against a canvas painted only across its top quarter before any
 * artwork is opened, because a coverage measure that cannot report a gap would pass
 * everything. Restoring the fault in one sketch makes this fail, which is how it was
 * confirmed rather than assumed.
 */

import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { loadCatalog } from "../lib/catalog.mjs";
import { startStaticServer } from "../lib/render.mjs";

const DEVICE_PIXEL_RATIO = 2;
const BANDS = 8;

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

async function open(browser, baseUrl, artworkId, search = "") {
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
  await page.goto(`${baseUrl}/p5js/artworks/${artworkId}/index.html${search}`, {
    waitUntil: "networkidle"
  });
  await page.waitForFunction(() => window.__ARTWORK_READY__ === true, undefined, { timeout: 60_000 });
  return { page, errors };
}

const failures = [];
const note = (line) => process.stdout.write(`${line}\n`);

const { manifest } = await loadCatalog();
const server = await startStaticServer();
const browser = await chromium.launch();
try {
  // The measure has to be able to say no, or a green run means nothing. A canvas painted
  // only across its top quarter -- which is exactly how the fault looked -- must come back
  // with its lower bands empty.
  const control = await browser.newPage({ deviceScaleFactor: DEVICE_PIXEL_RATIO });
  await control.setContent('<canvas id="c" width="400" height="400"></canvas>');
  await control.evaluate(() => {
    // Painted across the top quarter and left untouched below it, which is the shape the
    // fault had: a logical grid written into a buffer twice its size.
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

  // Artworks that write every pixel by hand. Derived rather than listed, so one that starts
  // writing pixels is checked without anybody remembering to add it.
  const writers = manifest.artworks
    .filter((artwork) => sourceOf(artwork.id).includes("p.pixels"))
    .map((artwork) => artwork.id);
  if (writers.length === 0) {
    failures.push("no artwork writes pixels by hand, so this check is looking at nothing");
  }
  for (const artworkId of writers) {
    const { page, errors } = await open(browser, server.baseUrl, artworkId);
    const { backing, shares } = await page.evaluate(measureBands, BANDS);
    const bare = shares.filter((share) => share < 95);
    note(`${artworkId.padEnd(26)} backing ${backing.padEnd(11)} bands ${shares.join(" ")}`);
    if (bare.length > 0) {
      failures.push(`${artworkId} leaves ${bare.length} of ${BANDS} bands unpainted at ${DEVICE_PIXEL_RATIO}x`);
    }
    if (errors.length > 0) {
      failures.push(`${artworkId}: ${errors[0]}`);
    }
    await page.close();
  }

  // Clips whose frames are walked up to. Asked to advance rather than to cover, and asked
  // through the capture path, which is where a frame is a function of its index.
  const accumulating = manifest.artworks
    .filter((artwork) => /function \w+UpTo\(/u.test(sourceOf(artwork.id)))
    .map((artwork) => artwork.id)
    .sort();
  if (accumulating.join(",") !== ACCUMULATING.join(",")) {
    failures.push(`the roll of accumulating clips has changed: ${accumulating.join(", ")}`);
  }
  for (const artworkId of accumulating) {
    const { page, errors } = await open(browser, server.baseUrl, artworkId, "?capture=1&renderScale=1");
    const shot = (frame) => page.evaluate(async (index) => {
      await window.__renderFrame(index);
      return document.querySelector("canvas").toDataURL("image/png");
    }, frame);
    const opening = await shot(0);
    const early = await shot(12);
    const last = await shot(Math.round(manifest.artworks.find((a) => a.id === artworkId)
      .render.durationSeconds * manifest.defaults.fps) - 1);
    const advances = opening !== early && early !== last;
    note(`${artworkId.padEnd(26)} frames 0 < 12 < last all differ: ${advances ? "yes" : "NO"}`);
    if (!advances) {
      failures.push(`${artworkId} does not advance between its opening, an early frame and its last`);
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

#!/usr/bin/env node

/**
 * Does every artwork show in WebKit what it shows in Chromium?
 *
 * Nothing here had ever been opened in anything but Chromium, and on 2026-08-13 a reader
 * opened Strange Attractor on a phone and was shown an empty square. Its points were drawn
 * as subpaths whose two ends are the same point, which Chromium paints and WebKit does not —
 * and every browser on iOS is WebKit, so the whole of iOS saw a blank page. The sketch
 * reported three hundred of three hundred frames and three hundred and thirty-six thousand
 * of three hundred and thirty-six thousand points drawn, raised nothing and logged nothing.
 * Only the picture was missing. No check that reads state or counts frames could have seen
 * it, and none did.
 *
 * What is measured is ink: at full resolution, the share of pixels that are not the page's
 * own background. Two things about how that is taken matter more than the measure itself,
 * because both are ways a check like this goes blind and calls itself green.
 *
 * The pixels are read through a copy of the canvas rather than out of it. Six works are drawn
 * in WebGL and have no 2D context to ask; asking returns null, and a first attempt at this
 * check lost three of them to an exception. Drawing the canvas into a plain one gets at the
 * pixels whatever they were made with, and at one to one it samples nothing away — which a
 * resized copy would, taking the thin lines of Koch Curves and Pinwheel with it and reporting
 * two perfectly good works as empty.
 *
 * And each work is looked at over several moments rather than one. There is no single frame
 * that shows every work: Herringbone, Pinwheel and Eyes Pattern return to their beginnings
 * and are blank at the last frame, while Koch Curves has drawn almost nothing by the
 * thirtieth. A work that is never seen is therefore a failure of this check rather than a
 * pass, because an unseen work satisfies "the two engines agree" perfectly.
 */

import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { P5JS_DIRECTORY, loadCatalog } from "../lib/catalog.mjs";
import { startStaticServer } from "../lib/render.mjs";
import { buildSite } from "../lib/site.mjs";

/** How far from the background a pixel has to be before it counts as ink. */
const INK_THRESHOLD = 6;

/**
 * Where in a clip the two engines are compared, as fractions of its length.
 *
 * Several moments and not one, because there is no single frame that shows every work:
 * Herringbone, Pinwheel and Eyes Pattern return to their beginnings and are blank at the very
 * end, while Koch Curves has drawn almost nothing near the start. The moment a work shows most
 * of itself is the one that gets compared, since that is where a missing picture shows plainest
 * and a difference in antialiasing counts for least.
 *
 * Asked for by number rather than waited for. Both engines render frame 105 of the same work,
 * so the comparison is of one moment of one picture. Watching them animate instead compares
 * whatever each had reached when it was looked at, and they do not keep step — an earlier
 * version of this check did that, and works that were drawing perfectly well came out anywhere
 * from 0.97 to 1.35, near enough the edge of the band below to fail for no reason but a slow
 * machine. It also took seventeen minutes, where this takes one.
 */
const MOMENTS = [0.1, 0.35, 0.65, 0.99];

/**
 * And for a work that cannot be captured, the fallback: open it as a reader would and watch
 * until it has stopped showing anything new.
 *
 * One work needs this. An artwork may refuse to be captured on an engine that would draw it
 * differently — Strange Attractor does, so that no clip is ever exported from one — and a
 * check cannot ask a page that has refused to load. Watching is the weaker measurement, which
 * is why it is the exception rather than the rule.
 *
 * Settled means the picture stopped changing while the sketch behind it was demonstrably still
 * running. Those are two different things and they look identical from outside: a picture also
 * stops changing when its sketch has been starved of processor. That is not hypothetical —
 * watching eight works at once here slowed one enough that it was read half-drawn and reported
 * as a disagreement — and a build machine has fewer processors than this one.
 */
const PATIENCE_MS = 12_000;
const LOOK_EVERY_MS = 1000;
/** How many looks with nothing new before a work is taken to have settled. */
const SETTLED_AFTER = 3;
/** More ink than this since the last look counts as still going. */
const STILL_MOVING = 0.0005;

/**
 * How many works are handled at once. Enough to overlap the page loads, which is most of what
 * this now spends its time on; kept modest because engines competing for the processor animate
 * more slowly, and the one work being watched rather than captured would pay for that.
 */
const AT_A_TIME = 4;

/**
 * How little ink is too little to draw a conclusion from. A work that never shows more than
 * this in Chromium has not been seen, and saying nothing about it is the one answer this
 * check may not give.
 */
const INK_FLOOR = 0.002;

/**
 * How far the two engines may disagree about how much ink a work puts down.
 *
 * They never agree exactly, because they antialias differently. Measured across all
 * thirty-eight works at matched frames, the ratio sits between 0.939 and 1.095 — and the
 * spread is a property of the machine as much as of the works, since the same run on a
 * laptop comes in narrower, between 0.970 and 1.088. So the band below holds every sound
 * work several times over on either, and is still nowhere near the fault it was written
 * for: a work WebKit draws not at all sits at 0.
 */
const RATIO_AT_LEAST = 0.75;
const RATIO_AT_MOST = 1.4;

/** The point the offset dot is asked for, and how far it may land from it. */
const CENTRE_AT = 20;
const CENTRE_WITHIN = 0.01;

const failures = [];
const note = (line) => process.stdout.write(`${line}\n`);

/**
 * Ink, taken through a copy so that a canvas drawn with WebGL can be read at all, and at its
 * own size so that nothing thin is sampled away.
 */
const inkThrough = (threshold) => {
  const canvas = document.querySelector("canvas");
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ink = copy.getContext("2d");
  ink.drawImage(canvas, 0, 0);
  const { data } = ink.getImageData(0, 0, copy.width, copy.height);
  // The background is whatever colour the most pixels are, found by tally rather than
  // assumed: these works do not agree on one, and several change it as they go.
  //
  // Tallied from every sixteenth pixel rather than all of them. A background is by definition
  // the colour the most pixels are, so it survives being looked for in a sixteenth of them,
  // and looking in all of them means building a map of a few hundred thousand entries several
  // times a second for every work being watched.
  const tally = new Map();
  for (let at = 0; at < data.length; at += 64) {
    const key = (data[at] << 16) | (data[at + 1] << 8) | data[at + 2];
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let background = 0;
  let most = -1;
  for (const [key, count] of tally) {
    if (count > most) {
      most = count;
      background = key;
    }
  }
  const red = (background >> 16) & 255;
  const green = (background >> 8) & 255;
  const blue = background & 255;
  // Every fourth pixel of the full-size image, which is a different thing from every pixel of
  // a quarter-size image and the distinction is the whole reason this check exists. Shrinking
  // an image resamples it, and a line one pixel wide falls between the samples and disappears
  // -- which is how a first attempt at measuring this reported Koch Curves and Pinwheel, both
  // perfectly well drawn, as blank. Striding takes one pixel in four of the original grid, so
  // a thin line still crosses a quarter of the pixels it always crossed and is counted in
  // proportion. What it buys is the four-fold saving that lets several works be watched at
  // once without the engines starving each other of processor -- which they did, badly enough
  // that one work was read before it had finished drawing and reported as a disagreement.
  let marked = 0;
  let looked = 0;
  for (let at = 0; at < data.length; at += 16) {
    looked += 1;
    if (Math.abs(data[at] - red) > threshold
      || Math.abs(data[at + 1] - green) > threshold
      || Math.abs(data[at + 2] - blue) > threshold) {
      marked += 1;
    }
  }
  // The sketch's own count comes back with the reading, so that a picture which has stopped
  // changing can be told from a picture whose sketch has stopped being given time to draw.
  const state = window.__ARTWORK_STATE__ ?? {};
  const frame = state.frameIndex ?? 0;
  return {
    ink: marked / looked,
    frame,
    done: typeof state.totalFrames === "number" ? frame >= state.totalFrames : true
  };
};

/**
 * The same frames of the same work in both engines, taken through the capture mode the
 * exporter uses, which renders a numbered frame on demand instead of animating.
 *
 * This is how the two engines get compared at the same point of the same picture. Watching
 * them animate instead compares whatever each had reached when it was looked at, and they do
 * not keep step: an earlier version of this check did that and produced ratios spread from
 * 0.97 to 1.35 for works that were drawing perfectly well, close enough to the edge of the
 * band to fail for no reason at all on a slower machine. Asking for frame 105 twice is not
 * subject to that, and it does not have to wait for anything.
 *
 * Returns null when a page will not come up in capture mode. That is not a failure here: an
 * artwork may refuse to be captured on an engine that would draw it differently, precisely so
 * that no clip is ever exported from one, and such a work is watched instead.
 */
async function readMatchedFrames(browser, baseUrl, artwork) {
  const page = await browser.newPage({
    viewport: { width: artwork.canvas.width, height: artwork.canvas.height },
    deviceScaleFactor: 1
  });
  try {
    const url = new URL(`/${artwork.entry}`, baseUrl);
    url.searchParams.set("capture", "1");
    url.searchParams.set("renderScale", "1");
    await page.goto(url.href, { waitUntil: "load", timeout: 60_000 });
    await page.waitForFunction(() => window.__ARTWORK_READY__ === true, { timeout: 15_000 });
    const total = await page.evaluate(() => (typeof window.__renderFrame === "function"
      ? window.__ARTWORK_STATE__?.totalFrames ?? 0
      : null));
    if (!total) {
      return [{ frame: null, ink: (await page.evaluate(inkThrough, INK_THRESHOLD)).ink }];
    }
    const readings = [];
    for (const moment of MOMENTS) {
      const frame = Math.max(1, Math.round(total * moment));
      await page.evaluate((which) => window.__renderFrame(which), frame);
      readings.push({ frame, ink: (await page.evaluate(inkThrough, INK_THRESHOLD)).ink });
    }
    return readings;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

async function openArtwork(browser, baseUrl, artwork) {
  const page = await browser.newPage({
    viewport: { width: artwork.canvas.width, height: artwork.canvas.height },
    deviceScaleFactor: 1
  });
  await page.goto(new URL(`/${artwork.entry}`, baseUrl).href, {
    waitUntil: "load",
    timeout: 60_000
  });
  await page.waitForFunction(() => window.__ARTWORK_READY__ === true, { timeout: 60_000 });
  return page;
}

async function compareArtwork(engines, baseUrl, artwork) {
  const [framesInChromium, framesInWebkit] = await Promise.all([
    readMatchedFrames(engines.chromium, baseUrl, artwork),
    readMatchedFrames(engines.webkit, baseUrl, artwork)
  ]);
  if (framesInChromium && framesInWebkit) {
    // The moment the work shows most of itself, which is where a missing picture shows up
    // most plainly and where a difference in antialiasing counts for least.
    let best = 0;
    for (let at = 1; at < framesInChromium.length; at += 1) {
      if (framesInChromium[at].ink > framesInChromium[best].ink) {
        best = at;
      }
    }
    const chromiumInk = framesInChromium[best].ink;
    const webkitInk = framesInWebkit[best]?.ink ?? 0;
    return {
      artwork,
      how: `frame ${framesInChromium[best].frame ?? "-"}`,
      chromium: chromiumInk,
      webkit: webkitInk,
      ratio: chromiumInk === 0 ? 0 : webkitInk / chromiumInk
    };
  }
  return await watchArtwork(engines, baseUrl, artwork);
}

/**
 * For a work that will not be captured: both engines are opened the way a reader opens them
 * and watched until each has stopped showing anything new.
 */
async function watchArtwork(engines, baseUrl, artwork) {
  const [inChromium, inWebkit] = await Promise.all([
    openArtwork(engines.chromium, baseUrl, artwork),
    openArtwork(engines.webkit, baseUrl, artwork)
  ]);
  let chromiumInk = 0;
  let webkitInk = 0;
  let waited = 0;
  let quiet = 0;
  let wasAt = { chromium: -1, webkit: -1 };
  try {
    for (; waited <= PATIENCE_MS; waited += LOOK_EVERY_MS) {
      const [seenByChromium, seenByWebkit] = await Promise.all([
        inChromium.evaluate(inkThrough, INK_THRESHOLD),
        inWebkit.evaluate(inkThrough, INK_THRESHOLD)
      ]);
      const grew = Math.max(seenByChromium.ink - chromiumInk, seenByWebkit.ink - webkitInk);
      chromiumInk = Math.max(chromiumInk, seenByChromium.ink);
      webkitInk = Math.max(webkitInk, seenByWebkit.ink);
      // Settled means neither engine has found anything new for a while -- a question about
      // the pictures alone, which is what keeps this from being a stopping rule that peeks at
      // the verdict. A work still laying itself down is watched until it has finished.
      //
      // But a picture also stops changing when the sketch drawing it has been starved of
      // processor, and the two look identical from here. That is not hypothetical: watching
      // eight works at once on this machine slowed one of them enough that it was read
      // half-drawn and reported as a disagreement between the engines, and a build machine
      // has fewer processors than this one. So a still picture only counts as settled if the
      // sketch behind it is demonstrably still running, or has run to its own end.
      const moving = seenByChromium.frame > wasAt.chromium && seenByWebkit.frame > wasAt.webkit;
      const ended = seenByChromium.done && seenByWebkit.done;
      wasAt = { chromium: seenByChromium.frame, webkit: seenByWebkit.frame };
      quiet = grew > STILL_MOVING || !(moving || ended) ? 0 : quiet + 1;
      if (quiet >= SETTLED_AFTER) {
        break;
      }
      if (waited < PATIENCE_MS) {
        await inChromium.waitForTimeout(LOOK_EVERY_MS);
      }
    }
  } finally {
    await inChromium.close();
    await inWebkit.close();
  }
  return {
    artwork,
    how: `watched ${Math.min(waited, PATIENCE_MS)}ms`,
    chromium: chromiumInk,
    webkit: webkitInk,
    ratio: chromiumInk === 0 ? 0 : webkitInk / chromiumInk
  };
}

function judge(seen) {
  const { artwork } = seen;
  if (seen.chromium < INK_FLOOR) {
    return {
      ...seen,
      verdict: "UNSEEN",
      failure: `${artwork.id} never showed more than ${(100 * seen.chromium).toFixed(3)} per cent`
        + " ink in Chromium at any moment looked at, so this check did not see it at all and"
        + " has nothing to say about whether WebKit draws it"
    };
  }
  if (seen.ratio < RATIO_AT_LEAST || seen.ratio > RATIO_AT_MOST) {
    return {
      ...seen,
      verdict: "DIFFERS",
      failure: `${artwork.id} puts down ${(100 * seen.webkit).toFixed(2)} per cent ink in WebKit`
        + ` where Chromium puts down ${(100 * seen.chromium).toFixed(2)} (a ratio of`
        + ` ${seen.ratio.toFixed(3)}), so the two engines are not drawing the same picture`
    };
  }
  return { ...seen, verdict: "ok" };
}

const { manifest, quoteCatalog } = await loadCatalog();
const engines = { chromium: await chromium.launch(), webkit: await webkit.launch() };

try {
  const server = await startStaticServer();
  try {
    note(`${"artwork".padEnd(26)}${"how".padEnd(15)}${"chromium".padEnd(11)}${"webkit".padEnd(11)}ratio`);
    let measured = 0;
    const ratios = [];
    for (let from = 0; from < manifest.artworks.length; from += AT_A_TIME) {
      const batch = manifest.artworks.slice(from, from + AT_A_TIME);
      const judgements = await Promise.all(batch.map(
        async (artwork) => judge(await compareArtwork(engines, server.baseUrl, artwork))
      ));
      for (const judged of judgements) {
        measured += 1;
        if (judged.verdict === "ok") {
          ratios.push(judged.ratio);
        } else {
          failures.push(judged.failure);
        }
        note(
          `${judged.artwork.id.padEnd(26)}${judged.how.padEnd(15)}`
          + `${`${(100 * judged.chromium).toFixed(2)}%`.padStart(8)}   `
          + `${`${(100 * judged.webkit).toFixed(2)}%`.padStart(8)}   `
          + `${judged.ratio.toFixed(4)}${judged.verdict === "ok" ? "" : `  ${judged.verdict}`}`
        );
      }
    }
    // An empty sweep satisfies every assertion above, so the count is fixed to the catalogue.
    if (measured !== manifest.artworks.length) {
      failures.push(`${measured} of ${manifest.artworks.length} works were compared`);
    }
    if (ratios.length > 0) {
      note(
        `\n${ratios.length} works agree, ratios ${Math.min(...ratios).toFixed(3)}`
        + ` to ${Math.max(...ratios).toFixed(3)} (the band is ${RATIO_AT_LEAST} to ${RATIO_AT_MOST})`
      );
    }
  } finally {
    await server.close();
  }

  await controlTheFaultAsItShipped();
  await controlTheOffsetIsCentred();
} finally {
  for (const browser of Object.values(engines)) {
    await browser.close();
  }
}

/**
 * The check, aimed at the fault it was written for: Strange Attractor's sketch exactly as it
 * shipped, kept in the repository so that this runs where CI checks out a single commit.
 */
async function controlTheFaultAsItShipped() {
  const built = await mkdtemp(join(tmpdir(), "generative-art-engines-"));
  const server = await startStaticServer(built);
  try {
    await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });
    await cp(
      resolve(P5JS_DIRECTORY, "test/fixtures/invisible-in-webkit/sketch.js"),
      resolve(built, "p5js/artworks/strange-attractor/sketch.js")
    );
    const artwork = manifest.artworks.find((a) => a.id === "strange-attractor");
    const judged = judge(await compareArtwork(engines, server.baseUrl, artwork));
    note(
      `\n${"control (the fault as it shipped)".padEnd(40)}`
      + `chromium ${(100 * judged.chromium).toFixed(2)}%  webkit ${(100 * judged.webkit).toFixed(2)}%`
      + `  rejected: ${judged.verdict === "ok" ? "NO" : "yes"}`
    );
    if (judged.verdict === "ok") {
      failures.push(
        "Strange Attractor's sketch as it shipped — which drew nothing whatever on an iPhone —"
        + " passes this check, so the check cannot see the fault it was written for"
      );
    }
  } finally {
    await server.close();
    await rm(built, { recursive: true, force: true });
  }
}

/**
 * And the claim the repair rests on, measured rather than asserted: giving the dot a length
 * moves neither end of it away from the point the orbit chose. A dot drawn a twentieth of a
 * pixel to the right would be a different figure, arrived at quietly.
 */
async function controlTheOffsetIsCentred() {
  const page = await engines.webkit.newPage();
  try {
    const centre = await page.evaluate(({ at, half }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 40;
      const ink = canvas.getContext("2d");
      ink.fillStyle = "#000";
      ink.fillRect(0, 0, canvas.width, canvas.height);
      ink.lineCap = "round";
      ink.lineWidth = 0.72;
      ink.strokeStyle = "#fff";
      ink.beginPath();
      ink.moveTo(at - half, at);
      ink.lineTo(at + half, at);
      ink.stroke();
      const { data } = ink.getImageData(0, 0, canvas.width, canvas.height);
      let weight = 0;
      let across = 0;
      let down = 0;
      for (let index = 0; index < data.length; index += 4) {
        const value = data[index];
        if (value === 0) {
          continue;
        }
        const pixel = index / 4;
        across += (pixel % canvas.width) * value;
        down += Math.floor(pixel / canvas.width) * value;
        weight += value;
      }
      // A pixel's index names its top-left corner, so its middle is half a pixel further on.
      return { x: across / weight + 0.5, y: down / weight + 0.5, weight };
    }, { at: CENTRE_AT, half: 0.05 });
    const off = Math.max(Math.abs(centre.x - CENTRE_AT), Math.abs(centre.y - CENTRE_AT));
    note(
      `${"control (the offset dot is centred)".padEnd(40)}`
      + `asked (${CENTRE_AT}, ${CENTRE_AT}), landed (${centre.x.toFixed(4)}, ${centre.y.toFixed(4)})`
      + `  within ${off.toFixed(4)}px`
    );
    if (!(centre.weight > 0)) {
      failures.push("the offset dot left no ink at all, so nothing was measured about where it lands");
    } else if (off > CENTRE_WITHIN) {
      failures.push(
        `the offset dot lands ${off.toFixed(4)} pixels from where it was asked for, so giving`
        + " the dot a length has moved the figure rather than only made it visible"
      );
    }
  } finally {
    await page.close();
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`FAIL ${failure}\n`);
  }
  process.exitCode = 1;
} else {
  note("\nBoth engines draw the same thirty-eight pictures.");
}

#!/usr/bin/env node

/**
 * Opens the gallery the way a phone opens it.
 *
 * Every artwork is drawn at a size taken from a laptop, and the page cannot scroll, so a
 * screen narrower than the picture does not show a smaller picture: it shows the top-left
 * corner of the picture and nothing else. Measured before the fit was written, a reader on a
 * 390-pixel screen was seeing between 39 and 56 per cent of a work. Nothing in the unit
 * tests could see it — a layout is not a property of a file — and nothing on the machine
 * doing the writing could see it either, which is the whole difficulty.
 *
 * So this asks the questions that are only answerable at a real width and a real pixel
 * ratio, and it asks them of the built site rather than of the repository, because the size
 * a page is fitted to is added to it by the build.
 *
 * Three things are checked, and the third is the one that keeps the other two honest:
 *
 *   - On a phone, every artwork is wholly on screen, and its shape is the shape it was
 *     drawn at. A picture squashed to fit is not a picture that fits.
 *   - On a laptop, every artwork is exactly the size it has always been. This is the
 *     regression: the fault is on a phone, and a fix that moves a desktop is not a fix.
 *   - On a canvas that has been shrunk, the pointer still lands where the artwork thinks it
 *     does. Eighteen works answer to a pointer, and p5 maps one onto the element's own box:
 *     fitting the picture inside a box of the wrong shape would leave every one of them
 *     answering in the wrong place, and looking perfectly well while doing it.
 *
 * And the measure is made to fail on purpose before it is believed. The size is stripped
 * from a page, and then written back by halves, and the phone check must reject both — the
 * second because a rule that asks for two numbers and gets one must do nothing at all
 * rather than fall back to the element's natural size, which on a dense display is the
 * artwork at two or three times the size it was drawn.
 *
 * Then the gallery's own page, for the figure in its masthead. That was withheld from a
 * touch screen altogether, so a phone was shown a photograph that never moved; it is now
 * withheld only from a reader who has asked for no motion, or whose connection has said it
 * is metered. Both refusals are checked by the request rather than by the picture, since
 * nothing on screen would tell a reader that two and a half megabytes had been spent on a
 * decoration.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { loadCatalog } from "../lib/catalog.mjs";
import { artworkHref } from "../lib/gallery.mjs";
import { startStaticServer } from "../lib/render.mjs";
import { buildSite } from "../lib/site.mjs";

/** A phone held upright, under the browser's own furniture, on a dense screen. */
const PHONE = {
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true
};

/** The screen the artworks were drawn for, at the density that hides a sizing mistake. */
const LAPTOP = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2
};

/** Small enough to force the fit, wide enough to aim at. Used for the pointer check only. */
const PINCHED = { width: 500, height: 400 };

/**
 * The work the pointer is measured on: its whole subject is the position of a point, and it
 * publishes that point in the coordinates the sketch is written in, so no guess has to be
 * made about what the artwork believes. Pinned by name, since a check that quietly measures
 * nothing is a check that quietly passes.
 */
const POINTER_ARTWORK = "atan2";

/** Half a pixel of slack: a box fitted to a viewport lands on fractions of one. */
const SLACK = 0.5;

/** The head in the masthead: what is fetched for it, and what it becomes once it arrives. */
const MODEL_FILE = "head.glb";
const MODEL_CANVAS = "canvas.character__model";
/** Long enough for a model and a renderer to be fetched from a server on this machine. */
const MODEL_WITHIN = 30_000;
/** The head holds a direction for 2.6 seconds; this is room for one change and a little. */
const DRIFT_EVERY = 2600;
const DRIFT_WITHIN = 8000;
/**
 * How long a refusal is watched before it is believed. Proving that a request was not made
 * means waiting for the moment it would have been made and finding nothing: the fetch is
 * deferred until the page has loaded, and the page here is served from this machine.
 */
const REFUSAL_GRACE = 2500;

const measureCanvas = () => {
  const canvas = document.querySelector("canvas");
  const box = canvas.getBoundingClientRect();
  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    backing: { width: canvas.width, height: canvas.height },
    ratio: window.devicePixelRatio,
    viewport: { width: window.innerWidth, height: window.innerHeight }
  };
};

/** How much of the picture is on screen at all, which is what a reader actually loses. */
function visibleShare({ left, top, width, height, viewport }) {
  const across = Math.max(0, Math.min(left + width, viewport.width) - Math.max(left, 0));
  const down = Math.max(0, Math.min(top + height, viewport.height) - Math.max(top, 0));
  return Math.round((100 * (across * down)) / (width * height));
}

function isWhollyOnScreen({ left, top, width, height, viewport }) {
  return left >= -SLACK
    && top >= -SLACK
    && left + width <= viewport.width + SLACK
    && top + height <= viewport.height + SLACK;
}

function keepsItsShape(measured, canvas) {
  return Math.abs(measured.width / measured.height - canvas.width / canvas.height) < 0.01;
}

const failures = [];
const note = (line) => process.stdout.write(`${line}\n`);

const { manifest, quoteCatalog } = await loadCatalog();

// The built site, not the repository: a page in the repository has not been told its size.
// Built into a directory of its own rather than into `site/`, so running this never stands
// in for a build somebody else is about to make, or is standing on.
const built = await mkdtemp(join(tmpdir(), "generative-art-phone-"));
const server = await startStaticServer(built);
const browser = await chromium.launch();
try {
  await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });

  const phone = await browser.newContext(PHONE);
  const laptop = await browser.newContext(LAPTOP);
  const onPhone = await phone.newPage();
  const onLaptop = await laptop.newPage();

  const pageOf = (artwork) => `${server.baseUrl}/${artworkHref(artwork)}index.html`;
  const show = async (page, url) => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 60_000 });
    return await page.evaluate(measureCanvas);
  };

  // The emulation is the instrument, so it is read off a real page before it is used. Read
  // off a blank one it would say 980 pixels: a browser emulating a phone lays a page out at
  // a desktop width until the page says it is willing to be laid out at the device's own,
  // which is exactly the declaration these pages make and exactly the one that could go
  // missing. That is why the width is then checked again for every artwork below rather than
  // once here -- a page without it would be measured against a 980-pixel screen, and a work
  // that overflowed a phone would be found to fit.
  await onPhone.goto(pageOf(manifest.artworks[0]), { waitUntil: "domcontentloaded" });
  const emulated = await onPhone.evaluate(() => ({
    coarse: window.matchMedia("(pointer: coarse)").matches,
    hoverless: window.matchMedia("(hover: none)").matches,
    ratio: window.devicePixelRatio,
    width: window.innerWidth
  }));
  if (!emulated.coarse || !emulated.hoverless || emulated.ratio !== PHONE.deviceScaleFactor) {
    failures.push(`the phone context is not a phone: ${JSON.stringify(emulated)}`);
  }
  note(
    `phone ${emulated.width} at ${emulated.ratio}x, pointer coarse: ${emulated.coarse},`
    + ` hover: ${emulated.hoverless ? "none" : "yes"}\n`
  );

  for (const artwork of manifest.artworks) {
    const url = pageOf(artwork);
    const small = await show(onPhone, url);
    const large = await show(onLaptop, url);
    const share = visibleShare(small);
    const unchanged = Math.round(large.width) === artwork.canvas.width
      && Math.round(large.height) === artwork.canvas.height;

    note(
      `${artwork.id.padEnd(26)} drawn ${`${artwork.canvas.width}x${artwork.canvas.height}`.padEnd(9)}`
      + ` phone ${`${Math.round(small.width)}x${Math.round(small.height)}`.padEnd(9)} ${`${share}%`.padStart(4)} on screen`
      + `   laptop ${`${Math.round(large.width)}x${Math.round(large.height)}`.padEnd(9)} as drawn: ${unchanged ? "yes" : "NO"}`
    );

    if (small.viewport.width !== PHONE.viewport.width) {
      failures.push(
        `${artwork.id} is laid out ${small.viewport.width} pixels wide on a ${PHONE.viewport.width}-pixel`
        + " screen, so it does not ask to be laid out at the width of the device it is on"
      );
    }
    if (!isWhollyOnScreen(small)) {
      failures.push(
        `${artwork.id} is cut off on a phone: ${Math.round(small.width)} by ${Math.round(small.height)}`
        + ` in ${small.viewport.width} by ${small.viewport.height}, ${share} per cent of it on screen`
      );
    }
    if (!keepsItsShape(small, artwork.canvas)) {
      failures.push(
        `${artwork.id} is fitted to a phone by being reshaped:`
        + ` ${Math.round(small.width)} by ${Math.round(small.height)}`
        + ` where it is drawn ${artwork.canvas.width} by ${artwork.canvas.height}`
      );
    }
    if (!unchanged) {
      failures.push(
        `${artwork.id} is no longer ${artwork.canvas.width} by ${artwork.canvas.height} on a laptop,`
        + ` but ${Math.round(large.width)} by ${Math.round(large.height)}`
      );
    }
    // The sketch's own idea of its size, read back through the backing store. If this and
    // the manifest disagree, the shape the stylesheet is holding is not the shape being
    // drawn, and the picture is stretched however well it fits.
    for (const [axis, drawn] of [["width", artwork.canvas.width], ["height", artwork.canvas.height]]) {
      if (Math.round(small.backing[axis] / small.ratio) !== drawn) {
        failures.push(
          `${artwork.id} draws ${small.backing[axis] / small.ratio} ${axis} where the manifest says ${drawn}`
        );
      }
    }
  }

  // A shrunk canvas, and a pointer put on a known part of the picture. p5 maps the pointer
  // through the element's own box -- the box, not what is painted in it -- so this is the
  // measurement that says the eighteen artworks answering to a pointer still answer where
  // they are asked. It is taken with a fine pointer at a width narrow enough to force the
  // fit, because what is under test is the shrinking, not the finger.
  const pointerArtwork = manifest.artworks.find((artwork) => artwork.id === POINTER_ARTWORK);
  if (!pointerArtwork) {
    failures.push(`${POINTER_ARTWORK} is not in the manifest, so the pointer is measured on nothing`);
  } else {
    await onLaptop.setViewportSize(PINCHED);
    const box = await show(onLaptop, pageOf(pointerArtwork));
    const shrunk = box.width < pointerArtwork.canvas.width;
    const probeAt = async (acrossShare, downShare) => {
      // The artwork is already publishing a point before the pointer is anywhere near it --
      // it orbits one on its own until asked -- so a reading taken straight after the move
      // can be the resting point rather than the answer. Waiting for the frame count to
      // advance past the move is what makes it an answer.
      const before = await onLaptop.evaluate(() => window.__ARTWORK_STATE__.frameIndex);
      await onLaptop.mouse.move(
        box.left + box.width * acrossShare,
        box.top + box.height * downShare
      );
      await onLaptop.waitForFunction(
        (mark) => window.__ARTWORK_STATE__.frameIndex > mark + 1,
        before,
        { timeout: 30_000 }
      );
      // The artwork publishes the point in its own coordinates, measured from the middle of
      // the canvas, so the expected answer is arithmetic on the manifest's size and not on
      // anything the page reports about itself.
      return await onLaptop.evaluate(() => window.__ARTWORK_STATE__.probe);
    };
    const centre = await probeAt(0.5, 0.5);
    const quarter = await probeAt(0.25, 0.75);
    const expected = {
      x: pointerArtwork.canvas.width * -0.25,
      y: pointerArtwork.canvas.height * 0.25
    };
    const off = Math.max(
      Math.abs(centre.x),
      Math.abs(centre.y),
      Math.abs(quarter.x - expected.x),
      Math.abs(quarter.y - expected.y)
    );
    note(
      `\n${POINTER_ARTWORK.padEnd(26)} shrunk to ${Math.round(box.width)}x${Math.round(box.height)}`
      + `   pointer lands within ${off.toFixed(1)}px of where the artwork is asked`
    );
    if (!shrunk) {
      failures.push(
        `${POINTER_ARTWORK} was not shrunk at ${PINCHED.width} by ${PINCHED.height},`
        + " so the pointer was measured on a canvas at its own size"
      );
    }
    if (off > 2) {
      failures.push(
        `${POINTER_ARTWORK} puts the pointer ${off.toFixed(1)}px from where it was aimed on a shrunk canvas:`
        + ` centre read (${centre.x.toFixed(1)}, ${centre.y.toFixed(1)}), quarter read`
        + ` (${quarter.x.toFixed(1)}, ${quarter.y.toFixed(1)}) against (${expected.x}, ${expected.y})`
      );
    }
  }

  // The measure, made to fail. Both halves of the size are taken away and then given back
  // one at a time: the second is the one that matters, since a rule that took one number and
  // guessed the other would size the canvas from its backing store and show the artwork at
  // three times the size on this very screen.
  const control = manifest.artworks[0];
  const controlPage = resolve(built, artworkHref(control), "index.html");
  const original = await readFile(controlPage, "utf8");
  const sized = `<main id="artwork" style="--art-w: ${control.canvas.width}; --art-h: ${control.canvas.height}">`;
  if (!original.includes(sized)) {
    failures.push(`${control.id} was not built with a size to take away, so nothing was controlled`);
  }
  for (const [what, replacement] of [
    ["no size at all", '<main id="artwork">'],
    ["only half of it", `<main id="artwork" style="--art-w: ${control.canvas.width}">`]
  ]) {
    await writeFile(controlPage, original.replace(sized, replacement), "utf8");
    const measured = await show(onPhone, pageOf(control));
    const caught = !isWhollyOnScreen(measured);
    note(
      `${`control (${what})`.padEnd(26)} phone`
      + ` ${`${Math.round(measured.width)}x${Math.round(measured.height)}`.padEnd(9)}`
      + ` ${`${visibleShare(measured)}%`.padStart(4)} on screen   rejected: ${caught ? "yes" : "NO"}`
    );
    if (!caught) {
      failures.push(
        `a page given ${what} still passes: ${control.id} measured`
        + ` ${Math.round(measured.width)} by ${Math.round(measured.height)} and was accepted`
      );
    }
  }

  // And the reason the rule is guarded at all, measured rather than asserted. The page is
  // left with no numbers on it, and then given the two declarations a rule that had lost its
  // guard would still apply -- there being nothing left for the shape and the ceiling to be
  // computed from. The artwork comes back at the size of its backing store: twice what it is
  // drawn at on this laptop, and three times on the phone above. This is the fault the guard
  // exists for, and it is the one that would not be noticed, because it looks like an
  // artwork rather than like a mistake.
  await writeFile(controlPage, original.replace(sized, '<main id="artwork">'), "utf8");
  await onLaptop.setViewportSize(LAPTOP.viewport);
  await show(onLaptop, pageOf(control));
  await onLaptop.addStyleTag({ content: "canvas { width: auto !important; height: auto !important }" });
  const natural = await onLaptop.evaluate(measureCanvas);
  const fromTheBackingStore = Math.round(natural.width) === control.canvas.width * LAPTOP.deviceScaleFactor;
  note(
    `${"control (rule unguarded)".padEnd(26)} laptop`
    + ` ${`${Math.round(natural.width)}x${Math.round(natural.height)}`.padEnd(9)}`
    + ` drawn at ${control.canvas.width}, shown from the backing store:`
    + ` ${fromTheBackingStore ? "yes" : "NO"}`
  );
  if (!fromTheBackingStore) {
    failures.push(
      `a canvas left to its natural size no longer comes out at its backing store:`
      + ` ${control.id} measured ${Math.round(natural.width)} where`
      + ` ${control.canvas.width * LAPTOP.deviceScaleFactor} was expected. The rule in shared.css is`
      + ` guarded on account of this; if it has stopped being true, the comment there is now wrong`
    );
  }

  await writeFile(controlPage, original, "utf8");

  // The figure in the masthead. It used to be withheld from a touch screen entirely -- both
  // the model and the turning of the drawing were behind one test for a fine pointer -- so a
  // phone was shown a photograph that never moved. The pointer now gates only the following
  // of a pointer, which is the part a touch screen genuinely cannot do, and the wandering
  // that a still mouse already fell back to is what a phone gets from the start.
  //
  // Both refusals are checked as well as the arrival, and by the request rather than by the
  // picture: a reader who has asked for no motion, and a reader whose connection has said it
  // is metered, must not be sent two and a half megabytes of model and renderer for a
  // decoration. Nothing on screen would tell them it had been.
  const gallery = `${server.baseUrl}/index.html`;
  const lookOf = (page) => page.evaluate(
    () => document.querySelector("[data-character]").style.getPropertyValue("--look-x")
  );
  const openGallery = async (context, prepare) => {
    const page = await context.newPage();
    const askedFor = [];
    page.on("request", (request) => {
      if (request.url().includes(MODEL_FILE)) {
        askedFor.push(request.url());
      }
    });
    if (prepare) {
      await prepare(page);
    }
    await page.goto(gallery, { waitUntil: "load" });
    return { page, askedFor };
  };
  const modelArrived = async (page) => {
    try {
      await page.waitForSelector(`.character--model ${MODEL_CANVAS}`, { timeout: MODEL_WITHIN });
      return true;
    } catch {
      return false;
    }
  };

  const touched = await openGallery(phone);
  const arrivedOnPhone = await modelArrived(touched.page);
  const firstLook = await lookOf(touched.page);
  let secondLook = firstLook;
  try {
    await touched.page.waitForFunction(
      (was) => document.querySelector("[data-character]").style.getPropertyValue("--look-x") !== was,
      firstLook,
      { timeout: DRIFT_WITHIN }
    );
    secondLook = await lookOf(touched.page);
  } catch { /* left equal to the first, and reported as such below */ }
  note(
    `\n${"masthead on a phone".padEnd(26)} model: ${arrivedOnPhone ? "yes" : "NO"}`
    + `   asked for the model ${touched.askedFor.length} time(s)`
    + `   look: ${firstLook || "never written"} then ${secondLook || "never written"}`
  );
  if (!arrivedOnPhone) {
    failures.push("a phone is shown no model, which is what it was shown before any of this");
  }
  if (firstLook === "") {
    failures.push("nothing turns the head on a phone, so the model would face front for ever");
  }
  if (secondLook === firstLook) {
    failures.push(
      `the head on a phone holds one direction: it read ${firstLook || "nothing"} throughout`
      + ` ${DRIFT_WITHIN / 1000} seconds, where it should wander every ${DRIFT_EVERY / 1000}`
    );
  }
  await touched.page.close();

  const stilled = await openGallery(phone, (page) => page.emulateMedia({ reducedMotion: "reduce" }));
  await stilled.page.waitForTimeout(REFUSAL_GRACE);
  const stillModel = await stilled.page.$(MODEL_CANVAS);
  const stillLook = await lookOf(stilled.page);
  note(
    `${"asked for no motion".padEnd(26)} model: ${stillModel ? "YES" : "no"}`
    + `   asked for the model ${stilled.askedFor.length} time(s)`
    + `   look: ${stillLook || "never written"}`
  );
  if (stillModel || stilled.askedFor.length > 0 || stillLook !== "") {
    failures.push(
      "a reader who asked for no motion is sent the model anyway"
      + ` (${stilled.askedFor.length} request(s), canvas: ${Boolean(stillModel)}, look: ${stillLook || "none"})`
    );
  }
  await stilled.page.close();

  const metered = await openGallery(phone, (page) => page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: true })
    });
  }));
  await metered.page.waitForTimeout(REFUSAL_GRACE);
  const meteredModel = await metered.page.$(MODEL_CANVAS);
  const meteredLook = await lookOf(metered.page);
  note(
    `${"on a metered connection".padEnd(26)} model: ${meteredModel ? "YES" : "no"}`
    + `   asked for the model ${metered.askedFor.length} time(s)`
    + `   look: ${meteredLook || "never written"}`
  );
  if (meteredModel || metered.askedFor.length > 0) {
    failures.push(
      `a connection that has said it is metered is sent the model anyway:`
      + ` ${metered.askedFor.length} request(s)`
    );
  }
  // The drawing is not part of what was refused: it is already on the page and costs
  // nothing, and refusing the download is meant to leave a head that still moves.
  if (meteredLook === "") {
    failures.push("refusing the model on a metered connection also stopped the drawing turning");
  }
  await metered.page.close();

  const laptopMasthead = await openGallery(laptop);
  const arrivedOnLaptop = await modelArrived(laptopMasthead.page);
  const laptopLook = await lookOf(laptopMasthead.page);
  note(
    `${"masthead on a laptop".padEnd(26)} model: ${arrivedOnLaptop ? "yes" : "NO"}`
    + `   asked for the model ${laptopMasthead.askedFor.length} time(s)`
    + `   look before the pointer moves: ${laptopLook || "never written"}`
  );
  if (!arrivedOnLaptop) {
    failures.push("a laptop is no longer shown the model, which it was shown before any of this");
  }
  // And it waits for the pointer rather than wandering at it: the two branches are supposed
  // to differ in exactly this, and a laptop that started wandering would mean the fine
  // pointer had stopped being asked about at all.
  if (laptopLook !== "") {
    failures.push(
      `a laptop starts turning the head before the pointer has moved (${laptopLook}),`
      + " so it is no longer waiting for one"
    );
  }
  await laptopMasthead.page.close();
} finally {
  await browser.close();
  await server.close();
  await rm(built, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`FAIL ${failure}\n`);
  }
  process.exitCode = 1;
} else {
  note("\nAll clear on a phone.");
}

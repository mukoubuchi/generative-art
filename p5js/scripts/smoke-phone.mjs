#!/usr/bin/env node

/**
 * Opens the gallery the way a phone opens it — either the site this repository builds, or
 * the site a reader actually gets.
 *
 * Every artwork is drawn at a size taken from a laptop, and the page cannot scroll, so a
 * screen narrower than the picture does not show a smaller picture: it shows the top-left
 * corner of the picture and nothing else. Measured before the fit was written, a reader on a
 * 390-pixel screen was seeing between 39 and 56 per cent of a work. Nothing in the unit
 * tests could see it — a layout is not a property of a file — and nothing on the machine
 * doing the writing could see it either, which is the whole difficulty.
 *
 * Without `--base` this builds a site of its own, serves it, and measures that. With
 * `--base <origin> --sha <commit>` it measures what is being served at that origin, after
 * waiting for the commit's own marker to appear on each page. The assertions are the same
 * ones in both cases, imported rather than repeated, because a published check written
 * separately would agree with this one on the day it was written and drift afterwards — two
 * greens that quietly stop meaning the same thing.
 *
 * The local run carries every negative control, including the controls for the published
 * assertions. It has to: the published check only runs when somebody deploys, so a fault in
 * it would sit undiscovered until the next deployment, and a check nobody checks is the
 * thing this whole exercise is a repair for. Since published mode simply measures an origin,
 * a site built from a frozen copy of the fault and served locally is a site it can be aimed
 * at, and the aiming is done on every push.
 */

import { mkdtemp, readFile, rm, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { P5JS_DIRECTORY, loadCatalog } from "../lib/catalog.mjs";
import { artworkHref } from "../lib/gallery.mjs";
import {
  MODEL_CANVAS,
  MODEL_FILE,
  checkArtworksFit,
  checkMasthead,
  isWhollyOnScreen,
  pageOf,
  visibleShare
} from "../lib/phone-check.mjs";
import { PROPAGATION_LIMIT_SECONDS, waitForBuild } from "../lib/published.mjs";
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

/** Where the frozen copies of the two faults are kept, and what each of them was. */
const SPECIMENS = resolve(P5JS_DIRECTORY, "test/fixtures");

/**
 * The controls do not need a sweep, only a reading, so they are aimed at one work and the
 * catalogue they are given says one work — otherwise the count assertion would fire for the
 * wrong reason and prove nothing about the assertion under test.
 */
const oneWork = (manifest) => ({ ...manifest, artworks: manifest.artworks.slice(0, 1) });

/**
 * Long enough for a model to arrive from this machine, short enough that a control which is
 * meant to find none does not spend three quarters of a minute finding none. Only the
 * controls use it: what the real check waits is the full window, since there a slow arrival
 * and no arrival are genuinely different answers.
 */
const CONTROL_MODEL_WITHIN = 10_000;

const failures = [];
const note = (line) => process.stdout.write(`${line}\n`);
const valueOf = (flag) => {
  const found = process.argv.indexOf(flag);
  return found === -1 ? null : process.argv[found + 1] ?? null;
};

const base = valueOf("--base");
const expectedBuild = valueOf("--sha");
const { manifest, quoteCatalog } = await loadCatalog();
const browser = await chromium.launch();

try {
  if (base) {
    await checkPublished();
  } else {
    await checkLocalBuild();
  }
} finally {
  await browser.close();
}

/**
 * What is being served, after establishing that it is the deployment under test.
 *
 * The waiting is not politeness. Finishing a deployment is not the same event as a reader
 * getting it: the site is answered by a content network that declares `max-age=600`, so for
 * ten minutes an edge may go on serving what it already has. A check that started measuring
 * the moment the deployment step went green could measure the previous deployment, find it
 * correct, and report that this one is — which is precisely the failure that put a broken
 * page in front of a reader for six hours while every push was green.
 */
async function checkPublished() {
  if (!expectedBuild) {
    failures.push("--base was given without --sha, so there is nothing to identify the deployment by");
    return;
  }
  const origin = base.replace(/\/$/u, "");
  note(`Waiting for ${origin} to be serving ${expectedBuild}\n`);
  const arrival = await waitForBuild({
    url: `${origin}/index.html`,
    commit: expectedBuild,
    note
  });
  note(
    `\n${arrival.matched ? "Serving" : "STILL NOT SERVING"} ${expectedBuild.slice(0, 12)}`
    + ` after ${arrival.waited}s (limit ${PROPAGATION_LIMIT_SECONDS}s, cache max-age ${arrival.maxAge})\n`
  );
  // A limit derived from a policy stops meaning anything if the policy changes underneath it.
  if (arrival.maxAge !== null && arrival.maxAge > PROPAGATION_LIMIT_SECONDS) {
    failures.push(
      `the site may now be cached for ${arrival.maxAge}s, longer than the ${PROPAGATION_LIMIT_SECONDS}s`
      + " this check is willing to wait, so the limit no longer follows from the cache policy"
      + " it was taken from and PROPAGATION_LIMIT_SECONDS needs revisiting"
    );
  }
  if (!arrival.matched) {
    // Deliberately not "waited, saw nothing, measured nothing, passed". Measuring the wrong
    // copy is indistinguishable from success, so not knowing which copy this is has to be a
    // failure rather than a reason to skip.
    failures.push(
      `${origin} was still not serving ${expectedBuild} after ${arrival.waited}s.`
      + ` It answered with: ${[...new Set(arrival.saw)].join(", ")}.`
      + " Nothing was measured, because a page that cannot be identified could be any age"
    );
    return;
  }

  const phone = await browser.newContext(PHONE);
  const onPhone = await phone.newPage();
  failures.push(...await checkArtworksFit({
    phone: onPhone,
    origin,
    manifest,
    expectedBuild,
    viewport: PHONE.viewport,
    note
  }));
  note("");
  failures.push(...await checkMasthead({ phone, origin, note }));
}

/** The site this repository builds, with every control the published run cannot carry. */
async function checkLocalBuild() {
  const built = await mkdtemp(join(tmpdir(), "generative-art-phone-"));
  const server = await startStaticServer(built);
  try {
    await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });

    const phone = await browser.newContext(PHONE);
    const laptop = await browser.newContext(LAPTOP);
    const onPhone = await phone.newPage();
    const onLaptop = await laptop.newPage();
    const origin = server.baseUrl;

    const emulated = await readTheInstrument(onPhone, origin);
    note(
      `phone ${emulated.width} at ${emulated.ratio}x, pointer coarse: ${emulated.coarse},`
      + ` hover: ${emulated.hoverless ? "none" : "yes"}\n`
    );

    failures.push(...await checkArtworksFit({
      phone: onPhone,
      laptop: onLaptop,
      origin,
      manifest,
      viewport: PHONE.viewport,
      note
    }));

    await checkPointerOnShrunkCanvas(onLaptop, origin);
    await checkTheFitIsWhatFits(onPhone, onLaptop, built, origin);

    note("");
    failures.push(...await checkMasthead({ phone, origin, note }));
    await checkMeteredAndLaptop(phone, laptop, origin);
  } finally {
    await server.close();
    await rm(built, { recursive: true, force: true });
  }

  note("\n— the published assertions, aimed at the faults they were written for —\n");
  await controlPublishedFit();
  await controlPublishedMasthead();
  await controlBuildMarker();
}

/**
 * The emulation is the instrument, so it is read off a real page before it is used. Read off
 * a blank one it would say 980 pixels: a browser emulating a phone lays a page out at a
 * desktop width until the page says it is willing to be laid out at the device's own.
 */
async function readTheInstrument(onPhone, origin) {
  await onPhone.goto(pageOf(origin, manifest.artworks[0]), { waitUntil: "domcontentloaded" });
  const emulated = await onPhone.evaluate(() => ({
    coarse: window.matchMedia("(pointer: coarse)").matches,
    hoverless: window.matchMedia("(hover: none)").matches,
    ratio: window.devicePixelRatio,
    width: window.innerWidth
  }));
  if (!emulated.coarse || !emulated.hoverless || emulated.ratio !== PHONE.deviceScaleFactor) {
    failures.push(`the phone context is not a phone: ${JSON.stringify(emulated)}`);
  }
  return emulated;
}

/**
 * A shrunk canvas, and a pointer put on a known part of the picture. p5 maps the pointer
 * through the element's own box — the box, not what is painted in it — so this is the
 * measurement that says the eighteen artworks answering to a pointer still answer where they
 * are asked. Local only: it needs a viewport narrow enough to force the fit and a fine
 * pointer, neither of which is a thing a published site can be asked to provide.
 */
async function checkPointerOnShrunkCanvas(onLaptop, origin) {
  const pointerArtwork = manifest.artworks.find((artwork) => artwork.id === POINTER_ARTWORK);
  if (!pointerArtwork) {
    failures.push(`${POINTER_ARTWORK} is not in the manifest, so the pointer is measured on nothing`);
    return;
  }
  await onLaptop.setViewportSize(PINCHED);
  await onLaptop.goto(pageOf(origin, pointerArtwork), { waitUntil: "domcontentloaded" });
  await onLaptop.waitForSelector("canvas", { timeout: 60_000 });
  const box = await onLaptop.evaluate(() => {
    const { left, top, width, height } = document.querySelector("canvas").getBoundingClientRect();
    return { left, top, width, height };
  });
  const shrunk = box.width < pointerArtwork.canvas.width;
  const probeAt = async (acrossShare, downShare) => {
    // The artwork is already publishing a point before the pointer is anywhere near it — it
    // orbits one on its own until asked — so a reading taken straight after the move can be
    // the resting point rather than the answer. Waiting for the frame count to advance past
    // the move is what makes it an answer.
    const before = await onLaptop.evaluate(() => window.__ARTWORK_STATE__.frameIndex);
    await onLaptop.mouse.move(box.left + box.width * acrossShare, box.top + box.height * downShare);
    await onLaptop.waitForFunction(
      (mark) => window.__ARTWORK_STATE__.frameIndex > mark + 1,
      before,
      { timeout: 30_000 }
    );
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

/**
 * The measure, made to fail. Both halves of the size are taken away and then given back one
 * at a time: the second is the one that matters, since a rule that took one number and
 * guessed the other would size the canvas from its backing store and show the artwork at
 * three times the size on this very screen.
 */
async function checkTheFitIsWhatFits(onPhone, onLaptop, built, origin) {
  const control = manifest.artworks[0];
  const controlPage = resolve(built, artworkHref(control), "index.html");
  const original = await readFile(controlPage, "utf8");
  const sized = `<main id="artwork" style="--art-w: ${control.canvas.width}; --art-h: ${control.canvas.height}">`;
  if (!original.includes(sized)) {
    failures.push(`${control.id} was not built with a size to take away, so nothing was controlled`);
    return;
  }
  const measure = async () => {
    await onPhone.goto(pageOf(origin, control), { waitUntil: "domcontentloaded" });
    await onPhone.waitForSelector("canvas", { timeout: 60_000 });
    return await onPhone.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const box = canvas.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    });
  };
  for (const [what, replacement] of [
    ["no size at all", '<main id="artwork">'],
    ["only half of it", `<main id="artwork" style="--art-w: ${control.canvas.width}">`]
  ]) {
    await writeFile(controlPage, original.replace(sized, replacement), "utf8");
    const measured = await measure();
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
  // guard would still apply — there being nothing left for the shape and the ceiling to be
  // computed from. The artwork comes back at the size of its backing store: twice what it is
  // drawn at on this laptop, and three times on the phone above. This is the fault the guard
  // exists for, and it is the one that would not be noticed, because it looks like an artwork
  // rather than like a mistake.
  await writeFile(controlPage, original.replace(sized, '<main id="artwork">'), "utf8");
  await onLaptop.setViewportSize(LAPTOP.viewport);
  await onLaptop.goto(pageOf(origin, control), { waitUntil: "domcontentloaded" });
  await onLaptop.waitForSelector("canvas", { timeout: 60_000 });
  await onLaptop.addStyleTag({ content: "canvas { width: auto !important; height: auto !important }" });
  const natural = await onLaptop.evaluate(() => {
    const box = document.querySelector("canvas").getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  const fromTheBackingStore = Math.round(natural.width) === control.canvas.width * LAPTOP.deviceScaleFactor;
  note(
    `${"control (rule unguarded)".padEnd(26)} laptop`
    + ` ${`${Math.round(natural.width)}x${Math.round(natural.height)}`.padEnd(9)}`
    + ` drawn at ${control.canvas.width}, shown from the backing store:`
    + ` ${fromTheBackingStore ? "yes" : "NO"}`
  );
  if (!fromTheBackingStore) {
    failures.push(
      "a canvas left to its natural size no longer comes out at its backing store:"
      + ` ${control.id} measured ${Math.round(natural.width)} where`
      + ` ${control.canvas.width * LAPTOP.deviceScaleFactor} was expected. The rule in shared.css is`
      + " guarded on account of this; if it has stopped being true, the comment there is now wrong"
    );
  }
  await writeFile(controlPage, original, "utf8");
}

/**
 * The two masthead cases the published run does not make: a connection that has said it is
 * metered, and a laptop still following its pointer.
 */
async function checkMeteredAndLaptop(phone, laptop, origin) {
  const gallery = `${origin}/index.html`;
  const lookOf = (page) => page.evaluate(
    () => document.querySelector("[data-character]").style.getPropertyValue("--look-x")
  );

  const meteredPage = await phone.newPage();
  const meteredAsked = [];
  meteredPage.on("request", (request) => {
    if (request.url().includes(MODEL_FILE)) {
      meteredAsked.push(request.url());
    }
  });
  await meteredPage.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({ saveData: true })
    });
  });
  await meteredPage.goto(gallery, { waitUntil: "load" });
  await meteredPage.waitForTimeout(2500);
  const meteredModel = await meteredPage.$(MODEL_CANVAS);
  const meteredLook = await lookOf(meteredPage);
  note(
    `${"on a metered connection".padEnd(26)} model: ${meteredModel ? "YES" : "no"}`
    + `   asked for the model ${meteredAsked.length} time(s)`
    + `   look: ${meteredLook || "never written"}`
  );
  if (meteredModel || meteredAsked.length > 0) {
    failures.push(
      "a connection that has said it is metered is sent the model anyway:"
      + ` ${meteredAsked.length} request(s)`
    );
  }
  // The drawing is not part of what was refused: it is already on the page and costs nothing,
  // and refusing the download is meant to leave a head that still moves.
  if (meteredLook === "") {
    failures.push("refusing the model on a metered connection also stopped the drawing turning");
  }
  await meteredPage.close();

  const onLaptop = await laptop.newPage();
  await onLaptop.goto(gallery, { waitUntil: "load" });
  let arrivedOnLaptop = false;
  try {
    await onLaptop.waitForSelector(`.character--model ${MODEL_CANVAS}`, { timeout: 30_000 });
    arrivedOnLaptop = true;
  } catch { /* reported below */ }
  const box = await onLaptop.evaluate(() => {
    const { left, top, width, height } = document.querySelector("[data-character]").getBoundingClientRect();
    return { left, top, width, height };
  });
  // Measured by moving the pointer and watching the head turn towards it, rather than by
  // finding the page untouched before it moves. That second thing looked like the tidier
  // check and is not a fact: a browser will dispatch a pointer move of its own when a page
  // loads or reflows beneath a cursor that has not gone anywhere, and it did — reading
  // -1.000, which is the far edge of a clamp, from a pointer sitting in the corner at the
  // origin. Green here and red in CI, which is the worst way to learn it.
  const lookAfterMovingTo = async (x, y) => {
    const before = await lookOf(onLaptop);
    await onLaptop.mouse.move(x, y);
    await onLaptop.waitForFunction(
      (was) => document.querySelector("[data-character]").style.getPropertyValue("--look-x") !== was,
      before,
      { timeout: 10_000 }
    ).catch(() => { /* reported by the reading itself */ });
    return Number.parseFloat(await lookOf(onLaptop) || "NaN");
  };
  const atTheFace = await lookAfterMovingTo(box.left + box.width / 2, box.top + box.height / 2);
  const toTheLeft = await lookAfterMovingTo(1, box.top + box.height / 2);
  note(
    `${"masthead on a laptop".padEnd(26)} model: ${arrivedOnLaptop ? "yes" : "NO"}`
    + `   look at the face: ${atTheFace}, at the left edge: ${toTheLeft}`
  );
  if (!arrivedOnLaptop) {
    failures.push("a laptop is no longer shown the model, which it was shown before any of this");
  }
  if (!(Math.abs(atTheFace) < 0.1) || !(toTheLeft < atTheFace - 0.3)) {
    failures.push(
      `a laptop no longer follows its pointer: the head read ${atTheFace} with the pointer on its`
      + ` own face and ${toTheLeft} with the pointer at the left edge of the window`
    );
  }
  await onLaptop.close();
}

/**
 * Builds a site, puts a frozen copy of a fault into it, serves it, and hands the origin to
 * whichever published assertion is supposed to catch that fault.
 *
 * The specimens are the files as they stood before each repair, kept in the repository
 * rather than fetched from history, because CI checks out one commit and a control that
 * needs `git show` is a control that cannot run where it is needed.
 */
async function withFaultySite(replacements, build, run) {
  const built = await mkdtemp(join(tmpdir(), "generative-art-control-"));
  const server = await startStaticServer(built);
  try {
    await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false, build });
    for (const [specimen, destination] of replacements) {
      await cp(resolve(SPECIMENS, specimen), resolve(built, destination));
    }
    return await run(server.baseUrl);
  } finally {
    await server.close();
    await rm(built, { recursive: true, force: true });
  }
}

function reportControl(what, caught, sample) {
  note(`${what.padEnd(40)} rejected: ${caught ? "yes" : "NO"}${caught ? `   (${sample})` : ""}`);
  if (!caught) {
    failures.push(
      `${what} was accepted by the published check, so that check cannot see the fault it`
      + " was written for and its green means nothing"
    );
  }
}

/** The artwork pages as they were before the fit: full size, on a screen too small for them. */
async function controlPublishedFit() {
  const stamp = "0".repeat(40);
  const found = await withFaultySite(
    [["unfitted-artwork-page/shared.css", "p5js/artworks/shared.css"]],
    stamp,
    async (origin) => {
      const phone = await browser.newContext(PHONE);
      const onPhone = await phone.newPage();
      const caught = await checkArtworksFit({
        phone: onPhone,
        origin,
        manifest: oneWork(manifest),
        expectedBuild: stamp,
        viewport: PHONE.viewport
      });
      await phone.close();
      return caught;
    }
  );
  reportControl("an artwork page from before the fit", found.length > 0, found[0]);
}

/** The masthead as it was when a fine pointer stood in front of everything the figure does. */
async function controlPublishedMasthead() {
  const stamp = "0".repeat(40);
  const found = await withFaultySite(
    [
      ["head-withheld-from-touch/character.js", "assets/character.js"],
      ["head-withheld-from-touch/character-3d.js", "assets/character-3d.js"]
    ],
    stamp,
    async (origin) => {
      const phone = await browser.newContext(PHONE);
      const caught = await checkMasthead({ phone, origin, modelWithin: CONTROL_MODEL_WITHIN });
      await phone.close();
      return caught;
    }
  );
  reportControl("a masthead that withholds the head from touch", found.length > 0, found[0]);
}

/**
 * And the one failure mode none of this had before: a site that is serving something other
 * than the commit under test.
 *
 * The limit is shortened here, so what this shows is that the wait ends and ends in a
 * refusal — not that it lasts ten minutes. That the limit is ten minutes by default, and why,
 * is asserted in the unit tests, where it can be read without waiting for it.
 */
async function controlBuildMarker() {
  const servedBuild = "1".repeat(40);
  const wantedBuild = "2".repeat(40);
  const polls = [];
  const arrival = await withFaultySite([], servedBuild, (origin) => waitForBuild({
    url: `${origin}/index.html`,
    commit: wantedBuild,
    limitSeconds: 2,
    pollSeconds: 1,
    note: (line) => polls.push(line.trim())
  }));
  reportControl(
    "a site serving a different commit",
    !arrival.matched && polls.length > 1,
    `gave up after ${arrival.waited}s over ${polls.length} attempts, seeing ${arrival.saw[0]?.slice(0, 12)}`
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`FAIL ${failure}\n`);
  }
  process.exitCode = 1;
} else {
  note(base ? "\nAll clear on the published site." : "\nAll clear on a phone.");
}

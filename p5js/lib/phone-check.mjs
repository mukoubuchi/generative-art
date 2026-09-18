/**
 * The questions a phone answers, asked of whatever site it is pointed at.
 *
 * There are two sites worth asking: the one this repository builds, and the one a reader
 * actually opens. Until now only the first was ever asked. The fit was written on 2026-08-13
 * and the phone check went green on every push from that moment, while the site being served
 * stayed six hours old, because a push builds and checks without publishing. The check was
 * telling the truth about a site nobody was looking at.
 *
 * So the assertions live here, taking an origin, and both callers use these and not copies of
 * these. A published check written separately would agree with this one on the day it was
 * written and drift afterwards, and the drift would be invisible: two greens that no longer
 * mean the same thing.
 *
 * What is asked is narrow on purpose -- the two things that were actually broken, and that a
 * reader actually lost. Whether the pointer still lands correctly on a shrunk canvas is asked
 * of the local build only, where it can be controlled.
 */

/** Half a pixel of slack: a box fitted to a viewport lands on fractions of one. */
const SLACK = 0.5;

/** The head in the masthead: what is fetched for it, and what it becomes once it arrives. */
export const MODEL_FILE = "head.glb";
export const MODEL_CANVAS = "canvas.character__model";
/** Long enough for a model and a renderer to arrive over a network, not just off a disk. */
const MODEL_WITHIN = 45_000;
/** The head holds a direction for 2.6 seconds; this is room for one change and a little. */
export const DRIFT_EVERY = 2600;
const DRIFT_WITHIN = 8000;
/**
 * How long a refusal is watched before it is believed. Proving a request was not made means
 * waiting for the moment it would have been made and finding nothing.
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
    stamp: document.querySelector('meta[name="build"]')?.content ?? null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    // The symptom a reader feels, as distinct from the geometry that causes it.
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
};

/** How much of the picture is on screen at all, which is what a reader actually loses. */
export function visibleShare({ left, top, width, height, viewport }) {
  const across = Math.max(0, Math.min(left + width, viewport.width) - Math.max(left, 0));
  const down = Math.max(0, Math.min(top + height, viewport.height) - Math.max(top, 0));
  return Math.round((100 * (across * down)) / (width * height));
}

export function isWhollyOnScreen({ left, top, width, height, viewport }) {
  return left >= -SLACK
    && top >= -SLACK
    && left + width <= viewport.width + SLACK
    && top + height <= viewport.height + SLACK;
}

export function keepsItsShape(measured, canvas) {
  return Math.abs(measured.width / measured.height - canvas.width / canvas.height) < 0.01;
}

export const pageOf = (origin, artwork) => `${origin}/${artwork.entry}`;

/**
 * Every artwork, on a phone, at the origin given.
 *
 * `expectedBuild` is checked against each page's own marker as that page is measured, rather
 * than once against the site. The two are not the same claim: what answers a request is a
 * content network holding each address separately, so a fresh index is no evidence at all
 * that the artwork page beside it is fresh. Checking per page is what makes the reading a
 * reading of the deployment under test.
 *
 * `laptop` is optional, and when it is given the artwork's size there is checked to be
 * exactly what it has always been. That is the regression the fit had to not cause; it is
 * asked of the local build, where a second viewport costs one more page load.
 */
export async function checkArtworksFit({
  phone,
  laptop,
  origin,
  manifest,
  expectedBuild = null,
  viewport,
  note = () => {}
}) {
  const failures = [];
  let measured = 0;

  const show = async (page, url) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("#artwork canvas", { timeout: 60_000 });
    return await page.evaluate(measureCanvas);
  };

  for (const artwork of manifest.artworks) {
    const url = pageOf(origin, artwork);
    const small = await show(phone, url);
    const large = laptop ? await show(laptop, url) : null;
    const share = visibleShare(small);
    const unchanged = large
      && Math.round(large.width) === artwork.canvas.width
      && Math.round(large.height) === artwork.canvas.height;

    note(
      `${artwork.id.padEnd(26)} drawn ${`${artwork.canvas.width}x${artwork.canvas.height}`.padEnd(9)}`
      + ` phone ${`${Math.round(small.width)}x${Math.round(small.height)}`.padEnd(9)} ${`${share}%`.padStart(4)} on screen`
      + (large
        ? `   laptop ${`${Math.round(large.width)}x${Math.round(large.height)}`.padEnd(9)} as drawn: ${unchanged ? "yes" : "NO"}`
        : `   built ${(small.stamp ?? "unmarked").slice(0, 12)}`)
    );

    // The instrument before the reading. A browser emulating a phone lays a page out at a
    // desktop width until the page says it is willing to be laid out at the device's own,
    // and that declaration is exactly the one that could go missing -- whereupon a work that
    // overflowed a phone would be measured against a 980-pixel screen and found to fit.
    if (small.viewport.width !== viewport.width) {
      failures.push(
        `${artwork.id} is laid out ${small.viewport.width} pixels wide on a ${viewport.width}-pixel`
        + " screen, so it does not ask to be laid out at the width of the device it is on"
      );
    }
    if (expectedBuild && small.stamp !== expectedBuild) {
      failures.push(
        `${artwork.id} was served from build ${small.stamp ?? "no marker at all"},`
        + ` where ${expectedBuild} is being checked: this page is not the deployment under test`
      );
    }
    if (!isWhollyOnScreen(small)) {
      failures.push(
        `${artwork.id} is cut off on a phone: ${Math.round(small.width)} by ${Math.round(small.height)}`
        + ` in ${small.viewport.width} by ${small.viewport.height}, ${share} per cent of it on screen`
      );
    }
    if (small.overflow > 0) {
      failures.push(
        `${artwork.id} makes the page scroll sideways by ${small.overflow} pixels,`
        + " so the reader has to drag the picture about to see it"
      );
    }
    if (!keepsItsShape(small, artwork.canvas)) {
      failures.push(
        `${artwork.id} is fitted to a phone by being reshaped:`
        + ` ${Math.round(small.width)} by ${Math.round(small.height)}`
        + ` where it is drawn ${artwork.canvas.width} by ${artwork.canvas.height}`
      );
    }
    if (large && !unchanged) {
      failures.push(
        `${artwork.id} is no longer ${artwork.canvas.width} by ${artwork.canvas.height} on a laptop,`
        + ` but ${Math.round(large.width)} by ${Math.round(large.height)}`
      );
    }
    // The sketch's own idea of its size, read back through the backing store. If this and the
    // manifest disagree, the shape the stylesheet is holding is not the shape being drawn,
    // and the picture is stretched however well it fits.
    for (const [axis, drawn] of [["width", artwork.canvas.width], ["height", artwork.canvas.height]]) {
      if (Math.round(small.backing[axis] / small.ratio) !== drawn) {
        failures.push(
          `${artwork.id} draws ${small.backing[axis] / small.ratio} ${axis} where the manifest says ${drawn}`
        );
      }
    }
    measured += 1;
  }

  // An empty sweep satisfies every assertion above, so the count is fixed to the catalogue.
  if (measured !== manifest.artworks.length) {
    failures.push(`${measured} of ${manifest.artworks.length} works were measured`);
  }
  return failures;
}

/**
 * The figure in the masthead, and the two answers that are about the request rather than the
 * picture.
 *
 * A touch screen is to be sent the model; a reader who has asked for no motion is not. Both
 * are judged by what was fetched, because nothing on screen distinguishes them: two and a
 * half megabytes can be spent and then hidden, and a reader would never know it had been.
 */
export async function checkMasthead({
  phone,
  origin,
  modelWithin = MODEL_WITHIN,
  note = () => {}
}) {
  const failures = [];
  const gallery = `${origin}/index.html`;
  const lookOf = (page) => page.evaluate(
    () => document.querySelector("[data-character]").style.getPropertyValue("--look-x")
  );
  const openGallery = async (prepare) => {
    const page = await phone.newPage();
    const askedFor = [];
    page.on("request", (request) => {
      if (request.url().includes(MODEL_FILE)) {
        askedFor.push(request.url());
      }
    });
    if (prepare) {
      await prepare(page);
    }
    await page.goto(gallery, { waitUntil: "load", timeout: 60_000 });
    return { page, askedFor };
  };

  const touched = await openGallery();
  let arrived = false;
  try {
    await touched.page.waitForSelector(`.character--model ${MODEL_CANVAS}`, { timeout: modelWithin });
    arrived = true;
  } catch { /* reported below */ }
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
    `${"masthead on a phone".padEnd(26)} model: ${arrived ? "yes" : "NO"}`
    + `   asked for the model ${touched.askedFor.length} time(s)`
    + `   look: ${firstLook || "never written"} then ${secondLook || "never written"}`
  );
  if (!arrived) {
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

  const stilled = await openGallery((page) => page.emulateMedia({ reducedMotion: "reduce" }));
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

  return failures;
}

/**
 * How far down the gallery's box the reading is taken, and how far the window is asked to go.
 * Both well past a screen on the phone this runs at, so that a box which moved and a window
 * which did not are two different numbers rather than two roundings of nought.
 */
const DOWN_THE_GALLERY = 2000;

/**
 * Whether the gallery's document still has nowhere to go, and its box still carries the reader.
 *
 * The pair is the point. A document that cannot move is what keeps an in-app browser from
 * folding its toolbars away, and it is trivially achieved by a page with nothing in it, so on
 * its own it says nothing: it has to be read beside a box that does move, over a gallery long
 * enough to move through. Each of the two is measured in the way a reader produces it — a
 * finger drawn up the glass — and then again in the way a script produces it, because a
 * browser may answer the two differently.
 *
 * The sideways reading is here rather than with the masthead because it is a reading about
 * the same box: the document can no longer overflow in any direction, so a check that asked
 * the document whether the cards run off the side would answer no on a page that runs off
 * the side, which is the shape of a check that has quietly stopped measuring anything.
 */
export async function checkGalleryHoldsStill({
  context,
  page,
  origin,
  withAFinger = true,
  note = () => {}
}) {
  const failures = [];
  await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector(".card", { timeout: 60_000 });

  const room = await page.evaluate(() => ({
    documentLength: document.documentElement.scrollHeight,
    documentScreen: document.documentElement.clientHeight,
    boxLength: document.body.scrollHeight,
    boxScreen: document.body.clientHeight,
    boxWide: document.body.scrollWidth,
    boxWideScreen: document.body.clientWidth,
    cards: document.querySelectorAll(".card").length
  }));
  note(
    `${"the gallery's document".padEnd(26)} ${room.documentLength} of page in ${room.documentScreen}:`
    + ` ${room.documentLength === room.documentScreen ? "nowhere to go" : "HAS SOMEWHERE TO GO"}`
  );
  note(
    `${"the gallery's box".padEnd(26)} ${room.boxLength} of page in ${room.boxScreen},`
    + ` ${room.cards} cards`
  );

  // The claim first, and the instrument after it. A page that has gone back to scrolling
  // itself also leaves its body with nothing to scroll, so a guard placed first would stop
  // the reading and report the instrument — true, and not the thing that went wrong.
  if (room.documentLength !== room.documentScreen) {
    failures.push(
      `the gallery's document is ${room.documentLength} long in a ${room.documentScreen} screen, so it`
      + " can be scrolled, and an in-app browser will fold its toolbars away as the reader descends"
    );
  }
  // A box with nothing to scroll would hold still for the same reason a pinned document
  // does, and the finger below would then prove nothing at all.
  if (room.boxLength <= room.boxScreen + DOWN_THE_GALLERY) {
    failures.push(
      `the gallery's box is only ${room.boxLength} long in a ${room.boxScreen} screen, so there is`
      + " nothing to descend through and the readings below say nothing"
    );
    return failures;
  }
  note(
    `${"the gallery's width".padEnd(26)} ${room.boxWide} wide in ${room.boxWideScreen}:`
    + ` ${room.boxWide <= room.boxWideScreen ? "no sideways overflow" : "OVERFLOWS SIDEWAYS"}`
  );
  if (room.boxWide > room.boxWideScreen) {
    failures.push(
      `the gallery runs ${room.boxWide - room.boxWideScreen} pixels off the side of a`
      + ` ${room.boxWideScreen}-pixel screen, so a reader has to drag it about to read the cards`
    );
  }

  // A reader's own descent: the finger moves the box and must leave the document where it is.
  // The finger is drawn through the browser's own input, which only Chromium exposes to us,
  // so the engine a phone runs is asked the other question and told so in as many words —
  // rather than being handed a reading that was never taken.
  if (withAFinger) {
    await drawAFinger(context, page, { from: FINGER.from, to: FINGER.to });
    const fromAFinger = await page.evaluate(() => ({
      window: window.scrollY,
      box: document.body.scrollTop
    }));
    note(
      `${"a finger up the gallery".padEnd(26)} window ${fromAFinger.window}, box ${fromAFinger.box}:`
      + ` ${fromAFinger.window === 0 && fromAFinger.box > 0 ? "the box moved and the page did not" : "WRONG ONE MOVED"}`
    );
    if (fromAFinger.window !== 0) {
      failures.push(`a finger drawn up the gallery moved the document ${fromAFinger.window} pixels`);
    }
    if (fromAFinger.box === 0) {
      failures.push("a finger drawn up the gallery moved the box not at all, so the reader cannot descend");
    }
  } else {
    note(`${"a finger up the gallery".padEnd(26)} not drawn in this engine`);
  }

  // And a script's: the window is told to go, and must not; the box is told to go, and must.
  const fromAScript = await page.evaluate((down) => {
    document.body.scrollTop = 0;
    window.scrollTo(0, down);
    const window_ = window.scrollY;
    document.body.scrollTop = down;
    return { window: window_, box: document.body.scrollTop };
  }, DOWN_THE_GALLERY);
  note(
    `${"asked to go to " + DOWN_THE_GALLERY}`.padEnd(26)
    + ` window ${fromAScript.window}, box ${fromAScript.box}`
  );
  if (fromAScript.window !== 0) {
    failures.push(`the gallery's document went to ${fromAScript.window} when it was asked to`);
  }
  if (fromAScript.box !== DOWN_THE_GALLERY) {
    failures.push(
      `the gallery's box was asked for ${DOWN_THE_GALLERY} and gave ${fromAScript.box}`
    );
  }

  return failures;
}

/**
 * The work the pan is measured on, and the work the touch is measured on. Pinned by name,
 * since a check that quietly measures nothing is a check that quietly passes. The second one
 * answers a tap by striking its bell, and says how many rings are in the air, so a touch that
 * arrives can be told from one that was swallowed.
 */
export const PANNED_WORK = "koch-curves";
export const TOUCHED_WORK = "pulse-button";

/**
 * Whether a value of `touch-action` still leaves a reader the pinch that gets them close to
 * a hairline. Two values allow it without naming it — the initial `auto` and `manipulation` —
 * so a check that only looked for the word would call the page that allows everything a page
 * that allows nothing.
 */
const letsAPinch = (touchAction) =>
  touchAction === "auto" || touchAction === "manipulation" || touchAction.includes("pinch-zoom");

/** Far enough to be a scroll rather than a tap, and inside a 390 by 664 phone. */
const FINGER = { x: 195, from: 560, to: 160, step: 40 };
/** Where the page is put before it is asked to be dragged back down. */
const PART_WAY_DOWN = 400;
/** One animation frame and a little: long enough for a scroll to have been begun and settled. */
const SETTLE = 700;
/** Rings are counted for this long after a tap, because the artwork lets them go again. */
const LISTEN_FOR_RINGS = 1200;

/**
 * A finger drawn across the glass, through the browser's own input path.
 *
 * Through the debugging protocol rather than through events made in the page: a touch a page
 * makes for itself is untrusted, and an untrusted touch scrolls nothing at all. It would
 * therefore report a page that refuses a pan and a page that allows one as the same page.
 */
async function drawAFinger(context, page, { from, to }) {
  const cdp = await context.newCDPSession(page);
  const at = (y) => [{ x: FINGER.x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
  const step = from > to ? -FINGER.step : FINGER.step;
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(from) });
    for (let y = from + step; step < 0 ? y >= to : y <= to; y += step) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(y) });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await page.waitForTimeout(SETTLE);
}

async function tap(context, page, { x, y }) {
  const cdp = await context.newCDPSession(page);
  const at = [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

/**
 * Whether a finger can move an artwork page, and whether the artworks still feel one.
 *
 * The page is given some length before the finger is drawn up it. Every artwork page is
 * exactly one screen and cannot scroll, so a finger that fails to move one has proved
 * nothing: the reading has to be taken where there is something to move, which is also the
 * position the page is in inside an app's own browser, where the host's scroller has the
 * length the document does not. The length is given by opening this page's own overflow and
 * adding a column to it, and nothing touches the two declarations under test.
 *
 * Then the same finger is asked of a work that answers one, because a page that cannot be
 * panned would be no use if the artworks had stopped feeling the hand that was refused.
 */
export async function checkPageHoldsStill({ context, page, origin, manifest, note = () => {} }) {
  const failures = [];
  const works = new Map(manifest.artworks.map((artwork) => [artwork.id, artwork]));
  const panned = works.get(PANNED_WORK);
  const touched = works.get(TOUCHED_WORK);
  if (!panned || !touched) {
    failures.push(
      `the catalogue no longer carries ${PANNED_WORK} and ${TOUCHED_WORK}, so nothing was asked of a finger`
    );
    return failures;
  }

  await page.goto(pageOf(origin, panned), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#artwork canvas", { timeout: 60_000 });

  const declared = await page.evaluate(() => {
    const read = (element) => ({
      touchAction: getComputedStyle(element).touchAction,
      overscroll: getComputedStyle(element).overscrollBehaviorY
    });
    return { html: read(document.documentElement), body: read(document.body) };
  });
  note(
    `${"the page's answer to a finger".padEnd(26)} touch-action ${declared.html.touchAction},`
    + ` overscroll ${declared.html.overscroll}`
  );
  for (const [where, rules] of Object.entries(declared)) {
    if (rules.touchAction === "auto" || rules.touchAction.includes("pan-")) {
      failures.push(`${where} still offers itself to be panned: touch-action is ${rules.touchAction}`);
    }
    // A pan is refused; a pinch is not. `none` would take the zoom with it, which is how a
    // reader gets close to a hairline on a phone.
    if (!letsAPinch(rules.touchAction)) {
      failures.push(`${where} no longer lets a reader pinch: touch-action is ${rules.touchAction}`);
    }
    if (rules.overscroll !== "none") {
      failures.push(`${where} still bounces at its own end: overscroll-behavior-y is ${rules.overscroll}`);
    }
  }

  const lengthened = await page.evaluate(() => {
    for (const element of [document.documentElement, document.body]) {
      element.style.setProperty("overflow", "visible", "important");
      element.style.setProperty("height", "auto", "important");
    }
    const column = document.createElement("div");
    column.style.cssText = "height: 3000px; width: 1px;";
    document.body.append(column);
    window.scrollTo(0, 120);
    const moved = window.scrollY;
    window.scrollTo(0, 0);
    return {
      length: document.documentElement.scrollHeight,
      screen: document.documentElement.clientHeight,
      moved
    };
  });
  // The instrument before the reading: if the page cannot be moved at all, a finger that
  // fails to move it says nothing about the finger.
  if (lengthened.length <= lengthened.screen || lengthened.moved === 0) {
    failures.push(
      `the page was not given anything to scroll (${lengthened.length} in ${lengthened.screen},`
      + ` and it stayed at ${lengthened.moved} when it was told to go to 120), so the finger below proves nothing`
    );
    return failures;
  }

  await drawAFinger(context, page, { from: FINGER.from, to: FINGER.to });
  const afterUp = await page.evaluate(() => window.scrollY);
  await page.evaluate((to) => window.scrollTo(0, to), PART_WAY_DOWN);
  const fromPartWay = await page.evaluate(() => window.scrollY);
  await drawAFinger(context, page, { from: FINGER.to, to: FINGER.from });
  const afterDown = await page.evaluate(() => window.scrollY);
  note(
    `${"a finger up and down".padEnd(26)} ${lengthened.length} of page in ${lengthened.screen}:`
    + ` 0 -> ${afterUp} up, ${fromPartWay} -> ${afterDown} down`
  );
  if (afterUp !== 0) {
    failures.push(`a finger drawn up the page moved it ${afterUp} pixels, so the page pans under a swipe`);
  }
  if (afterDown !== fromPartWay) {
    failures.push(
      `a finger drawn down the page moved it from ${fromPartWay} to ${afterDown}, so the page pans under a swipe`
    );
  }

  await page.goto(pageOf(origin, touched), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#artwork canvas", { timeout: 60_000 });
  await page.waitForFunction(() => window.__ARTWORK_READY__ === true, null, { timeout: 60_000 });
  const canvas = await page.locator("#artwork canvas").boundingBox();
  const quiet = await page.evaluate(() => window.__ARTWORK_STATE__.ringCount);
  await tap(context, page, { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 });
  const rang = await page.evaluate(async (listenFor) => {
    let most = 0;
    const until = performance.now() + listenFor;
    while (performance.now() < until) {
      most = Math.max(most, window.__ARTWORK_STATE__.ringCount);
      await new Promise((frame) => requestAnimationFrame(frame));
    }
    return most;
  }, LISTEN_FOR_RINGS);
  note(`${`a tap on ${TOUCHED_WORK}`.padEnd(26)} rings ${quiet} before, ${rang} after`);
  if (rang <= quiet) {
    failures.push(
      `${TOUCHED_WORK} was struck and did not ring (${quiet} rings before, ${rang} after), so the`
      + " page that refuses a pan is keeping the touch from the artwork as well"
    );
  }
  return failures;
}

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

  const indexWidth = await touched.page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  note(
    `${"the gallery index".padEnd(26)} ${indexWidth.scroll} wide in ${indexWidth.client}:`
    + ` ${indexWidth.scroll <= indexWidth.client ? "no sideways overflow" : "OVERFLOWS SIDEWAYS"}`
  );
  if (indexWidth.scroll > indexWidth.client) {
    failures.push(
      `the gallery index runs ${indexWidth.scroll - indexWidth.client} pixels off the side of a`
      + ` ${indexWidth.client}-pixel screen, so a reader has to drag it about to read the cards`
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

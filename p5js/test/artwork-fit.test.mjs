import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, loadCatalog, repositoryPath } from "../lib/catalog.mjs";
import { artworkHref, canvasSizeProperties } from "../lib/gallery.mjs";
import { buildSite } from "../lib/site.mjs";

/**
 * An artwork is drawn at the size its manifest entry gives it, and every one of those is
 * wider than a phone. These tests are about the one thing that lets such a page fit a screen
 * it was not drawn for: that size, carried from the manifest to the stylesheet.
 *
 * What the fit then does to a canvas is measured in a browser by `scripts/smoke-phone.mjs`,
 * because it is a question about layout at a real width and a real pixel ratio, and because
 * the way it can go wrong is to look right on the machine doing the checking. These hold the
 * part that is a property of the files: that the numbers are there, that they are the
 * manifest's, and that they are written in one place only.
 */
const { manifest, quoteCatalog } = await loadCatalog();
const stylesheet = await readFile(resolve(P5JS_DIRECTORY, "artworks/shared.css"), "utf8");

const built = await mkdtemp(join(tmpdir(), "generative-art-fit-"));
const pages = new Map();
const sources = new Map();
try {
  await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });
  for (const artwork of manifest.artworks) {
    pages.set(artwork.id, await readFile(resolve(built, artworkHref(artwork), "index.html"), "utf8"));
    sources.set(artwork.id, await readFile(repositoryPath(artwork.entry), "utf8"));
  }
} finally {
  await rm(built, { recursive: true, force: true });
}

/**
 * The rule that fits the canvas, found by the selector that guards it. Matched as one block
 * so that what is inside it can be told from what is outside: a rule that has lost its guard
 * still fits a phone, and still doubles every artwork on a dense display.
 */
const FIT_RULE = /#artwork\[style\*="--art-w:"\]\[style\*="--art-h:"\]\s+canvas\s*\{([^}]*)\}/u;

test("every artwork page is told the size it was drawn at", () => {
  assert.ok(manifest.artworks.length > 0, "there are no artwork pages to examine");
  assert.equal(pages.size, manifest.artworks.length);
  for (const artwork of manifest.artworks) {
    const { width, height } = artwork.canvas;
    assert.ok(
      pages.get(artwork.id).includes(`<main id="artwork" style="--art-w: ${width}; --art-h: ${height}">`),
      `${artwork.id} does not hand its stylesheet the ${width} by ${height} it is drawn at`
    );
  }
});

test("a page with nowhere to put the size stops the build", async () => {
  // Passing over such a page would leave one artwork cut off on a phone while the rest were
  // fitted, which is the kind of gap nobody goes looking for. The gallery's own index is a
  // real page in the built site with no canvas on it, so pointing an artwork at that is the
  // mistake in its true shape rather than a broken file invented for the occasion.
  const directory = await mkdtemp(join(tmpdir(), "generative-art-fit-refused-"));
  try {
    const doctored = { ...manifest, artworks: [{ ...manifest.artworks[0], entry: "index.html" }] };
    await assert.rejects(
      buildSite(doctored, quoteCatalog, { directory, thumbnails: false }),
      /has no <main id="artwork">/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the numbers are written in one place and copied into no other", () => {
  // The size lives in the manifest. A page that carried its own copy would be a second
  // number to keep in step with the canvas, and the wrong one would be the one nobody reads.
  for (const artwork of manifest.artworks) {
    assert.ok(
      !sources.get(artwork.id).includes("--art-"),
      `${artwork.id}'s page in the repository writes its own size; the build gives it one`
    );
  }
  // And the stylesheet names the properties only inside the rule they guard. A `width: auto`
  // on a canvas anywhere else in this file would apply to a page that carries no numbers,
  // and a canvas with no width and no shape falls back to its backing store — which is the
  // artwork at double size on a Retina desktop, not the artwork cut off on a phone.
  const rule = stylesheet.match(FIT_RULE);
  assert.ok(rule, "the stylesheet no longer fits a canvas to the screen it is shown on");
  const inTheRule = rule[0].split("--art-").length - 1;
  const inTheFile = stylesheet.split("--art-").length - 1;
  assert.equal(inTheFile, inTheRule, "the canvas size is named outside the rule that guards it");
});

test("the fit speaks for both axes, and takes neither from the backing store", () => {
  const [, declarations] = stylesheet.match(FIT_RULE);
  // Both axes, or the picture is stretched rather than fitted: p5 writes a width and a
  // height of its own onto the element, and clamping one leaves the other at its full size.
  assert.match(declarations, /width:\s*auto\s*!important/u);
  assert.match(declarations, /height:\s*auto\s*!important/u);
  // The shape from the manifest rather than from the element, whose natural size is its
  // backing store and so is wrong by the pixel ratio.
  assert.match(declarations, /aspect-ratio:\s*var\(--art-w\)\s*\/\s*var\(--art-h\)/u);
  // Never larger than it was drawn, so a screen wide enough for the artwork shows exactly
  // what it showed before.
  assert.match(declarations, /max-width:\s*min\(100%,\s*calc\(var\(--art-w\)\s*\*\s*1px\)\)/u);
  assert.match(declarations, /max-height:\s*min\(100%,\s*calc\(var\(--art-h\)\s*\*\s*1px\)\)/u);
});

test("the canvas has a definite height to be held inside", () => {
  // A percentage ceiling against an automatic height is no ceiling at all: without this the
  // fit would hold a canvas inside the width of a phone held upright and let it run off the
  // bottom of one held sideways.
  assert.match(stylesheet, /\bmain\s*\{[^}]*height:\s*100%/u);
});

test("the two properties are written as a pair, whatever the artwork", () => {
  // The stylesheet asks for both by name before it changes anything, so a page carrying only
  // one is a page left alone rather than a page half fitted. That is only true while the two
  // are written by one expression, which is what this pins.
  for (const artwork of manifest.artworks) {
    assert.equal(
      canvasSizeProperties(artwork),
      `--art-w: ${artwork.canvas.width}; --art-h: ${artwork.canvas.height}`
    );
  }
});

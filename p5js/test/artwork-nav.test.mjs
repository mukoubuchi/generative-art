import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, loadCatalog } from "../lib/catalog.mjs";
import { artworkHref, renderIndexPage, siteRootFrom, sourceHref } from "../lib/gallery.mjs";
import { buildSite } from "../lib/site.mjs";

/**
 * A post links to an artwork's own page, so that page is the door every reader comes in
 * through. These tests are about what can be reached from it.
 */
const { manifest, quoteCatalog } = await loadCatalog();
const stylesheet = await readFile(resolve(P5JS_DIRECTORY, "artworks/shared.css"), "utf8");

const built = await mkdtemp(join(tmpdir(), "generative-art-site-"));
const pages = new Map();
try {
  await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });
  for (const artwork of manifest.artworks) {
    pages.set(artwork.id, await readFile(resolve(built, artworkHref(artwork), "index.html"), "utf8"));
  }
} finally {
  await rm(built, { recursive: true, force: true });
}

/** Each plate, from its own opening tag to the `</nav>` that follows it. */
function plate(html, modifier) {
  const start = html.indexOf(`<nav class="page-nav page-nav--${modifier}"`);
  assert.notEqual(start, -1, `there is no ${modifier} plate`);
  return html.slice(start, html.indexOf("</nav>", start));
}

test("every artwork page offers its way back and its source, on plates of their own", () => {
  for (const artwork of manifest.artworks) {
    const html = pages.get(artwork.id);
    const back = plate(html, "back");
    const source = plate(html, "source");

    assert.ok(back.includes(`href="${siteRootFrom(artwork)}"`), `${artwork.id} cannot get back`);
    assert.ok(
      source.includes(`href="${sourceHref(manifest, artwork)}"`),
      `${artwork.id} does not link to its own source directory`
    );
    // Each carries its own glyph. Two destinations that shared one would be telling the
    // reader they lead to the same kind of place.
    for (const [name, markup] of [["back", back], ["source", source]]) {
      assert.match(markup, /<svg class="page-nav__icon"[^>]*viewBox="0 0 \d+ 512"/u, `${artwork.id}'s ${name} plate has no icon`);
    }
    assert.notEqual(
      back.match(/viewBox="([^"]+)"/u)[1],
      source.match(/viewBox="([^"]+)"/u)[1],
      `${artwork.id} uses one glyph for both destinations`
    );
  }
});

test("the way back lands on the gallery, from whatever depth the page sits at", () => {
  for (const artwork of manifest.artworks) {
    const page = new URL(`https://example.test/${artworkHref(artwork)}`);
    // Resolved the way a browser would, rather than by counting the dots by eye.
    assert.equal(new URL(siteRootFrom(artwork), page).pathname, "/");
  }
});

test("a page's source link is the one its gallery card already gives", () => {
  // Two links to one place, from one derivation. If the card's address ever moves, this
  // fails rather than leaving the two quietly disagreeing about where a work lives.
  const index = renderIndexPage(manifest, quoteCatalog);
  for (const artwork of manifest.artworks) {
    const address = sourceHref(manifest, artwork);
    assert.ok(index.includes(address), `the gallery card for ${artwork.id} lost its source link`);
    assert.ok(pages.get(artwork.id).includes(address));
  }
});

test("the navigation needs no script and cannot move the canvas", () => {
  for (const artwork of manifest.artworks) {
    const html = pages.get(artwork.id);
    for (const modifier of ["back", "source"]) {
      const markup = plate(html, modifier);
      // Plain anchors: a reader with scripting off is the one most likely to be looking at
      // a page that never drew anything, and the way out has to work for them.
      assert.ok(!markup.includes("<script"), `${artwork.id} builds its ${modifier} plate with a script`);
      assert.ok(markup.includes("<a "), `${artwork.id} has no anchor in its ${modifier} plate`);
    }
  }
  // Out of flow, so a canvas drawn at its own size is not pushed down the page.
  assert.match(stylesheet, /\.page-nav\s*\{[^}]*position:\s*fixed/u);
});

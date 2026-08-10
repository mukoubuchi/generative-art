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
 * through. These tests are about what can be reached from it: two icon links on one plate,
 * the gallery first and the source beside it.
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

function nav(html) {
  const start = html.indexOf('<nav class="page-nav"');
  assert.notEqual(start, -1, "the page has no navigation");
  return html.slice(start, html.indexOf("</nav>", start));
}

function anchors(markup) {
  return [...markup.matchAll(/<a\s[\s\S]*?<\/a>/gu)].map(([anchor]) => anchor);
}

test("every artwork page offers the gallery and its source, in that order", () => {
  for (const artwork of manifest.artworks) {
    const [gallery, source, ...extra] = anchors(nav(pages.get(artwork.id)));
    assert.equal(extra.length, 0, `${artwork.id} has more doors than it should`);
    assert.ok(gallery.includes(`href="${siteRootFrom(artwork)}"`), `${artwork.id} cannot get back`);
    assert.ok(
      source.includes(`href="${sourceHref(manifest, artwork)}"`),
      `${artwork.id} does not link to its own source directory`
    );
  }
});

test("an icon-only link says where it goes, twice over", () => {
  // No visible text is left to name the destination, so every link has to carry both the
  // screen reader's name and the pointer's tooltip — and a glyph of its own: two doors
  // sharing one glyph would claim to lead to the same kind of place.
  for (const artwork of manifest.artworks) {
    const doors = anchors(nav(pages.get(artwork.id)));
    const boxes = doors.map((door) => {
      assert.match(door, /aria-label="[^"]+"/u, `${artwork.id} has a door with no name`);
      assert.match(door, /title="[^"]+"/u, `${artwork.id} has a door with no tooltip`);
      assert.match(door, /<svg class="page-nav__icon"/u, `${artwork.id} has a door with no glyph`);
      return door.match(/viewBox="([^"]+)"/u)[1];
    });
    assert.notEqual(boxes[0], boxes[1], `${artwork.id} uses one glyph for both destinations`);
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
    const markup = nav(pages.get(artwork.id));
    // Plain anchors: a reader with scripting off is the one most likely to be looking at a
    // page that never drew anything, and the way out has to work for them.
    assert.ok(!markup.includes("<script"), `${artwork.id} builds its navigation with a script`);
  }
  // Out of flow, so a canvas drawn at its own size is not pushed down the page.
  assert.match(stylesheet, /\.page-nav\s*\{[^}]*position:\s*fixed/u);
});

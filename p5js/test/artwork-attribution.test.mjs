import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { artworkHref, escapeHtml, renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, quoteYearSuffix } from "../lib/post-text.mjs";
import { buildSite } from "../lib/site.mjs";

/**
 * The quotations were verified against primary sources, and two surfaces say so: the
 * gallery card and the post body, which date their attributions by one shared rule —
 * the year printed when the catalog has one, absent when it records unknown. The
 * artwork page is deliberately not one of them. Captions were tried there and removed
 * by decision: the page shows the artwork alone, and these tests hold the removal as
 * firmly as they hold the rule.
 */
const { manifest, quoteCatalog } = await loadCatalog();
const quotesById = new Map(quoteCatalog.quotes.map((quote) => [quote.id, quote]));
const index = renderIndexPage(manifest, quoteCatalog);

const built = await mkdtemp(join(tmpdir(), "generative-art-attribution-"));
const pages = new Map();
try {
  await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });
  for (const artwork of manifest.artworks) {
    pages.set(artwork.id, await readFile(resolve(built, artworkHref(artwork), "index.html"), "utf8"));
  }
} finally {
  await rm(built, { recursive: true, force: true });
}

test("the dating rule has both of its branches to exercise", () => {
  // If every entry gained a year, the omission branch below would pass vacuously —
  // and the catalog's records of "unknown" are themselves worth noticing the loss of.
  const years = quoteCatalog.quotes.map((quote) => quote.year);
  assert.ok(years.some((year) => year !== null), "no dated quotes are left");
  assert.ok(years.some((year) => year === null), "no undated quotes are left");
});

test("the card and the post date an attribution by one rule", () => {
  for (const artwork of manifest.artworks) {
    const quote = quotesById.get(artwork.quoteIds[0]);
    const suffix = quoteYearSuffix(quote);

    const card = index.slice(index.indexOf(`<h2 class="card__title">${escapeHtml(artwork.title)}</h2>`));
    const cite = card.slice(card.indexOf("card__cite"), card.indexOf("</cite>"));
    assert.ok(cite.includes(`${escapeHtml(quote.source)}${escapeHtml(suffix)}`),
      `${artwork.id}'s card dates its source differently`);
    if (quote.year === null) {
      assert.ok(!cite.includes("("), `${artwork.id}'s card prints a date the catalog does not have`);
    }

    const body = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl);
    // The quotation itself may span lines — an epitaph does — so the attribution line
    // is found after however many the quotation takes.
    const attributionLine = body.split("\n")[quote.text.split("\n").length];
    assert.equal(attributionLine, `— ${quote.author}, ${quote.source}${suffix}`,
      `${artwork.id}'s post dates its source differently`);
  }
});

test("the artwork page shows the artwork alone", () => {
  // Captions under the canvas were built, shipped, and removed the same day by the
  // owner's decision. This pins the removal so it cannot quietly return: a page carries
  // its navigation doors and nothing else that quotes or attributes.
  for (const artwork of manifest.artworks) {
    const page = pages.get(artwork.id);
    assert.ok(!page.includes("page-attribution"), `${artwork.id} grew its caption back`);
    assert.ok(!page.includes("<blockquote"), `${artwork.id} quotes something on the page`);
    assert.ok(!page.includes("<figcaption"), `${artwork.id} attributes something on the page`);
  }
});

test("the page neither scrolls nor needs to", async () => {
  // The vertical scroll existed only so a caption below the canvas could be reached;
  // with the caption gone the page went back to being a clipped, unscrolling canvas.
  const stylesheet = await readFile(
    resolve(new URL("../artworks/shared.css", import.meta.url).pathname),
    "utf8"
  );
  assert.match(stylesheet, /overflow:\s*hidden/u);
  assert.ok(!stylesheet.includes("page-attribution"), "the caption's styles outlived it");
});

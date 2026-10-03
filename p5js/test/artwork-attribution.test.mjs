import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { artworkHref, escapeHtml, renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody } from "../lib/post-text.mjs";
import { buildSite } from "../lib/site.mjs";

/**
 * The site omits dates while posts retain the catalogue's bibliographic attribution.
 * Explicit site labels remove embedded dates without treating reference numbers as
 * years. The artwork page continues to show the artwork alone.
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

test("the catalog keeps both dated and undated quotes for the no-year rule to be seen on", () => {
  // Posts print no year whether the catalog records one or not. If every entry lost its
  // year, the check below would no longer show a known year being left out.
  const years = quoteCatalog.quotes.map((quote) => quote.year);
  assert.ok(years.some((year) => year !== null), "no dated quotes are left");
  assert.ok(years.some((year) => year === null), "no undated quotes are left");
});

test("each post prints its card's attribution word for word, with no date", () => {
  const siteSources = new Map([
    ["descartes-theoreme-plus-beau", "Letter to Elisabeth"],
    ["wren-rectas-innumeras", "Philosophical Transactions, no. 48, p. 962"]
  ]);
  assert.deepEqual(quoteCatalog.quotes.filter((quote) => quote.siteSource !== undefined)
    .map((quote) => [quote.id, quote.siteSource]), [...siteSources]);

  let dated = 0;
  for (const artwork of manifest.artworks) {
    const quote = quotesById.get(artwork.quoteIds[0]);
    if (quote.year !== null) dated += 1;

    const card = index.slice(index.indexOf(`<h2 class="card__title">${escapeHtml(artwork.title)}</h2>`));
    const cite = card.match(/<cite class="card__cite">(.*?)<\/cite>/u)?.[1];
    const source = siteSources.get(quote.id) ?? quote.source;
    assert.equal(cite, `—&nbsp;<b>${escapeHtml(quote.author)}</b>, ${escapeHtml(source)}`,
      `${artwork.id}'s card must retain its source and reference numbers without a date`);

    const body = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl);
    // The quotation itself may span lines — an epitaph does — so the attribution line
    // is found after however many the quotation takes.
    const attributionLine = body.split("\n")[quote.text.split("\n").length];
    // The same author and the same source line the card was just held to.
    assert.equal(attributionLine, `— ${quote.author}, ${source}`,
      `${artwork.id}'s post credits its quotation differently from its card`);
    assert.ok(!attributionLine.includes(`(${quote.year})`), `${artwork.id}'s post prints a year`);
  }
  assert.ok(dated > 0, "no artwork's quotation has a recorded year to leave out");
  assert.equal(quotesById.get("descartes-theoreme-plus-beau").source,
    "Letter to Elisabeth, November 1643");
  assert.equal(quotesById.get("wren-rectas-innumeras").source,
    "Philosophical Transactions, no. 48 (1669), p. 962");
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

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
 * The words were verified against primary sources, and these tests hold the three
 * surfaces that print them to that work: the artwork page carries the quotation with a
 * link to the source it was verified against, the gallery card and the post body dates
 * theirs the same way, and all three read from one catalog so none can drift. The dates
 * follow one rule — printed when the catalog has one, absent when it records unknown —
 * and both branches are exercised by the real catalog, which carries both kinds.
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

function attribution(html, id) {
  const start = html.indexOf('<figure class="page-attribution"');
  assert.notEqual(start, -1, `${id} carries no attribution`);
  return html.slice(start, html.indexOf("</figure>", start));
}

test("the dating rule has both of its branches to exercise", () => {
  // If every entry gained a year, the omission branch below would pass vacuously —
  // and the catalog's records of "unknown" are themselves worth noticing the loss of.
  const years = quoteCatalog.quotes.map((quote) => quote.year);
  assert.ok(years.some((year) => year !== null), "no dated quotes are left");
  assert.ok(years.some((year) => year === null), "no undated quotes are left");
});

test("every artwork page quotes its words in their own language", () => {
  for (const artwork of manifest.artworks) {
    const quote = quotesById.get(artwork.quoteIds[0]);
    const figure = attribution(pages.get(artwork.id), artwork.id);
    assert.ok(
      figure.includes(`<blockquote class="page-attribution__quote" lang="${escapeHtml(quote.lang)}">`),
      `${artwork.id} mislabels or drops the quotation's language`
    );
    assert.ok(figure.includes(escapeHtml(quote.text)), `${artwork.id} does not carry its quotation`);
  }
});

test("every artwork page links its words to the source they were verified against", () => {
  for (const artwork of manifest.artworks) {
    const quote = quotesById.get(artwork.quoteIds[0]);
    const figure = attribution(pages.get(artwork.id), artwork.id);
    const anchor = figure.match(/<a\s[^>]*>/u)?.[0];
    assert.ok(anchor, `${artwork.id} has an attribution with no link in it`);
    assert.ok(anchor.includes(`href="${escapeHtml(quote.sourceUrl)}"`),
      `${artwork.id} links somewhere other than its verified source`);
    assert.ok(anchor.includes('rel="noopener noreferrer"'));
    assert.ok(figure.includes(`>${escapeHtml(quote.source)}</a>`),
      `${artwork.id} names a source other than the catalog's`);
    assert.ok(figure.includes(`<b>${escapeHtml(quote.author)}</b>`));
  }
});

test("the three surfaces date an attribution by one rule", () => {
  for (const artwork of manifest.artworks) {
    const quote = quotesById.get(artwork.quoteIds[0]);
    const suffix = quoteYearSuffix(quote);
    const dated = `${escapeHtml(quote.source)}${escapeHtml(suffix)}`;

    const figure = attribution(pages.get(artwork.id), artwork.id);
    const caption = figure.slice(figure.indexOf("<figcaption"));
    assert.ok(caption.includes(`</a>${escapeHtml(suffix)}</figcaption>`),
      `${artwork.id}'s page dates its source differently`);

    const card = index.slice(index.indexOf(`<h2 class="card__title">${escapeHtml(artwork.title)}</h2>`));
    assert.ok(card.slice(0, card.indexOf("</cite>")).includes(dated),
      `${artwork.id}'s card dates its source differently`);

    const body = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl);
    // The quotation itself may span lines — an epitaph does — so the attribution line
    // is found after however many the quotation takes.
    const attributionLine = body.split("\n")[quote.text.split("\n").length];
    assert.ok(attributionLine === `— ${quote.author}, ${quote.source}${suffix}`,
      `${artwork.id}'s post dates its source differently`);

    if (quote.year === null) {
      assert.ok(!caption.includes("()"), `${artwork.id} prints an empty date`);
      assert.ok(!caption.includes("null"), `${artwork.id} prints a null date`);
    } else {
      assert.ok(caption.includes(`(${quote.year})`), `${artwork.id} drops its date`);
    }
  }
});

test("the caption sits under the canvas, on a page that can now be scrolled to it", async () => {
  // The attribution lives below a canvas drawn at its own size, so the page must allow
  // vertical scroll or the caption is unreachable on a short window.
  const stylesheet = await readFile(
    resolve(new URL("../artworks/shared.css", import.meta.url).pathname),
    "utf8"
  );
  assert.match(stylesheet, /overflow-y:\s*auto/u);
  assert.doesNotMatch(stylesheet, /overflow:\s*hidden/u);
});

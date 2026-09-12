import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { EPIGRAPH, renderIndexPage } from "../lib/gallery.mjs";

// The short English sentence is independent of the module's copy.
const SENTENCE = "Life beyond utility is the domain of sovereignty.";

const { manifest, quoteCatalog } = await loadCatalog();
const index = renderIndexPage(manifest, quoteCatalog);

const attribution = `—&nbsp;<b>${EPIGRAPH.author}</b>, ${EPIGRAPH.source}`
  + `${EPIGRAPH.year == null ? "" : ` (${EPIGRAPH.year})`}`;

test("the masthead carries the short English epigraph", () => {
  assert.equal(EPIGRAPH.text, SENTENCE);
  assert.equal(EPIGRAPH.lang, "en");
  assert.equal(EPIGRAPH.author, "Georges Bataille");
  assert.equal(EPIGRAPH.source, "The Accursed Share, vol. III");
});

test("the page carries exactly one quotation that is not a card's", () => {
  const classes = [...index.matchAll(/<blockquote class="([^"]+)"/gu)].map(([, name]) => name);
  const outsideCards = classes.filter((name) => !name.includes("card__quote"));
  assert.equal(
    outsideCards.length, 1,
    `the index carries ${outsideCards.length} quotations outside its cards`
  );
  assert.equal(outsideCards[0], "masthead__epigraph");
  // Every remaining one is a card's, and there is exactly one card per artwork.
  assert.equal(classes.length, manifest.artworks.length + 1);
});

test("the epigraph reaches the page with its language and its source", () => {
  const opened = index.indexOf('<blockquote class="masthead__epigraph"');
  assert.notEqual(opened, -1, "the epigraph is not on the page");
  const block = index.slice(opened, index.indexOf("</blockquote>", opened));
  assert.ok(block.startsWith(`<blockquote class="masthead__epigraph" lang="${EPIGRAPH.lang}">`));
  assert.ok(block.includes(EPIGRAPH.text), "the page's sentence is not the module's");
  assert.ok(block.includes(attribution), "the page's attribution is not the module's");
});

test("the epigraph is nowhere in the catalog, which is why the notes can say it is not", () => {
  for (const quote of quoteCatalog.quotes) {
    assert.notEqual(quote.text, EPIGRAPH.text, `${quote.id} carries the epigraph's sentence`);
    assert.notEqual(quote.author, EPIGRAPH.author, `${quote.id} is attributed to its author`);
  }
  // And the reason it cannot be an entry: the catalog admits nothing it has not verified as
  // public domain, which is the sentence the notes give for quoting some sources and not
  // others.
  assert.ok(quoteCatalog.quotes.every((quote) => quote.publicDomain === true));
});

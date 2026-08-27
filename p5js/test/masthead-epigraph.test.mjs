import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { EPIGRAPH, renderIndexPage } from "../lib/gallery.mjs";

/**
 * The epigraph over the index is the one quotation on the site that does not come from
 * quotes.json, and the notes say so in as many words: the catalog throws on any entry not
 * marked public domain, its author is not in it, and the text is therefore kept out of the
 * catalog and off the posting path. Nothing enforced any of that. A second epigraph, or a
 * quietly edited one, would have left the whole suite passing.
 *
 * The controls here are synthetic, and that is worth saying plainly. The standard these
 * tests are written to asks a control to be a frozen specimen of a fault that actually
 * happened; no fault has happened here. What stands in its place is a pair of mutations run
 * against these assertions before they were committed. Dropping one accent in the module's
 * copy of the sentence -- "decisif" for "décisif" -- fails "the epigraph is the sentence it
 * was verified as" and nothing else, which is the point of writing the sentence out below
 * rather than reading it from the module: the page and the module move together, and only a
 * third copy notices. Adding a second blockquote to the masthead fails "the page carries
 * exactly one quotation that is not a card's" and nothing else. Neither mutation is in the
 * tree.
 */

// The sentence is written out here rather than read from the module under test, so that a
// change to the module is a difference rather than a definition. Its length is pinned beside
// it, because a truncation that left valid French behind would otherwise pass unnoticed.
const SENTENCE = "En d\u2019autres termes, prendre conscience du sens décisif d\u2019un instant "
  + "où la croissance (l\u2019acquisition de quelque chose) se résoudra en dépense, est "
  + "exactement la conscience de soi, c\u2019est-à-dire une conscience qui n\u2019a plus rien "
  + "pour objet.";
const SENTENCE_LENGTH = 236;

const { manifest, quoteCatalog } = await loadCatalog();
const index = renderIndexPage(manifest, quoteCatalog);

const attribution = `—&nbsp;<b>${EPIGRAPH.author}</b>, ${EPIGRAPH.source}`
  + `${EPIGRAPH.year == null ? "" : ` (${EPIGRAPH.year})`}`;

test("the epigraph is the sentence it was verified as, to the character", () => {
  assert.equal(EPIGRAPH.text, SENTENCE);
  assert.equal(EPIGRAPH.text.length, SENTENCE_LENGTH);
  // The apostrophe is the typographic one, as the catalog's French entries set theirs. The
  // two render alike in most faces, so only a comparison of codepoints tells them apart.
  assert.ok(EPIGRAPH.text.includes("’"), "the epigraph lost its typographic apostrophe");
  assert.ok(!EPIGRAPH.text.includes("'"), "a straight apostrophe reached the epigraph");
  assert.equal(EPIGRAPH.lang, "fr");
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

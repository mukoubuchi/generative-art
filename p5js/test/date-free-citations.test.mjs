import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { renderIndexPage } from "../lib/gallery.mjs";

/**
 * The gallery's quotations carry no dates: not on the cards, not in the masthead.
 *
 * The check reads the gallery as rendered, so a date is caught wherever it comes from -- a
 * catalog `source`, an author's name, a label outside the citation. Its control is the
 * display the site published before the dates were taken out: the 59 quotation blocks of
 * the gallery as built from 61642b4 (v1.32.1), kept as they were rendered.
 */
const DATE_PATTERNS = [
  /\b(?:1\d{3}|20\d{2})\b/u, // a four-digit year as a whole token (1253b is not one)
  /\(\s*\d{1,4}\s*\)/u, // a parenthesised number: "(8)", "(426)", "(1669)"
  /\b(?:BCE?|AD|CE)\b|\bc\.\s*\d/u, // era markers and circa
  /\b(?:January|February|March|April|May|June|July|September|October|November|December)\b/u
];

/** August is a month and also a given name. One author's name carries it, and only that one. */
const AUGUST_NAMES = ["August Ferdinand Möbius"];

/** Each quotation block with its quoted text taken out: author, source and any label. */
function attributions(html) {
  return [...html.matchAll(/<blockquote class="(?:card__quote|masthead__epigraph)"[\s\S]*?<\/blockquote>/gu)]
    .map(([block]) => block
      .replace(/<p class="[^"]*quote-text">[\s\S]*?<\/p>/u, "")
      .replace(/<[^>]+>/gu, " ")
      .replace(/&nbsp;/gu, " ")
      .replace(/\s+/gu, " ")
      .trim());
}

function dated(parts) {
  return parts.filter((part) => DATE_PATTERNS.some((pattern) => pattern.test(part))
    || /\bAugust\b/u.test(AUGUST_NAMES.reduce((text, name) => text.replace(name, ""), part)));
}

test("no quotation on the gallery carries a date, on a card or in the masthead", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const parts = attributions(renderIndexPage(manifest, quoteCatalog));
  assert.equal(parts.length, manifest.artworks.length + 1, "every card and the masthead are read");
  assert.deepEqual(dated(parts), []);
  // The one admitted name is still there, exactly once.
  for (const name of AUGUST_NAMES) {
    assert.equal(parts.filter((part) => part.includes(name)).length, 1, `${name} is admitted but not found`);
  }
});

test("the check fires on the dated display the gallery published before", () => {
  const blocks = JSON.parse(readFileSync(new URL("fixtures/dated-citations/blocks-61642b4.json", import.meta.url), "utf8"));
  const parts = attributions(blocks.join("\n"));
  assert.equal(parts.length, 59);
  assert.equal(dated(parts).length, 35);
  // Two of the 35 have no four-digit year, and only the parenthesised number catches them.
  const yearless = dated(parts).filter((part) => !DATE_PATTERNS[0].test(part));
  assert.equal(yearless.length, 2);
  assert.ok(yearless.some((part) => part.includes("(8)")));
  assert.ok(yearless.some((part) => part.includes("(426)")));
});

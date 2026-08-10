import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import {
  buildPostBody,
  validatePostBody,
  weightedCharacterCount
} from "../lib/post-text.mjs";

test("weighted character counting follows twitter-text v3 code-point ranges", () => {
  assert.equal(weightedCharacterCount("Latin"), 5);
  assert.equal(weightedCharacterCount("éΩЖא"), 4);
  assert.equal(weightedCharacterCount("e\u0301"), 1);
  assert.equal(weightedCharacterCount("日本"), 4);
  assert.equal(weightedCharacterCount("Ａ"), 2);
  assert.equal(weightedCharacterCount("—"), 1);
  assert.equal(weightedCharacterCount("…"), 2);
  assert.equal(weightedCharacterCount("👨‍👩‍👧‍👦"), 2);
  assert.equal(weightedCharacterCount("https://example.com/a/very/long/path"), 23);
  assert.equal(weightedCharacterCount("A https://example.com B"), 27);
});

test("every registered post fits without truncation", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const quotesById = new Map(quoteCatalog.quotes.map((quote) => [quote.id, quote]));

  for (const artwork of manifest.artworks) {
    const quote = quotesById.get(artwork.quoteIds[0]);
    const body = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl);
    const weight = validatePostBody(body, manifest.defaults.maxWeightedCharacters);
    assert.ok(weight <= 280);
    assert.ok(body.endsWith(artwork.interactivePath));
  }
});

test("overweight posts fail instead of being truncated", () => {
  assert.throws(() => validatePostBody("abcdef", 5), /weighs 6 characters/);
});

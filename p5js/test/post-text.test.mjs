import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";
import {
  POST_HASHTAGS,
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
    // The tag stands where a sentence about the artwork used to, on its own line.
    assert.ok(body.includes(`\n\n${POST_HASHTAGS}\n\n`), `${artwork.id} lost the tag`);
  }
});

test("a post is the quotation, its attribution, the tag, and the link", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const quotesById = new Map(quoteCatalog.quotes.map((quote) => [quote.id, quote]));
  const artwork = manifest.artworks[0];
  const quote = quotesById.get(artwork.quoteIds[0]);
  const lines = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl).split("\n");

  assert.equal(lines.length, 6);
  assert.equal(lines[0], quote.text);
  assert.ok(lines[1].startsWith("— "));
  assert.equal(lines[2], "");
  assert.equal(lines[3], POST_HASHTAGS);
  assert.equal(lines[4], "");
  assert.ok(lines[5].startsWith("https://"));
  // Nothing is left of the artwork but its link: no title, and no sentence describing it.
  assert.ok(!lines.slice(0, 5).some((line) => line.includes(artwork.title)));
});

test("the README's picture of a post is the post the code builds", async () => {
  // The layout is drawn by hand in prose beside a builder that could change under it,
  // which is how the last two README defects happened. The diagram is read back instead.
  const readme = await readFile(resolve(P5JS_DIRECTORY, "README.md"), "utf8");
  const diagram = readme.match(/Post text follows this layout:\n\n```text\n(?<body>[\s\S]*?)```/u);
  assert.ok(diagram, "the README no longer shows what a post looks like");
  const drawn = diagram.groups.body.trimEnd().split("\n");

  const { manifest, quoteCatalog } = await loadCatalog();
  const quotesById = new Map(quoteCatalog.quotes.map((quote) => [quote.id, quote]));
  const artwork = manifest.artworks[0];
  const built = buildPostBody(
    artwork,
    quotesById.get(artwork.quoteIds[0]),
    manifest.defaults.interactiveBaseUrl
  ).split("\n");

  assert.equal(drawn.length, built.length, "the drawing has a different number of lines");
  // The placeholders are angle-bracketed; the tag is the one line printed as it really is.
  drawn.forEach((line, index) => {
    if (line === "" || line.startsWith("<") || line.startsWith("— <")) {
      assert.ok(line === "" ? built[index] === "" : built[index] !== "");
      return;
    }
    assert.equal(line, built[index], `line ${index + 1} of the drawing is not what is built`);
  });
  assert.ok(drawn.includes(POST_HASHTAGS), "the drawing does not show the tag");
});

test("overweight posts fail instead of being truncated", () => {
  assert.throws(() => validatePostBody("abcdef", 5), /weighs 6 characters/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { eligibleArtworks } from "../lib/selection.mjs";

test("every registered artwork is publishable", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const warnings = [];
  const eligible = eligibleArtworks(
    manifest,
    quoteCatalog,
    (warning) => warnings.push(warning)
  );

  // Asserting the counts against each other rather than against a literal keeps this
  // check meaningful as artworks are ported one at a time.
  assert.ok(manifest.artworks.length > 0);
  assert.equal(eligible.length, manifest.artworks.length);
  assert.deepEqual(warnings, []);
  assert.ok(quoteCatalog.quotes.some((quote) => quote.lang !== "en"));
  assert.ok(manifest.artworks.every((artwork) => (
    artwork.canvas.width <= 1280
    && artwork.canvas.height <= 720
    && artwork.render.scale > 1
  )));
  assert.ok(
    manifest.artworks
      .filter((artwork) => artwork.render.kind === "video")
      .every((artwork) => artwork.render.durationSeconds <= 140)
  );
});

test("an artwork without a verified quote is excluded with a warning", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const missingQuoteManifest = structuredClone(manifest);
  missingQuoteManifest.artworks[0].quoteIds = ["missing-quote"];
  const warnings = [];
  const eligible = eligibleArtworks(
    missingQuoteManifest,
    quoteCatalog,
    (warning) => warnings.push(warning)
  );

  assert.equal(eligible.length, manifest.artworks.length - 1);
  assert.match(warnings[0], /no verified public-domain quote/);
});

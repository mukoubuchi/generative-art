import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, validateManifest } from "../lib/catalog.mjs";
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

test("the file an artwork renders to is named after the artwork", async () => {
  // A rename touches the directory, the identifier, the page, the tests and the prose,
  // and every one of those is either loaded or scanned by something. The name of the file
  // the artwork renders to is not: it is a string in the manifest that nothing compares
  // with anything, so a rename can leave it behind and no check would notice. This is
  // that check. Thirty-seven artworks name the file after their identifier, run together
  // in title case; Lorenz Ribbons names it after its title, whose plural its identifier
  // does not carry. Either is a name of the artwork. A leftover from a rename is neither.
  const { manifest } = await loadCatalog();
  const runTogether = (words) => words
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join("");
  const missed = [];
  for (const artwork of manifest.artworks) {
    const named = artwork.render.artifact.split("/").at(-1).replace(/\.[a-z0-9]+$/u, "");
    const fromId = runTogether(artwork.id.split("-"));
    const fromTitle = runTogether(artwork.title.normalize("NFD")
      .replace(/[^A-Za-z0-9 ]/gu, "").split(" "));
    if (named !== fromId && named !== fromTitle) {
      missed.push(`${artwork.id} renders to ${named}, which is neither ${fromId} nor ${fromTitle}`);
    }
  }
  assert.deepEqual(missed, []);
  assert.ok(manifest.artworks.length >= 38, "the sweep is not looking at the whole catalog");

  // Negative control: the leftover this test was written for. Loader was renamed to Under
  // the Sun and went on rendering to Loader.mp4, which nothing else in the repository
  // would have noticed.
  const strayed = { id: "under-the-sun", title: "Under the Sun", render: { artifact: "exports/p5js/Loader.mp4" } };
  const strayedName = strayed.render.artifact.split("/").at(-1).replace(/\.[a-z0-9]+$/u, "");
  assert.notEqual(strayedName, runTogether(strayed.id.split("-")));
  assert.notEqual(strayedName, runTogether(strayed.title.split(" ")));
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

test("a description is rejected rather than quietly ignored", async () => {
  // The field used to sit in the post between the attribution and the link, and on the
  // card under the title; both now carry the quotation alone. A manifest entry that still
  // declares one has a sentence somebody wrote and nobody will ever see, so the build stops
  // instead of dropping it silently — the same reasoning as a still declaring a thumbnail.
  const { manifest } = await loadCatalog();
  const withOne = {
    ...manifest,
    artworks: manifest.artworks.map((artwork, index) => (
      index === 0 ? { ...artwork, description: "a sentence nothing shows" } : artwork
    ))
  };
  assert.throws(() => validateManifest(withOne), /carries a description/);
  // And the manifest as it stands has none, so the check is not passing on an empty field.
  assert.doesNotThrow(() => validateManifest(manifest));
  assert.equal(manifest.artworks.filter((artwork) => "description" in artwork).length, 0);
});

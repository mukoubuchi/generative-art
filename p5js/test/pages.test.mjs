import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadCatalog, repositoryPath } from "../lib/catalog.mjs";

const VENDOR_P5_PATH = "/p5js/vendor/p5.min.js";
const ASSET_REFERENCE = /(?:src|href)="([^"]+)"/gu;

async function artworkPages() {
  const { manifest } = await loadCatalog();
  return await Promise.all(manifest.artworks.map(async (artwork) => ({
    artwork,
    html: await readFile(repositoryPath(artwork.entry), "utf8")
  })));
}

test("every page reaches p5 by a path that survives a subdirectory deploy", async () => {
  // An absolute "/vendor/p5.min.js" works against a server rooted at the repository and
  // fails against a site served from a subdirectory, where it escapes to the host root.
  // The failure is invisible locally and blanks every artwork once deployed, so the
  // reference is pinned here rather than left to be discovered in production.
  for (const { artwork, html } of await artworkPages()) {
    const references = [...html.matchAll(ASSET_REFERENCE)].map(([, reference]) => reference);
    const vendorReference = references.find((reference) => reference.endsWith("p5.min.js"));

    assert.ok(vendorReference, `${artwork.id} does not load p5`);
    assert.ok(
      !vendorReference.startsWith("/"),
      `${artwork.id} loads p5 by an absolute path: ${vendorReference}`
    );

    // Whatever the depth of the page, the reference has to land on the one vendor path
    // the renderer serves and the site build copies the library into.
    const pageUrl = new URL(`https://example.test/${artwork.entry.replace(/[^/]+$/u, "")}`);
    assert.equal(new URL(vendorReference, pageUrl).pathname, VENDOR_P5_PATH);
  }
});

test("no page reaches any asset by an absolute path", async () => {
  for (const { artwork, html } of await artworkPages()) {
    for (const [, reference] of html.matchAll(ASSET_REFERENCE)) {
      assert.ok(
        !reference.startsWith("/"),
        `${artwork.id} refers to ${reference}, which breaks under a subdirectory deploy`
      );
    }
  }
});

test("every page is the entry the manifest registers, and names the artwork", async () => {
  for (const { artwork, html } of await artworkPages()) {
    assert.match(html, /<title>([^<]+)<\/title>/u);
    assert.equal(html.match(/<title>([^<]+)<\/title>/u)[1], artwork.title);
    assert.match(html, /id="artwork"/u);
  }
});

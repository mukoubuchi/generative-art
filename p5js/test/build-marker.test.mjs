/**
 * The commit a page was built from, written onto the page.
 *
 * Nothing in the site said which build it came from, and for as long as that was true no
 * check could tell a page it had just been given from a copy of that page left over in a
 * cache somewhere. On 2026-08-13 that distinction turned out to matter: the fit for small
 * screens was green on every push while the site being served was six hours older than the
 * check saying so.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadCatalog, repositoryPath } from "../lib/catalog.mjs";
import {
  BUILD_META_NAME,
  UNPUBLISHED_BUILD,
  artworkHref,
  buildStamp,
  readBuildStamp
} from "../lib/gallery.mjs";
import { buildSite } from "../lib/site.mjs";

const COMMIT = "a".repeat(40);

test("every page the site serves carries the commit it was built from", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const directory = await mkdtemp(join(tmpdir(), "generative-art-marker-"));
  try {
    await buildSite(manifest, quoteCatalog, { directory, thumbnails: false, build: COMMIT });
    // The index and the artwork pages are produced by different code paths -- one is
    // rendered, the others are copied and then edited -- so both are checked. A marker on
    // only one of them would be worse than none: it would look like a site that could be
    // identified, while the pages actually being measured stayed anonymous.
    const pages = [
      ["the gallery index", resolve(directory, "index.html")],
      ...manifest.artworks.map((artwork) => [
        artwork.id,
        resolve(directory, artworkHref(artwork), "index.html")
      ])
    ];
    assert.equal(pages.length, manifest.artworks.length + 1);
    for (const [what, path] of pages) {
      const html = await readFile(path, "utf8");
      assert.equal(readBuildStamp(html), COMMIT, `${what} does not say which build it came from`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a build with no commit behind it says so rather than borrowing one", async () => {
  // A working tree can have uncommitted changes in it, so stamping a site with HEAD would
  // make the marker a claim about a commit whose contents are not what was built. And since
  // a published site is identified by a forty-digit commit, this value cannot pass for one:
  // a site built by hand can never be mistaken for one that was deployed.
  assert.equal(readBuildStamp(buildStamp(undefined)), UNPUBLISHED_BUILD);
  assert.equal(readBuildStamp(buildStamp("")), UNPUBLISHED_BUILD);
  assert.match(buildStamp(COMMIT), new RegExp(`name="${BUILD_META_NAME}"`, "u"));
  assert.equal(readBuildStamp("<!doctype html><title>nothing</title>"), null);

  const { manifest, quoteCatalog } = await loadCatalog();
  const directory = await mkdtemp(join(tmpdir(), "generative-art-marker-none-"));
  try {
    await buildSite(manifest, quoteCatalog, { directory, thumbnails: false });
    const html = await readFile(resolve(directory, "index.html"), "utf8");
    assert.equal(readBuildStamp(html), UNPUBLISHED_BUILD);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a page with nowhere to put the marker stops the build", async () => {
  // Passing over such a page would leave one artwork unidentifiable while the rest could be
  // told apart from a cached copy -- and that one would then be measured whatever age it was,
  // which is the failure the marker exists to prevent, reappearing on a single page.
  //
  // The specimen is written rather than borrowed, because no real page in the site has this
  // shape: the head is checked last, after a body and a `<main>`, and everything the build
  // copies has all three or none. So it is a real artwork page with the one line taken out of
  // it, which is the mistake in its true shape -- somebody editing a head.
  const { manifest, quoteCatalog } = await loadCatalog();
  const directory = await mkdtemp(join(tmpdir(), "generative-art-marker-refused-"));
  try {
    const original = await readFile(repositoryPath(manifest.artworks[0].entry), "utf8");
    const withoutCharset = original.replace('<meta charset="utf-8">\n', "");
    assert.notEqual(withoutCharset, original, "the specimen was not doctored, so it proves nothing");
    assert.match(withoutCharset, /<main id="artwork">/u, "the specimen would fail an earlier check");
    assert.match(withoutCharset, /<\/body>/u, "the specimen would fail an earlier check");

    // Somewhere the build's own copy step will not write over.
    await mkdir(resolve(directory, "probe"), { recursive: true });
    await writeFile(resolve(directory, "probe/index.html"), withoutCharset, "utf8");
    const doctored = {
      ...manifest,
      artworks: [{ ...manifest.artworks[0], entry: "probe/index.html" }]
    };
    await assert.rejects(
      buildSite(doctored, quoteCatalog, { directory, thumbnails: false, build: COMMIT }),
      /to stamp the build onto/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, validateManifest } from "../lib/catalog.mjs";
import {
  REVEAL_WINDOW_SECONDS,
  artworkHref,
  escapeHtml,
  renderIndexPage,
  revealDelay,
  sourceHref,
  thumbnailHref
} from "../lib/gallery.mjs";

test("every artwork in the manifest reaches the gallery, and nothing else does", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const html = renderIndexPage(manifest, quoteCatalog);

  const hrefs = [...html.matchAll(/href="(p5js\/artworks\/[^"]+)"/gu)].map(([, href]) => href);
  assert.equal(hrefs.length, manifest.artworks.length);
  assert.deepEqual(new Set(hrefs), new Set(manifest.artworks.map(artworkHref)));

  for (const artwork of manifest.artworks) {
    assert.ok(html.includes(thumbnailHref(artwork)), `${artwork.id} has no thumbnail`);
    assert.ok(html.includes(escapeHtml(artwork.title)), `${artwork.id} is not named`);
  }
});

test("a gallery link lands where the manifest says the artwork is published", async () => {
  const { manifest } = await loadCatalog();
  const base = manifest.defaults.interactiveBaseUrl;

  // The site mirrors the repository, so the link built from `entry` has to agree with the
  // published URL built from `interactiveBaseUrl` and `interactivePath`. If the two ever
  // drift, the gallery and the posted links point at different places.
  for (const artwork of manifest.artworks) {
    const published = new URL(artwork.interactivePath, base).pathname;
    assert.ok(
      published.endsWith(`/${artworkHref(artwork)}`),
      `${artwork.id}: gallery links to ${artworkHref(artwork)} but posts ${published}`
    );
  }
});

test("each artwork carries its first quote and the quote is attributed", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const html = renderIndexPage(manifest, quoteCatalog);

  for (const artwork of manifest.artworks) {
    const quote = quoteCatalog.quotes.find((candidate) => candidate.id === artwork.quoteIds[0]);
    assert.ok(quote, `${artwork.id} names a quote that does not exist`);
    assert.ok(html.includes(escapeHtml(quote.text)), `${artwork.id}'s quote is missing`);
    assert.ok(html.includes(escapeHtml(quote.author)));
    assert.ok(html.includes(`lang="${quote.lang}"`), `${quote.id} is not marked with its language`);
  }
});

test("text from the catalog cannot escape into markup", () => {
  const manifest = {
    defaults: {
      interactiveBaseUrl: "https://example.test/site/p5js/artworks/",
      sourceBaseUrl: "https://example.test/code/tree/main/"
    },
    artworks: [{
      id: "x",
      title: 'Tom & Jerry <script>alert("x")</script>',
      entry: "p5js/artworks/x/index.html",
      interactivePath: "x/",
      description: "a < b && b > c",
      canvas: { width: 10, height: 10 },
      quoteIds: ["q"],
      render: { kind: "image", scale: 1 }
    }]
  };
  const quoteCatalog = {
    quotes: [{ id: "q", text: "\"quoted\" & <angled>", lang: "en", author: "O'Hara", source: "s" }]
  };
  const html = renderIndexPage(manifest, quoteCatalog);

  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("a &lt; b &amp;&amp; b &gt; c"));
  assert.ok(html.includes("O&#39;Hara"));
});

test("the reveal order is the golden angle, so it neither sweeps nor clumps", async () => {
  const { manifest } = await loadCatalog();
  const delays = manifest.artworks.map((unused, index) => revealDelay(index));

  for (const delay of delays) {
    assert.ok(delay >= 0 && delay < REVEAL_WINDOW_SECONDS);
  }
  // A sweep would be sorted; the golden angle is not.
  assert.notDeepEqual(delays, [...delays].sort((first, second) => first - second));

  // Evenly spread: sorting the delays, no two neighbours are further apart than twice the
  // average gap. That is the property the golden angle has and a random order does not.
  const sorted = [...delays].sort((first, second) => first - second);
  const averageGap = REVEAL_WINDOW_SECONDS / sorted.length;
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(
      sorted[index] - sorted[index - 1] < averageGap * 2,
      `a gap of ${sorted[index] - sorted[index - 1]}s leaves a pause in the reveal`
    );
  }
});

test("the page declares the assets it is built with", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const html = renderIndexPage(manifest, quoteCatalog);

  assert.ok(html.includes('href="assets/gallery.css"'));
  assert.ok(html.includes('src="assets/gallery.js"'));
  assert.ok(html.includes('href="LICENSE"'));
  assert.ok(html.includes('href="THIRD_PARTY_LICENSES"'));
  assert.ok(html.startsWith("<!doctype html>"));
});

test("every card links to its own source directory, built from the manifest", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const html = renderIndexPage(manifest, quoteCatalog);
  const links = [...html.matchAll(/class="card__source" href="([^"]+)"/gu)]
    .map(([, href]) => href);

  assert.equal(links.length, manifest.artworks.length);
  for (const artwork of manifest.artworks) {
    const expected = `${manifest.defaults.sourceBaseUrl}p5js/artworks/${artwork.id}/`;
    assert.equal(sourceHref(manifest, artwork), expected);
    assert.ok(links.includes(expected), `${artwork.id} has no source link`);
  }
  assert.equal(new Set(links).size, links.length, "two artworks share a source link");
});

test("a source link names the same directory the gallery link does", async () => {
  const { manifest } = await loadCatalog();

  // Both are the manifest's entry with the file dropped, so they cannot disagree about
  // where an artwork lives. Pinning it keeps a future edit from letting them drift.
  for (const artwork of manifest.artworks) {
    assert.ok(sourceHref(manifest, artwork).endsWith(`/${artworkHref(artwork)}`));
  }
});

test("a source base that does not end in a separator is rejected", async () => {
  const { manifest } = await loadCatalog();
  const doctored = structuredClone(manifest);
  doctored.defaults.sourceBaseUrl = "https://example.test/code/tree/main";

  // Resolved against a base without a trailing slash, "p5js/artworks/x/" would replace the
  // last segment instead of extending it, and every link would lose a directory.
  assert.throws(() => validateManifest(doctored), /invalid source base URL/u);
});

test("the shutter cannot outlive the departure it dressed", async () => {
  // The gallery leaves through a shutter, and the back-forward cache restores the page
  // exactly as it left — fallen blocks included — without re-running a line of script.
  // The only defence is listeners registered up front, so their presence is pinned: a
  // sweep on pagehide, and a sweep on the persisted pageshow of a frozen restore. This
  // bug was found by a reader on a real device; it must not return quietly.
  const { readFile } = await import("node:fs/promises");
  const script = await readFile(new URL("../gallery/gallery.js", import.meta.url), "utf8");
  assert.match(script, /addEventListener\("pagehide"/u, "no pagehide sweep is registered");
  assert.match(script, /addEventListener\("pageshow"/u, "no pageshow sweep is registered");
  assert.match(script, /event\.persisted/u, "the pageshow sweep ignores whether the page was restored");
  assert.match(script, /querySelectorAll\("\.shutter"\)/u, "the sweep does not look for shutters");
});

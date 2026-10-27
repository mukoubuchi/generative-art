/**
 * What each page says about itself to search engines and link previews.
 *
 * None of it is in a page's body, so looking at a page does not check it, and nearly every
 * piece of it repeats something that already exists elsewhere: the address a post links to,
 * the quotation and attribution the card and the post show, the name the card gives its
 * picture. So each claim is checked against the thing it repeats, not against a copy
 * written out here.
 */

import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, loadCatalog, validateManifest } from "../lib/catalog.mjs";
import {
  SHARE_IMAGE,
  SHARE_MOUNT,
  SITE_NAME,
  artworkHref,
  escapeHtml,
  renderArtworkHead,
  shareImageHref,
  sharePlacement,
  thumbnailHref
} from "../lib/gallery.mjs";
import { POST_HASHTAGS, buildPostBody } from "../lib/post-text.mjs";
import { buildSite } from "../lib/site.mjs";

const { manifest, quoteCatalog } = await loadCatalog();
const SITE = manifest.defaults.siteBaseUrl;

const built = await mkdtemp(join(tmpdir(), "generative-art-metadata-"));
const pages = new Map();
let sitemap;
// Whether each address the sitemap lists is a page the build actually wrote. Settled here,
// while the build is still on disk.
const served = new Map();
try {
  await buildSite(manifest, quoteCatalog, { directory: built, thumbnails: false });
  pages.set("the gallery index", await readFile(resolve(built, "index.html"), "utf8"));
  for (const artwork of manifest.artworks) {
    pages.set(artwork.id, await readFile(resolve(built, artworkHref(artwork), "index.html"), "utf8"));
  }
  sitemap = await readFile(resolve(built, "sitemap.xml"), "utf8");
  for (const address of locations(sitemap)) {
    const file = resolve(built, address.slice(SITE.length), "index.html");
    served.set(address, address.startsWith(SITE) && await access(file).then(() => true, () => false));
  }
} finally {
  await rm(built, { recursive: true, force: true });
}

function quoteFor(artwork) {
  return quoteCatalog.quotes.find((quote) => quote.id === artwork.quoteIds[0]);
}

function decode(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
  return value.replace(/&(amp|lt|gt|quot|#39);/gu, (entity, name) => entities[name]);
}

function headOf(html) {
  const end = html.indexOf("</head>");
  assert.notEqual(end, -1, "the page has no head");
  return html.slice(0, end);
}

/** Every `content` of a `<meta>` named this way, read from the head and decoded. */
function meta(html, attribute, name) {
  const pattern = new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`, "gu");
  return [...headOf(html).matchAll(pattern)].map(([, content]) => decode(content));
}

function canonicals(html) {
  return [...headOf(html).matchAll(/<link rel="canonical" href="([^"]*)">/gu)]
    .map(([, href]) => decode(href));
}

function titleOf(html) {
  const titles = [...headOf(html).matchAll(/<title>([^<]*)<\/title>/gu)];
  assert.equal(titles.length, 1, "a page has one title");
  return decode(titles[0][1]);
}

function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, address]) => decode(address));
}

/** The address a post gives for the work: the last line of the post body. */
function postedAddress(artwork) {
  return buildPostBody(artwork, quoteFor(artwork), manifest.defaults.interactiveBaseUrl)
    .split("\n")
    .at(-1);
}

/**
 * What a sitemap gets wrong against the pages it should list, as a list of complaints: an
 * address listed twice, a page left out, an address no page claims. Kept apart from the
 * test that applies it, so that it can be shown failing on a sitemap that is wrong.
 */
function sitemapProblems(listed, expected) {
  const problems = [];
  const seen = new Set();
  for (const address of listed) {
    if (seen.has(address)) {
      problems.push(`listed twice: ${address}`);
    }
    seen.add(address);
    if (!expected.includes(address)) {
      problems.push(`not a page of the site: ${address}`);
    }
  }
  for (const address of expected) {
    if (!seen.has(address)) {
      problems.push(`left out: ${address}`);
    }
  }
  return problems;
}

test("an artwork page names, as its own address, the address its post links to", () => {
  // Two derivations of one address: the page's from `siteBaseUrl` and the card's link, the
  // post's from `interactiveBaseUrl` and `interactivePath`. A canonical link that named any
  // other address would ask search engines to send readers somewhere posts do not.
  for (const artwork of manifest.artworks) {
    const page = pages.get(artwork.id);
    assert.deepEqual(canonicals(page), [postedAddress(artwork)], `${artwork.id} claims another address`);
    assert.deepEqual(meta(page, "property", "og:url"), [postedAddress(artwork)]);
  }
  const index = pages.get("the gallery index");
  assert.deepEqual(canonicals(index), [SITE]);
  assert.deepEqual(meta(index, "property", "og:url"), [SITE]);
});

test("every page has a title of its own, and an artwork's is the manifest's name for it", () => {
  const titles = [...pages.values()].map(titleOf);
  assert.equal(titles.length, manifest.artworks.length + 1);
  assert.equal(new Set(titles).size, titles.length, "two pages share a title");

  assert.equal(titleOf(pages.get("the gallery index")), SITE_NAME);
  for (const artwork of manifest.artworks) {
    const page = pages.get(artwork.id);
    assert.equal(titleOf(page), `${artwork.title} — ${SITE_NAME}`);
    // The share card carries the site's name on a field of its own.
    assert.deepEqual(meta(page, "property", "og:title"), [artwork.title]);
    assert.deepEqual(meta(page, "property", "og:site_name"), [SITE_NAME]);
  }
});

test("an artwork's summary is the quotation its post opens with, word for word", () => {
  for (const artwork of manifest.artworks) {
    // The post opens with the quotation and the attribution on two lines; the summary is
    // those two lines joined by a space. Taken from the post body itself, so that a change
    // to either the post or the summary shows here as a disagreement.
    const body = buildPostBody(artwork, quoteFor(artwork), manifest.defaults.interactiveBaseUrl);
    const opening = body.slice(0, body.indexOf(`\n\n${POST_HASHTAGS}`));
    const split = opening.lastIndexOf("\n— ");
    assert.ok(split > 0, `${artwork.id}'s post does not open with an attributed quotation`);
    const expected = `${opening.slice(0, split)} ${opening.slice(split + 1)}`;

    const page = pages.get(artwork.id);
    assert.deepEqual(meta(page, "name", "description"), [expected], `${artwork.id}'s summary drifted`);
    assert.deepEqual(meta(page, "property", "og:description"), [expected]);
  }

  // A summary is a page's own: one shared by two pages would tell a search result nothing.
  const summaries = [...pages.values()].flatMap((html) => meta(html, "name", "description"));
  assert.equal(summaries.length, pages.size);
  assert.equal(new Set(summaries).size, summaries.length, "two pages share a summary");
});

test("the sitemap lists every page once, by the address that page names itself", () => {
  assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));

  const expected = [...pages.values()].flatMap(canonicals);
  assert.equal(expected.length, manifest.artworks.length + 1);
  assert.deepEqual(sitemapProblems(locations(sitemap), expected), []);

  // And each address is a page the build wrote, inside the project: a sitemap may list only
  // what lies at or below its own directory, which is the root of the project.
  for (const [address, exists] of served) {
    assert.ok(exists, `the sitemap lists ${address}, which the build did not write`);
  }
});

test("the sitemap check says no to a sitemap that is wrong", () => {
  // Without these, the check above could pass by never complaining. Each sample is the
  // real list of pages with one fault put into it.
  const expected = [...pages.values()].flatMap(canonicals);
  const [first, second] = expected;

  assert.deepEqual(sitemapProblems([...expected, second], expected), [`listed twice: ${second}`]);
  assert.deepEqual(sitemapProblems(expected.slice(1), expected), [`left out: ${first}`]);
  assert.deepEqual(
    sitemapProblems([...expected, "https://example.test/elsewhere/"], expected),
    ["not a page of the site: https://example.test/elsewhere/"]
  );
});

test("an artwork's share card names its share image, by the name its gallery card gives it", () => {
  const index = pages.get("the gallery index");
  for (const artwork of manifest.artworks) {
    const page = pages.get(artwork.id);
    const card = index.match(
      new RegExp(`src="${thumbnailHref(artwork)}"\\s+alt="([^"]*)"`, "u")
    );
    assert.ok(card, `${artwork.id} has no thumbnail on its gallery card`);

    const [image] = meta(page, "property", "og:image");
    assert.equal(image, new URL(shareImageHref(artwork), SITE).href);
    assert.ok(image.startsWith(SITE), `${artwork.id}'s picture is outside the project`);
    assert.deepEqual(meta(page, "property", "og:image:width"), [String(SHARE_IMAGE.width)]);
    assert.deepEqual(meta(page, "property", "og:image:height"), [String(SHARE_IMAGE.height)]);
    assert.deepEqual(meta(page, "property", "og:image:alt"), [decode(card[1])]);
    assert.deepEqual(meta(page, "name", "twitter:card"), ["summary_large_image"]);
  }

  // The index has no picture to give: no single artwork stands for the gallery.
  assert.deepEqual(meta(index, "property", "og:image"), []);
  assert.deepEqual(meta(index, "name", "twitter:card"), ["summary"]);
});

test("a share image holds the whole picture, undistorted, clear of its edges, drawn down", () => {
  const { width, height, margin } = SHARE_IMAGE;
  assert.equal(width, 2 * height, "a share image is not 2:1");

  for (const artwork of manifest.artworks) {
    const { width: canvasWidth, height: canvasHeight } = artwork.canvas;
    const box = sharePlacement(artwork);

    // Clear of every edge, whatever the margin is set to: mount shows on all four sides.
    assert.ok(
      box.x > 0 && box.y > 0 && box.x + box.width < width && box.y + box.height < height,
      `${artwork.id} meets the edge of its share image`
    );
    // By the margin, and as large as the margin allows on one axis.
    assert.ok(box.x >= margin && box.y >= margin, `${artwork.id} meets the top or the left`);
    assert.ok(box.x + box.width <= width - margin, `${artwork.id} meets the right`);
    assert.ok(box.y + box.height <= height - margin, `${artwork.id} meets the bottom`);
    assert.ok(
      box.width === width - 2 * margin || box.height === height - 2 * margin,
      `${artwork.id} is drawn smaller than its share image allows`
    );
    // Centred, to the half pixel that an odd remainder cannot be split by.
    assert.ok(Math.abs((width - box.width) / 2 - box.x) <= 0.5, `${artwork.id} is off centre`);
    assert.ok(Math.abs((height - box.height) / 2 - box.y) <= 0.5, `${artwork.id} is off centre`);
    // Undistorted: each side is the canvas's side times one factor, rounded to a whole pixel,
    // so the cross product can be out by at most half a pixel on each side's account.
    assert.ok(
      Math.abs(box.width * canvasHeight - box.height * canvasWidth) <= (canvasWidth + canvasHeight) / 2,
      `${artwork.id} is stretched`
    );
    // Drawn down: the picture is taken at the canvas's own size, the thumbnail's, and the box
    // it is drawn into is no larger than that.
    assert.ok(
      box.width <= canvasWidth && box.height <= canvasHeight,
      `${artwork.id} would be enlarged into its share image`
    );
  }
});

test("a share image's mount is the gallery card's", async () => {
  // The card mats every work on one mount, and a link preview of a work is the same card in
  // another shape. Read from the stylesheet, so a change to the card's colour shows here.
  const stylesheet = await readFile(resolve(P5JS_DIRECTORY, "gallery/gallery.css"), "utf8");
  const declared = stylesheet.match(/--ground-raised:\s*(#[0-9a-f]{6})\s*;/iu);
  assert.ok(declared, "gallery.css no longer declares the card's mount");
  assert.equal(SHARE_MOUNT.toLowerCase(), declared[1].toLowerCase());
});

test("everything a page says about itself is in its head", () => {
  // The body is what the page draws. A <meta> or a <link> belongs in the head, where it
  // changes nothing the page draws, and so does the title, which a browser shows on its tab.
  for (const [what, html] of pages) {
    const body = html.slice(html.indexOf("<body"));
    for (const pattern of [/<meta /u, /<link rel="canonical"/u, /<title>/u]) {
      assert.doesNotMatch(body, pattern, `${what} carries metadata in its body`);
    }
  }
});

test("text from the catalog cannot escape into the metadata", () => {
  const doctored = {
    defaults: { siteBaseUrl: "https://example.test/site/" },
    artworks: [{
      id: "x",
      title: 'Tom & Jerry <script>alert("x")</script>',
      entry: "p5js/artworks/x/index.html",
      quoteIds: ["q"]
    }]
  };
  const catalog = {
    quotes: [{
      id: "q",
      text: "\"quoted\" & <angled>, a < b && b > c",
      lang: "en",
      author: "O'Hara",
      source: "s"
    }]
  };
  const head = renderArtworkHead(doctored, catalog, doctored.artworks[0]);

  assert.ok(!head.includes("<script>"));
  assert.equal(titleOf(`${head}</head>`), `${doctored.artworks[0].title} — ${SITE_NAME}`);
  const [summary] = meta(`${head}</head>`, "name", "description");
  assert.ok(summary.startsWith(catalog.quotes[0].text), "the quotation was altered on the way in");
  assert.ok(summary.includes("O'Hara"));
  assert.ok(head.includes(escapeHtml(catalog.quotes[0].text)));
});

test("the index carries the ownership tag Search Console checks, from the manifest", () => {
  // Search Console reads this tag off the home page when it verifies the site, and looks for
  // it again from time to time afterwards, so every build keeps it. The test looks for it on
  // the page the build writes, with the value taken from the one place it is kept.
  const tags = Object.entries(manifest.defaults.siteVerification ?? {});
  assert.ok(
    tags.some(([name]) => name === "google-site-verification"),
    "the manifest no longer names the Search Console ownership tag"
  );
  const index = pages.get("the gallery index");
  for (const [name, value] of tags) {
    assert.deepEqual(meta(index, "name", name), [value], `the index does not carry ${name}`);
  }
});

test("an ownership tag that is not a plain name and a token is refused", () => {
  // Both halves are printed into the index's head, so anything that could close the
  // attribute, or a name that is not a meta name, stops the build instead.
  const samples = [
    null,
    "token",
    {},
    { "google-site-verification": "" },
    { "google-site-verification": 'abc" onload="x' },
    { "Not A Name": "abc" }
  ];
  for (const sample of samples) {
    const doctored = structuredClone(manifest);
    doctored.defaults.siteVerification = sample;
    assert.throws(() => validateManifest(doctored), /invalid site verification/u, JSON.stringify(sample));
  }
});

test("a site base that does not end in a separator is rejected", () => {
  const doctored = structuredClone(manifest);
  doctored.defaults.siteBaseUrl = "https://example.test/site";

  // Resolved against it, "p5js/artworks/x/" would replace "site" rather than follow it, and
  // every address a page gives out about itself would name a page that does not exist.
  assert.throws(() => validateManifest(doctored), /invalid site base URL/u);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, loadCatalog, validateManifest } from "../lib/catalog.mjs";
import {
  REVEAL_WINDOW_SECONDS,
  artworkHref,
  escapeHtml,
  renderIndexPage,
  revealDelay,
  sourceHref,
  thumbnailHref
} from "../lib/gallery.mjs";
import { NUMBER_WORDS } from "./number-words.mjs";

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
      canvas: { width: 10, height: 10 },
      quoteIds: ["q"],
      render: { kind: "image", scale: 1 }
    }]
  };
  const quoteCatalog = {
    quotes: [{
      id: "q",
      // Carries what the artwork description used to: angle brackets and a double
      // ampersand in one string, so the three kinds still covered here are < & and '.
      text: "\"quoted\" & <angled>, a < b && b > c",
      lang: "en",
      author: "O'Hara",
      source: "s"
    }]
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

test("a ring answers a touch anywhere on the page, and the scrolling of it", async () => {
  // The ring used to live inside each card and answer only a press on one. It now sits on
  // a layer over the whole page and answers a press wherever it lands, with a finger as
  // with a pointer, and a scroll from its point of contact. What is pinned is where the
  // listeners hang — the window, not the cards — that the layer lets every press through,
  // and that the cards carry no ring of their own any more, so the two cannot quietly come
  // back as a pair.
  const script = await readFile(new URL("../gallery/gallery.js", import.meta.url), "utf8");
  const stylesheet = await readFile(new URL("../gallery/gallery.css", import.meta.url), "utf8");
  const start = script.indexOf("function rippleOnContact()");
  assert.ok(start >= 0, "the page has no ring of its own");
  const body = script.slice(start, script.indexOf("\n}\n", start));
  assert.match(body, /window\.addEventListener\("pointerdown"/u, "a press on the page is not listened for");
  // The document is pinned to the screen and the body is the box that moves, so the scroll
  // event is raised on that box and does not reach the window. A listener left on the window
  // would hear nothing and would be indistinguishable from a reader who never scrolled.
  assert.match(body, /scroller\.addEventListener\("scroll"/u, "the scroll is not listened for on the box");
  assert.doesNotMatch(body, /window\.addEventListener\("scroll"/u,
    "the scroll is listened for on the window, which never hears it");
  assert.match(body, /document\.body\.append\(layer\)/u, "the rings have no layer over the page");
  assert.doesNotMatch(body, /\.card\b/u, "the ring is tied to the cards again");

  assert.match(stylesheet, /\.ripples \{[^}]*position: fixed;/u, "the layer is not fixed over the page");
  assert.match(stylesheet, /\.ripples \{[^}]*pointer-events: none;/u, "the layer would take the press it answers");
  assert.match(stylesheet, /\.ripples,\n\s+\.curtain \{\n\s+display: none;/u,
    "the layer is not removed under prefers-reduced-motion");
  assert.doesNotMatch(stylesheet, /card__ripple/u, "the card still styles a ring of its own");

  const { manifest, quoteCatalog } = await loadCatalog();
  const html = renderIndexPage(manifest, quoteCatalog);
  assert.doesNotMatch(html, /card__ripple/u, "the cards still carry a ring of their own");
});

/**
 * Runs the page's ring, as written, against a window and a document small enough to be
 * written here. Events are handed straight to the listeners the function hung; the rings it
 * makes are collected rather than drawn. The clock is the test's own.
 */
async function ringOnAStage() {
  const script = await readFile(new URL("../gallery/gallery.js", import.meta.url), "utf8");
  const start = script.indexOf("function rippleOnContact()");
  const body = script.slice(start, script.indexOf("\n}\n", start) + 2);
  const constant = (name) => Number(script.match(new RegExp(`const ${name} = (\\d+);`, "u"))[1]);
  const listeners = new Map();
  const rings = [];
  let now = 0;
  const element = () => {
    const node = {
      style: {}, children: [],
      addEventListener() {},
      append(child) { this.children.push(child); if (child.className === "ripple") { rings.push(child); } },
      remove() {},
      get childElementCount() { return this.children.length; },
      get firstElementChild() { return this.children[0]; },
      setAttribute() {}
    };
    return node;
  };
  const layer = element();
  const document = { createElement: (tag) => tag === "div" ? layer : element(), body: { append() {} } };
  const window = {
    innerWidth: 1000, innerHeight: 800,
    addEventListener: (type, listener) => listeners.set(type, listener)
  };
  const boxListeners = new Map();
  const scroller = { addEventListener: (type, listener) => boxListeners.set(type, listener) };
  new Function("window", "document", "scroller", "performance", "RIPPLES_AT_MOST", "SCROLL_RING_GAP",
    `${body}\nrippleOnContact();`)(
    window, document, scroller, { now: () => now },
    constant("RIPPLES_AT_MOST"), constant("SCROLL_RING_GAP")
  );
  const gap = constant("SCROLL_RING_GAP");
  const fire = (type, event = {}) => { listeners.get(type)?.(event); };
  const scroll = (event = {}) => { boxListeners.get("scroll")?.(event); };
  const touch = (type, points) => fire(type, {
    touches: points.map(([clientX, clientY]) => ({ clientX, clientY })),
    changedTouches: points.map(([clientX, clientY]) => ({ clientX, clientY }))
  });
  const pointer = (type, clientX, clientY, pointerType) => fire(type, { clientX, clientY, pointerType });
  // Scrolls for a while: one scroll event every tick, well past the gap between rings.
  const scrollFor = (ms, tick = 100) => { for (let t = 0; t < ms; t += tick) { now += tick; scroll(); } };
  const at = () => rings.map((ring) => `${ring.style.left} ${ring.style.top}`);
  return {
    listeners, boxListeners, rings, at, gap, fire, scroll, touch, pointer, scrollFor,
    tick: (ms) => { now += ms; }
  };
}

test("a scroll rings from the finger while it is on the glass, and not after it lifts", async () => {
  // A phone flick is one touch and then a page that goes on scrolling by itself. The rings
  // that go on rising from where the finger used to be, one every gap, were the fault: on
  // the phone they sat three or four deep on a point nobody was touching any more. The
  // finger is followed through the touch events, because once the browser takes a touch for
  // a scroll it stops sending pointermove — the pointer's idea of the contact stays where
  // the finger first landed, and a slow drag rang from there rather than from the finger.
  const stage = await ringOnAStage();
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
    assert.ok(stage.listeners.has(type), `${type} is not listened for`);
  }

  // A press: one pair, where the finger landed.
  stage.touch("touchstart", [[120, 520]]);
  assert.deepEqual(stage.at(), ["120px 520px"], "a touch does not ring once where it lands");

  // A drag: the finger moves, the page scrolls, and each ring rises from the finger's own
  // place at that moment — not from where it landed.
  stage.tick(stage.gap);
  stage.touch("touchmove", [[147, 466]]);
  stage.scroll();
  stage.tick(stage.gap);
  stage.touch("touchmove", [[177, 406]]);
  stage.scroll();
  assert.deepEqual(stage.at(), ["120px 520px", "147px 466px", "177px 406px"],
    "the rings while dragging do not follow the finger");

  // The finger lifts and the page coasts on: nothing more rings.
  stage.touch("touchend", []);
  const beforeCoasting = stage.rings.length;
  stage.scrollFor(stage.gap * 5);
  assert.equal(stage.rings.length, beforeCoasting, "the page rings after the finger has lifted");

  // The coasting is stopped by another finger: one pair there, then rings from there while
  // it is held, and none once it lifts.
  stage.touch("touchstart", [[300, 200]]);
  stage.scrollFor(stage.gap * 2);
  stage.touch("touchend", []);
  stage.scrollFor(stage.gap * 3);
  assert.deepEqual(stage.at().slice(beforeCoasting), ["300px 200px", "300px 200px", "300px 200px"],
    "stopping the coasting is not answered as a touch, or the rings did not stop with it");

  // A second finger lands while the first is still down: the ring is where the second
  // landed, not where the first still rests.
  stage.touch("touchstart", [[10, 20]]);
  stage.fire("touchstart", {
    touches: [{ clientX: 10, clientY: 20 }, { clientX: 250, clientY: 350 }],
    changedTouches: [{ clientX: 250, clientY: 350 }]
  });
  assert.equal(stage.at().at(-1), "250px 350px", "a second finger rings where the first one rests");
  stage.fire("touchend", { touches: [{ clientX: 10, clientY: 20 }], changedTouches: [{ clientX: 250, clientY: 350 }] });
  stage.touch("touchend", []);

  // A cancelled touch is a lifted one.
  stage.touch("touchstart", [[50, 60]]);
  stage.touch("touchcancel", []);
  const beforeCancelled = stage.rings.length;
  stage.scrollFor(stage.gap * 3);
  assert.equal(stage.rings.length, beforeCancelled, "the page rings after a cancelled touch");
});

test("a touch is one pair whether the browser also sends a pointer for it, and a mouse keeps its own", async () => {
  // Browsers that speak both send a pointerdown for every touchstart. The touch events answer
  // the finger; the pointer events are kept for a mouse or a pen and must not answer the
  // finger a second time. The mouse's own habits — a press rings, a wheel rings from where
  // the pointer rests, the keyboard alone rings from the centre — stay as they were.
  const stage = await ringOnAStage();
  stage.touch("touchstart", [[111, 222]]);
  stage.pointer("pointerdown", 111, 222, "touch");
  assert.deepEqual(stage.at(), ["111px 222px"], "a touch rang twice, or not at all");
  stage.touch("touchend", []);

  stage.pointer("pointerdown", 333, 444, "mouse");
  assert.deepEqual(stage.at(), ["111px 222px", "333px 444px"], "a mouse press does not ring where it pressed");

  stage.pointer("pointermove", 700, 300, "mouse");
  stage.fire("wheel");
  stage.tick(stage.gap);
  stage.scroll();
  assert.equal(stage.at().at(-1), "700px 300px", "a wheel scroll does not ring from where the pointer rests");

  const alone = await ringOnAStage();
  alone.scroll();
  assert.equal(alone.rings.length, 0, "the page rang before the reader did anything");
  alone.fire("keydown");
  alone.scroll();
  assert.deepEqual(alone.at(), ["500px 400px"], "the keyboard alone does not ring from the centre");
});

test("the README's count of the artworks that carry the moving mark is the manifest's own", async () => {
  // Another number written out in prose, beside a truth kept somewhere else. The mark goes
  // on the cards of artworks that move, so what it counts is a question about the manifest
  // and not about anybody's memory of it — and the sentence says the count twice, which is
  // two chances to go stale rather than one.
  const readme = await readFile(resolve(P5JS_DIRECTORY, "README.md"), "utf8");
  const claim = readme.match(
    /(?<moving>[\w-]+) of the (?<total>[\w-]+) carry it, and (?<again>[\w-]+) things circling/u
  );
  assert.ok(claim, "the README no longer says how many artworks carry the moving mark");

  const stated = NUMBER_WORDS.indexOf(claim.groups.moving.toLowerCase());
  const total = NUMBER_WORDS.indexOf(claim.groups.total.toLowerCase());
  assert.ok(stated > 0, `"${claim.groups.moving}" is not a number word this test can read`);
  assert.ok(total > 0, `"${claim.groups.total}" is not a number word this test can read`);
  assert.equal(claim.groups.again.toLowerCase(), claim.groups.moving.toLowerCase(),
    "the sentence gives two different counts for the same thing");

  const { manifest } = await loadCatalog();
  const moving = manifest.artworks.filter((artwork) => artwork.render.kind === "video");
  assert.equal(total, manifest.artworks.length,
    `the sentence says ${total} artworks and the manifest has ${manifest.artworks.length}`);
  assert.equal(stated, moving.length,
    `the sentence says ${stated} move and ${moving.length} of them do`);
  // Not vacuous: some artworks are stills, so the mark is telling cards apart.
  assert.ok(moving.length < manifest.artworks.length, "every artwork moves, so the mark says nothing");
});

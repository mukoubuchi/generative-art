import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, validateManifest } from "../lib/catalog.mjs";
import { escapeHtml, homageLine, renderIndexPage } from "../lib/gallery.mjs";

/**
 * Some of the works here draw a figure somebody else thought of, and say so. These tests
 * hold the saying-so: which works claim it, that the claim reaches the page, that a work
 * making no such claim is left unmarked, and that the mark cannot appear by accident.
 *
 * The roll is written out rather than counted, because the whole value of the mark is that
 * it is deliberate. A work added to it, or quietly dropped from it, has to be looked at.
 */
const HOMAGES = new Map([
  ["koch-curves", "After Helge von Koch, 1904"],
  ["sierpinski-gasket", "After Wacław Sierpiński, 1915"],
  ["kanizsa-square", "After Gaetano Kanizsa, 1955"],
  ["necker-cube", "After Louis Albert Necker, 1832"],
  ["harriss-spiral", "After Edmund Harriss, 2015"],
  ["reaction-diffusion-coral", "After Alan Turing, 1952"],
  ["truchet-tides", "After Sébastien Truchet, 1704"],
  ["voronoi-bloom", "After Georgy Voronoy, 1908"],
  ["strange-attractor", "After Peter de Jong"],
  ["moebius-band", "After August Ferdinand Möbius"],
  ["ulam-spiral", "After Stanisław Ulam, 1963"],
  ["hilbert-curve", "After David Hilbert, 1891"],
  ["cafe-wall", "After Richard Gregory, 1979"],
  ["dla-frost", "After Witten and Sander, 1981"],
  ["lorenz-ribbon", "After Edward Lorenz, 1963"]
]);

test("exactly these works are homages, and each names whom it is after", async () => {
  const { manifest } = await loadCatalog();
  const marked = manifest.artworks.filter((artwork) => artwork.homage);
  assert.deepEqual(new Set(marked.map((artwork) => artwork.id)), new Set(HOMAGES.keys()));
  assert.equal(marked.length, HOMAGES.size);
  for (const artwork of marked) {
    assert.equal(homageLine(artwork), HOMAGES.get(artwork.id), `${artwork.id} is after somebody else`);
  }
});

test("the mark reaches the page, once for each work that claims it", async () => {
  // The liveness half. A roll that agreed with itself while the gallery printed nothing
  // would pass every check above and mark no picture at all.
  const { manifest, quoteCatalog } = await loadCatalog();
  const html = renderIndexPage(manifest, quoteCatalog);

  const badges = html.match(/class="card__homage"/gu) ?? [];
  const lines = html.match(/class="card__after"/gu) ?? [];
  assert.equal(badges.length, HOMAGES.size, "the badge count does not match the roll");
  assert.equal(lines.length, HOMAGES.size, "the attribution count does not match the roll");

  for (const line of HOMAGES.values()) {
    assert.ok(html.includes(escapeHtml(line)), `the page never says "${line}"`);
  }
});

test("a work that is nobody else's figure is left unmarked", async () => {
  // The negative control. Thirty Spokes began from a saying and is not after anyone, so
  // its card must carry neither mark — otherwise the badge would be decoration rather than
  // a claim, and would say nothing by saying it everywhere.
  const { manifest, quoteCatalog } = await loadCatalog();
  const original = manifest.artworks.find((artwork) => artwork.id === "thirty-spokes");
  assert.ok(original, "thirty-spokes is missing");
  assert.equal(original.homage, undefined);
  assert.equal(homageLine(original), null);

  const html = renderIndexPage(manifest, quoteCatalog);
  const card = html.slice(html.indexOf('href="p5js/artworks/thirty-spokes/"'));
  const ownCard = card.slice(0, card.indexOf("</li>"));
  assert.ok(ownCard.includes("Thirty Spokes"), "the wrong stretch of the page was read");
  assert.ok(!ownCard.includes("card__homage"), "an original work was badged");
  assert.ok(!ownCard.includes("card__after"), "an original work was attributed to somebody");
});

test("the badge and the moving badge stay on opposite corners", async () => {
  // Both are absolutely positioned on the same frame. If they were ever given the same
  // corner they would sit on top of each other, and the works that are both moving and
  // homages — most of them — are exactly where it would show.
  const css = await (await import("node:fs/promises")).readFile(
    new URL("../gallery/gallery.css", import.meta.url), "utf8"
  );
  const rule = (selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.notEqual(start, -1, `${selector} is not styled`);
    return css.slice(start, css.indexOf("}", start));
  };
  assert.match(rule(".card__homage"), /inset-inline-start:/u);
  assert.ok(!/inset-inline-end:/u.test(rule(".card__homage")));
  assert.match(rule(".card__moving"), /inset-inline-end:/u);

  const { manifest } = await loadCatalog();
  const both = manifest.artworks.filter((a) => a.homage && a.render.kind === "video");
  assert.ok(both.length > 5, `only ${both.length} works carry both badges`);
});

test("an attribution with no name, or an unlivable year, is refused", () => {
  // The vacuity guard, from the other side: the validator has to actually reject things.
  // An attribution is the one line here that is worse wrong than missing, so a malformed
  // one must stop the build rather than reach a page half-written.
  const base = {
    version: 1,
    defaults: {
      fps: 30,
      maxVideoSeconds: 140,
      maxWeightedCharacters: 280,
      interactiveBaseUrl: "https://example.test/p5js/artworks/",
      sourceBaseUrl: "https://example.test/tree/main/"
    },
    artworks: [{
      id: "specimen",
      title: "Specimen",
      entry: "p5js/artworks/specimen/index.html",
      interactivePath: "specimen/",
      description: "A specimen.",
      quoteIds: ["q"],
      canvas: { width: 680, height: 680 },
      render: { kind: "image", artifact: "exports/p5js/Specimen.png", scale: 2 }
    }]
  };
  const withHomage = (homage) => {
    const copy = structuredClone(base);
    copy.artworks[0].homage = homage;
    return copy;
  };

  assert.doesNotThrow(() => validateManifest(structuredClone(base)));
  assert.doesNotThrow(() => validateManifest(withHomage({ after: "Somebody" })));
  assert.doesNotThrow(() => validateManifest(withHomage({ after: "Somebody", year: 1904 })));
  assert.throws(() => validateManifest(withHomage({})), /homage to nobody/u);
  assert.throws(() => validateManifest(withHomage({ after: "   " })), /homage to nobody/u);
  assert.throws(() => validateManifest(withHomage({ after: "X", year: 1904.5 })), /impossible homage year/u);
  assert.throws(() => validateManifest(withHomage({ after: "X", year: -1 })), /impossible homage year/u);
  assert.throws(
    () => validateManifest(withHomage({ after: "X", year: new Date().getUTCFullYear() + 1 })),
    /impossible homage year/u
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

/**
 * One row of the notes' format table, as it is written: the identifier, the logical
 * canvas, the size the export comes out at, and which of the two kinds it is.
 */
const FORMAT_ROW = /^\| `([a-z0-9-]+)` \| (\d+)×(\d+) \| (\d+)×(\d+) (MP4 at 30 fps|PNG) \|/gmu;

function formatTable(notes) {
  return new Map([...notes.matchAll(FORMAT_ROW)].map((row) => [row[1], {
    canvas: [Number(row[2]), Number(row[3])],
    output: [Number(row[4]), Number(row[5])],
    kind: row[6] === "PNG" ? "image" : "video"
  }]));
}

/** Every artwork the table gets wrong, named, so a failure says which and how. */
function disagreements(artworks, table) {
  const found = [];
  for (const artwork of artworks) {
    const row = table.get(artwork.id);
    if (row === undefined) {
      found.push(`${artwork.id}: the table has no row for it`);
      continue;
    }
    const { width, height } = artwork.canvas;
    const scale = artwork.render.scale ?? 1;
    if (row.canvas[0] !== width || row.canvas[1] !== height) {
      found.push(`${artwork.id}: the table says the canvas is ${row.canvas.join("×")}, `
        + `the manifest says ${width}×${height}`);
    }
    if (row.output[0] !== width * scale || row.output[1] !== height * scale) {
      found.push(`${artwork.id}: the table says the export is ${row.output.join("×")}, `
        + `the manifest's scale of ${scale} makes it ${width * scale}×${height * scale}`);
    }
    if (row.kind !== artwork.render.kind) {
      found.push(`${artwork.id}: the table says ${row.kind}, the manifest says ${artwork.render.kind}`);
    }
  }
  return found;
}

test("the format table in the notes says what the manifest says", async () => {
  // The same argument the check above makes about the rendered file's name, one level out.
  // The table is prose: it is written by hand and read by people, nothing compares it with
  // anything, and it went stale exactly where the manifest changed quietly. Five artworks
  // were re-registered from stills to clips when it turned out their pages had been moving
  // all along -- the capture contract records that repair -- and the table went on calling
  // them PNGs for a month. One canvas was resized and the table kept the old size. Two
  // artworks were added and never given a row at all.
  const { manifest } = await loadCatalog();
  const notes = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const table = formatTable(notes);
  assert.deepEqual(disagreements(manifest.artworks, table), []);
  // Every artwork has a row and no row is left over, which is what makes the sweep above
  // a sweep: a table missing half the catalog would agree with the manifest about the
  // half it kept.
  assert.equal(table.size, manifest.artworks.length,
    `${table.size} rows in the table against ${manifest.artworks.length} artworks`);
  assert.deepEqual([...table.keys()], manifest.artworks.map((artwork) => artwork.id),
    "the table lists the artworks in a different order from the manifest");

  // Negative control: the table as it stood, against the manifest as it stood, both frozen
  // on 2026-08-15. Nothing here is invented -- these are the rows that were really in the
  // file and the entries they were really wrong about.
  const strayedRows = `
| \`toggle-color-ball\` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one turn of the ring |
| \`flow-field\` | 960×640 | 1920×1280 PNG | Static capture, interactive page |
| \`strange-attractor\` | 680×680 | 1360×1360 PNG | Static |
| \`ulam-spiral\` | 680×680 | 1360×1360 PNG | Static capture, animated page |
| \`dla-frost\` | 680×680 | 1360×1360 PNG | Static capture, animated page |
| \`circle-packing\` | 680×680 | 1360×1360 PNG | Static capture, animated page |
`;
  const strayedArtworks = [
    { id: "toggle-color-ball", canvas: { width: 800, height: 600 }, render: { kind: "video", scale: 2 } },
    { id: "flow-field", canvas: { width: 960, height: 640 }, render: { kind: "video", scale: 2 } },
    { id: "strange-attractor", canvas: { width: 680, height: 680 }, render: { kind: "video", scale: 2 } },
    { id: "ulam-spiral", canvas: { width: 680, height: 680 }, render: { kind: "video", scale: 2 } },
    { id: "dla-frost", canvas: { width: 680, height: 680 }, render: { kind: "video", scale: 2 } },
    { id: "circle-packing", canvas: { width: 680, height: 680 }, render: { kind: "video", scale: 2 } },
    { id: "no-common-measure", canvas: { width: 680, height: 680 }, render: { kind: "image", scale: 2 } },
    { id: "turn-it-and-turn-it", canvas: { width: 680, height: 680 }, render: { kind: "image", scale: 2 } }
  ];
  const caught = disagreements(strayedArtworks, formatTable(strayedRows));
  assert.deepEqual(
    [...new Set(caught.map((complaint) => complaint.split(":")[0]))].sort(),
    strayedArtworks.map((artwork) => artwork.id).sort(),
    "the check no longer catches every artwork the table was wrong about"
  );
  // And it catches all three kinds of wrongness, not just the one that is easiest to see.
  assert.equal(caught.filter((complaint) => complaint.includes("the canvas is")).length, 1);
  assert.equal(caught.filter((complaint) => complaint.includes("the export is")).length, 1);
  assert.equal(caught.filter((complaint) => complaint.includes("the manifest says video")).length, 5);
  assert.equal(caught.filter((complaint) => complaint.includes("no row for it")).length, 2);
});

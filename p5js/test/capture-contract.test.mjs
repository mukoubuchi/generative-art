import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { loadCatalog } from "../lib/catalog.mjs";
import test from "node:test";

/**
 * The capture contract, held mechanically. Twice now a sketch's publishState set the
 * window globals but forgot to return the state, and the renderer crashed reading
 * undefined — hilbert-curve first, ammonite again. The habit clearly wants a machine:
 * every sketch that offers __renderFrame must resolve it to publishState's value, and
 * publishState must actually return one.
 */
const ARTWORKS_ROOT = new URL("../artworks/", import.meta.url);

function captureSketches() {
  return readdirSync(ARTWORKS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => ({
      artwork: entry.name,
      source: readFileSync(new URL(`${entry.name}/sketch.js`, ARTWORKS_ROOT), "utf8")
    }))
    .filter(({ source }) => source.includes("__renderFrame"));
}

test("every capture sketch resolves __renderFrame to the state publishState returns", () => {
  const sketches = captureSketches();

  // The scan must actually be scanning: the collection has many moving artworks.
  assert.ok(sketches.length >= 15, `only ${sketches.length} capture sketches found`);
  for (const { artwork, source } of sketches) {
    // Two honest shapes: resolve the published state inline, or hand the resolver to
    // the draw that will publish it — either way the promise's value is the state.
    const inline = /__renderFrame\s*=\s*\(frameIndex\)\s*=>[\s\S]*?Promise\.resolve\(\s*publishState\(/
      .test(source);
    const deferred = /__renderFrame\s*=\s*\(frameIndex\)\s*=>\s*new Promise\(\(resolve\)/
      .test(source) && /resolveRenderedFrame\(state\)/.test(source);
    assert.ok(
      inline || deferred,
      `${artwork}: __renderFrame must resolve to publishState's value`
    );
    const publishBody = source.match(/function publishState\([\s\S]*?\n  \}/);
    if (publishBody) {
      assert.match(
        publishBody[0],
        /return\s+[\w.$]+\s*;/,
        `${artwork}: publishState must return the state it publishes`
      );
    } else {
      // No publishState function means the deferred shape is carrying the state.
      assert.ok(deferred, `${artwork}: neither publishState nor a deferred resolver found`);
    }
  }
});

/**
 * The body of `p.setup`, and whether it stops the sketch for everybody or only for the
 * renderer. A sketch that calls `noLoop` inside its capture guard still runs its draw loop
 * on the page: that is an animation, whatever the manifest calls it.
 */
function setupBody(source) {
  const from = source.indexOf("p.setup = () =>");
  const draw = source.indexOf("p.draw = () =>");
  return draw === -1 ? source.slice(from) : source.slice(from, draw);
}

function stopsForEverybody(body) {
  let depth = 0;
  const guards = [];
  for (let at = 0; at < body.length; at += 1) {
    if (body.startsWith("if (CAPTURE_MODE)", at)) {
      guards.push(depth + 1);
    }
    if (body[at] === "{") {
      depth += 1;
    }
    if (body[at] === "}") {
      if (guards.at(-1) === depth) {
        guards.pop();
      }
      depth -= 1;
    }
    if (body.startsWith("p.noLoop();", at) && guards.length === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Artworks whose page animates while the manifest registers them as stills.
 *
 * This started as three and is down to one, and the one that is left is settled rather than
 * outstanding. Nautilus draws itself in about four tenths of a second -- measured in a
 * browser, sampling until two readings agreed -- which is real motion but far too brief to
 * be worth a clip or to make good on what a "moving" mark promises a reader. It keeps the
 * animation because watching the shell wind is part of it, and it stays a still because
 * four tenths of a second is not a film. Circle Packing at seven seconds and DLA Frost at
 * eight and a half were the other two, and both are clips now.
 *
 * The list stays because it is what closes the question: an artwork can be a still, or a
 * clip, or named here with a reason, and not in none of the three.
 */
const UNDECIDED = ["nautilus"];

test("an artwork registered as a still does not go on drawing on the page", async () => {
  // What the manifest says an artwork is, held against what its sketch does. Clinamen and
  // Ulam Spiral were registered as stills while their pages ran an animation, so the gallery
  // gave them no moving mark and the export kept only the last frame. A reader could see
  // them move; nothing in the build could. The difference is legible in the source: a still
  // stops its draw loop for everybody, an animation stops it only for the renderer.
  const { manifest } = await loadCatalog();
  const stills = manifest.artworks.filter((artwork) => artwork.render.kind === "image");
  const moving = manifest.artworks.filter((artwork) => artwork.render.kind === "video");
  // Both kinds are present, so neither branch is passing for want of examples. The stills
  // are the minority now that everything which forms on the page is published as a clip.
  assert.ok(stills.length >= 4, `only ${stills.length} artworks are registered as stills`);
  assert.ok(moving.length >= 25, `only ${moving.length} artworks are registered as moving`);

  const animating = [];
  for (const artwork of stills) {
    const source = readFileSync(new URL(`${artwork.id}/sketch.js`, ARTWORKS_ROOT), "utf8");
    const body = setupBody(source);
    const hasDraw = source.includes("p.draw = () =>");
    if (hasDraw && !stopsForEverybody(body)) {
      animating.push(artwork.id);
    }
  }
  assert.deepEqual(animating.sort(), UNDECIDED,
    "a still's page animates, and it is not the one this is settled for");

  // Not vacuous: the rule tells the two kinds apart rather than calling everything still.
  const settled = stills.filter((artwork) => !UNDECIDED.includes(artwork.id));
  assert.ok(settled.length >= 4, `only ${settled.length} stills stop for everybody`);

  // The negative control, and the shape this exists to catch: stopping only for the
  // renderer leaves the page animating, and is not the same as stopping.
  const onlyForCapture = "p.setup = () => {\n  if (CAPTURE_MODE) {\n    p.noLoop();\n  }\n};\n";
  const forEverybody = "p.setup = () => {\n  if (CAPTURE_MODE) {\n    p.pixelDensity(1);\n  }\n  p.noLoop();\n};\n";
  assert.equal(stopsForEverybody(onlyForCapture), false);
  assert.equal(stopsForEverybody(forEverybody), true);
});

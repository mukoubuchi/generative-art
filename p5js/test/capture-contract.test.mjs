import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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

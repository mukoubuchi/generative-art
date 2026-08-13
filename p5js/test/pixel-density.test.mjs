import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * Where a sketch sets its pixel density, and what a sketch that writes pixels indexes by.
 *
 * p5 ignores `pixelDensity` called before `createCanvas` — there is nothing yet to set it
 * on — so every sketch here spent a long time asking for a density of one and not getting
 * it. Nothing showed: the capture harness runs at a device pixel ratio of one, so exports
 * were the right size and the tests were green. On a Retina screen the backing store came
 * out twice the size asked for, and the three sketches that write `p.pixels` by hand wrote
 * a grid of half the width into it. Voronoi Bloom drew itself twice, side by side, in the
 * top quarter of the canvas; Truchet Tides laid its paper on the top quarter only; the
 * coral grew two colonies. Only a reader on such a screen ever saw it.
 *
 * Two things are held here, both statically, because both are properties of the source and
 * a test that needed a browser would not run in this suite at all.
 */
const ARTWORKS = new URL("../artworks/", import.meta.url);

function sketches() {
  return readdirSync(ARTWORKS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => ({
      artwork: entry.name,
      source: readFileSync(new URL(`${entry.name}/sketch.js`, ARTWORKS), "utf8")
    }));
}

/**
 * Every place a density is set, paired with where the thing it is set on was made.
 *
 * The receiver matters. A sketch may keep an off-screen layer beside its canvas, and
 * setting that layer's density right after `createGraphics` is correct even though it sits
 * earlier in the file than `createCanvas` does. Matching the bare call anywhere in the
 * source calls that a fault; matching the receiver does not.
 */
function densitySettings(source) {
  return [...source.matchAll(/\b(?<receiver>\w+)\.pixelDensity\(\s*\d/gu)].map((call) => {
    const receiver = call.groups.receiver;
    const made = receiver === "p"
      ? source.search(/\bp\.createCanvas\(/u)
      : source.search(new RegExp(`\\b${receiver}\\s*=\\s*p\\.createGraphics\\(`, "u"));
    return { receiver, at: call.index, made };
  });
}

test("no sketch sets its pixel density before it has a canvas to set it on", () => {
  const all = sketches();
  // The scan must be scanning: every artwork in the tree, and every one of them making a
  // canvas. A rename that emptied this list would otherwise pass in silence.
  assert.ok(all.length >= 37, `only ${all.length} sketches found`);
  const offenders = [];
  let settings = 0;
  for (const { artwork, source } of all) {
    assert.notEqual(source.search(/\bp\.createCanvas\(/u), -1, `${artwork} never makes a canvas`);
    for (const setting of densitySettings(source)) {
      settings += 1;
      assert.notEqual(setting.made, -1,
        `${artwork} sets a density on ${setting.receiver}, which is never made`);
      if (setting.at < setting.made) {
        offenders.push(`${artwork} (${setting.receiver})`);
      }
    }
  }
  assert.deepEqual(offenders, [], "these ask for a density before there is anything to set it on");
  // Including the off-screen layer one artwork keeps, which is set correctly and must not
  // be mistaken for a fault by a check that only reads the file in order.
  assert.ok(settings >= 38, `only ${settings} density settings were examined`);

  // And the ones that do pin a density pin it for capture only. Left alone in the browser,
  // a reader on a dense screen gets the picture drawn at their own resolution; pinned for
  // capture, an export is the size the manifest says whatever machine renders it.
  const pinning = all.filter(({ source }) => source.includes("pixelDensity(1)"));
  assert.ok(pinning.length >= 37, `only ${pinning.length} sketches pin a density for capture`);
  for (const { artwork, source } of pinning) {
    assert.match(
      source,
      /if \(CAPTURE_MODE\) \{\n\s*p\.pixelDensity\(1\);\n\s*\}/u,
      `${artwork} pins its density outside capture mode`
    );
  }

  // The negative control: the shape this test exists to catch is still caught, and the
  // shape it must not mistake for one is still allowed.
  const wasBroken = "p.pixelDensity(1);\n    p.createCanvas(680, 680).parent(\"artwork\");";
  const [bad] = densitySettings(wasBroken);
  assert.ok(bad.at < bad.made, "the check can no longer see the old order");
  const layer = "layer = p.createGraphics(10, 10);\n    layer.pixelDensity(1);\n    p.createCanvas(1, 1);";
  const [fine] = densitySettings(layer);
  assert.ok(fine.at > fine.made, "a layer set after its own making is being called a fault");
});

test("a sketch that writes pixels indexes by the buffer it is writing into", () => {
  // The defect itself, rather than its cause. A hand-written pixel loop has to walk the
  // backing store: its width is the export size times the display's density, and indexing
  // by the logical width fills a corner and leaves the rest of the buffer untouched.
  const writers = sketches().filter(({ source }) => source.includes("p.pixels"));
  assert.deepEqual(
    writers.map(({ artwork }) => artwork).sort(),
    ["reaction-diffusion-coral", "truchet-tides", "voronoi-bloom"],
    "the roll of sketches that write pixels by hand has changed"
  );

  for (const { artwork, source } of writers) {
    // It has to ask what the density is, or it cannot know how big the buffer is.
    assert.match(source, /p\.pixelDensity\(\)/u, `${artwork} never reads the density`);
    // And the index has to be built from that, not from the logical width.
    assert.match(
      source,
      /const offset = \(backingX \+ backingY \* backingWidth\) \* 4;/u,
      `${artwork} indexes its pixels by something other than the backing width`
    );
    assert.doesNotMatch(
      source,
      /const offset = \([^)]*OUTPUT_WIDTH[^)]*\) \* 4;/u,
      `${artwork} still indexes its pixels by the logical width`
    );
  }

  // The negative control: the offset every one of these used to have is still recognised.
  const wasBroken = "const offset = (outputX + outputY * OUTPUT_WIDTH) * 4;";
  assert.match(wasBroken, /const offset = \([^)]*OUTPUT_WIDTH[^)]*\) \* 4;/u);
  assert.doesNotMatch(wasBroken, /const offset = \(backingX \+ backingY \* backingWidth\) \* 4;/u);
});

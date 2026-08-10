import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, thumbnailFrame, validateManifest } from "../lib/catalog.mjs";

test("a still artwork has no frame to choose", async () => {
  const { manifest } = await loadCatalog();
  const still = manifest.artworks.find((artwork) => artwork.render.kind === "image");

  assert.equal(thumbnailFrame(manifest, still), undefined);
});

test("a moving artwork defaults to its middle and can override it", async () => {
  const { manifest } = await loadCatalog();
  const moving = manifest.artworks.find(
    (artwork) => artwork.render.kind === "video" && artwork.thumbnail === undefined
  );
  const frameCount = Math.round(moving.render.durationSeconds * manifest.defaults.fps);

  assert.equal(thumbnailFrame(manifest, moving), Math.round(frameCount / 2));
  assert.equal(thumbnailFrame(manifest, { ...moving, thumbnail: { frame: 7 } }), 7);
});

test("every chosen frame lies inside its own clip", async () => {
  const { manifest } = await loadCatalog();
  for (const artwork of manifest.artworks) {
    const frame = thumbnailFrame(manifest, artwork);
    if (frame === undefined) {
      continue;
    }
    const frameCount = Math.round(artwork.render.durationSeconds * manifest.defaults.fps);
    assert.ok(
      Number.isInteger(frame) && frame >= 0 && frame < frameCount,
      `${artwork.id} would capture frame ${frame} of ${frameCount}`
    );
  }
});

test("a thumbnail frame outside the clip is rejected", async () => {
  const { manifest } = await loadCatalog();
  const index = manifest.artworks.findIndex((artwork) => artwork.render.kind === "video");
  const frameCount = Math.round(
    manifest.artworks[index].render.durationSeconds * manifest.defaults.fps
  );

  for (const frame of [-1, frameCount, frameCount + 100, 1.5, "12", null]) {
    const doctored = structuredClone(manifest);
    doctored.artworks[index].thumbnail = { frame };
    assert.throws(
      () => validateManifest(doctored),
      /thumbnail frame outside its own clip/u,
      `${frame} should not be an acceptable frame`
    );
  }

  const doctored = structuredClone(manifest);
  doctored.artworks[index].thumbnail = { frame: frameCount - 1 };
  validateManifest(doctored);
});

test("a still artwork declaring a thumbnail frame is a mistake, not a silent no-op", async () => {
  const { manifest } = await loadCatalog();
  const doctored = structuredClone(manifest);
  const still = doctored.artworks.find((artwork) => artwork.render.kind === "image");
  still.thumbnail = { frame: 0 };

  assert.throws(() => validateManifest(doctored), /does not move/u);
});

#!/usr/bin/env node

import { loadCatalog } from "../lib/catalog.mjs";
import { renderArtworks } from "../lib/render.mjs";

function selectArtworks(argumentsList, manifest) {
  if (argumentsList.includes("--all")) {
    return manifest.artworks;
  }
  const artworkOption = argumentsList.indexOf("--artwork");
  if (artworkOption === -1 || !argumentsList[artworkOption + 1]) {
    throw new Error("Usage: npm run render -- --all | --artwork <artwork-id>");
  }
  const artworkId = argumentsList[artworkOption + 1];
  const artwork = manifest.artworks.find((candidate) => candidate.id === artworkId);
  if (!artwork) {
    throw new Error(`Unknown artwork: ${artworkId}`);
  }
  return [artwork];
}

const { manifest } = await loadCatalog();
const artworks = selectArtworks(process.argv.slice(2), manifest);
const results = await renderArtworks(manifest, artworks);

for (let index = 0; index < artworks.length; index += 1) {
  const artwork = artworks[index];
  const result = results[index];
  console.log(`Rendered ${artwork.id}: ${result.artifactPath}`);
  console.log(`Output: ${result.outputSize.width}x${result.outputSize.height}`);
  if (result.frameCount) {
    console.log(`Frames: ${result.frameCount}; duration: ${result.duration.toFixed(3)} seconds`);
  }
}

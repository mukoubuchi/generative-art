#!/usr/bin/env node

import { resolve } from "node:path";
import { REPOSITORY_ROOT, loadCatalog } from "../lib/catalog.mjs";
import { renderThumbnails } from "../lib/render.mjs";

const DEFAULT_DIRECTORY = resolve(REPOSITORY_ROOT, "site/thumbnails");
const DEFAULT_SHARE_DIRECTORY = resolve(REPOSITORY_ROOT, "site/share");
const DEFAULT_WIDTH = 640;

function option(argumentsList, name, fallback) {
  const index = argumentsList.indexOf(name);
  return index === -1 || !argumentsList[index + 1] ? fallback : argumentsList[index + 1];
}

const argumentsList = process.argv.slice(2);
const { manifest } = await loadCatalog();
const artworkId = option(argumentsList, "--artwork", undefined);
const artworks = artworkId
  ? manifest.artworks.filter((candidate) => candidate.id === artworkId)
  : manifest.artworks;

if (artworks.length === 0) {
  throw new Error(`Unknown artwork: ${artworkId}`);
}

const directory = resolve(REPOSITORY_ROOT, option(argumentsList, "--out", DEFAULT_DIRECTORY));
const shareDirectory = resolve(
  REPOSITORY_ROOT,
  option(argumentsList, "--share-out", DEFAULT_SHARE_DIRECTORY)
);
const width = Number.parseInt(option(argumentsList, "--width", String(DEFAULT_WIDTH)), 10);
if (!Number.isInteger(width) || width <= 0) {
  throw new Error(
    "Usage: npm run thumbnails -- [--artwork <id>] [--out <dir>] [--share-out <dir>] [--width <px>]"
  );
}

const results = await renderThumbnails(manifest, artworks, directory, width, shareDirectory);
for (const result of results) {
  const frame = result.frame === undefined ? "still" : `frame ${result.frame}`;
  console.log(
    `${result.id}: ${frame}, ${(result.bytes / 1024).toFixed(1)} kB, `
    + `share image ${(result.share.bytes / 1024).toFixed(1)} kB`
  );
}
console.log(`Wrote ${results.length} thumbnail(s) to ${directory}`);
console.log(`Wrote ${results.length} share image(s) to ${shareDirectory}`);

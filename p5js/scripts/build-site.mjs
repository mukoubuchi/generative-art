#!/usr/bin/env node

import { loadCatalog } from "../lib/catalog.mjs";
import { buildSite } from "../lib/site.mjs";

const argumentsList = process.argv.slice(2);
const { manifest, quoteCatalog } = await loadCatalog();

// The commit is taken from the environment that is doing the publishing, not from the
// working tree. A build made anywhere else says `development` and means it: see `buildStamp`.
const result = await buildSite(manifest, quoteCatalog, {
  clean: argumentsList.includes("--clean"),
  thumbnails: !argumentsList.includes("--skip-thumbnails"),
  build: process.env.GITHUB_SHA
});

console.log(`Built ${manifest.artworks.length} artworks into ${result.directory}`);
console.log(`Thumbnails: ${result.thumbnails}`);

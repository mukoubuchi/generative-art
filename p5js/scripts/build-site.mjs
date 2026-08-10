#!/usr/bin/env node

import { loadCatalog } from "../lib/catalog.mjs";
import { buildSite } from "../lib/site.mjs";

const argumentsList = process.argv.slice(2);
const { manifest, quoteCatalog } = await loadCatalog();

const result = await buildSite(manifest, quoteCatalog, {
  clean: argumentsList.includes("--clean"),
  thumbnails: !argumentsList.includes("--skip-thumbnails")
});

console.log(`Built ${manifest.artworks.length} artworks into ${result.directory}`);
console.log(`Thumbnails: ${result.thumbnails}`);

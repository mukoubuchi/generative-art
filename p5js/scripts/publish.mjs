#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { loadCatalog, repositoryPath } from "../lib/catalog.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import { renderArtwork } from "../lib/render.mjs";
import { selectTarget } from "../lib/selection.mjs";
import { assertPublishingEnabled, createXClient } from "../lib/x-client.mjs";

function parseArguments(argumentsList) {
  const options = { publish: false, skipRender: false };
  const valueOptions = new Map([
    ["--artwork", "artworkId"],
    ["--quote", "quoteId"],
    ["--date", "date"],
    ["--base-url", "interactiveBaseUrl"],
    ["--max-weighted-chars", "maximumWeight"]
  ]);

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--publish") {
      options.publish = true;
      continue;
    }
    if (argument === "--skip-render") {
      options.skipRender = true;
      continue;
    }
    const optionName = valueOptions.get(argument);
    if (!optionName || !argumentsList[index + 1]) {
      throw new Error(`Unknown or incomplete option: ${argument}`);
    }
    options[optionName] = argumentsList[index + 1];
    index += 1;
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const { manifest, quoteCatalog } = await loadCatalog();
const { artwork, quote } = selectTarget(manifest, quoteCatalog, options);
const maximumWeight = options.maximumWeight === undefined
  ? manifest.defaults.maxWeightedCharacters
  : Number(options.maximumWeight);
if (!Number.isInteger(maximumWeight) || maximumWeight <= 0) {
  throw new Error("--max-weighted-chars must be a positive integer.");
}

const interactiveBaseUrl = options.interactiveBaseUrl ?? manifest.defaults.interactiveBaseUrl;
const body = buildPostBody(artwork, quote, interactiveBaseUrl);
const weightedCharacters = validatePostBody(body, maximumWeight);
const artifactPath = repositoryPath(artwork.render.artifact);

if (options.skipRender) {
  await stat(artifactPath);
} else {
  await renderArtwork(manifest, artwork);
}

console.log(`Mode: ${options.publish ? "PUBLISH" : "DRY RUN"}`);
console.log(`Artwork: ${artwork.id}`);
console.log(`Quote: ${quote.id}`);
console.log(`Artifact: ${artifactPath}`);
console.log(`Weighted characters: ${weightedCharacters}/${maximumWeight}`);
console.log("Body:\n---");
console.log(body);
console.log("---");

if (!options.publish) {
  process.exitCode = 0;
} else {
  const token = assertPublishingEnabled();
  const client = createXClient({ token });
  const mediaType = artwork.render.kind === "video" ? "video/mp4" : "image/png";
  const mediaCategory = artwork.render.kind === "video" ? "tweet_video" : "tweet_image";
  const mediaId = await client.uploadMedia(artifactPath, mediaType, mediaCategory);
  const response = await client.createPost(body, mediaId);
  console.log(`Published post: ${response?.data?.id ?? "unknown id"}`);
}

#!/usr/bin/env node

import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tinyPng } from "../lib/tiny-png.mjs";
import { createXClient } from "../lib/x-client.mjs";

/**
 * Asks one question and stops: may these credentials upload media?
 *
 * It is worth asking on its own, before the first scheduled night, because the two things
 * this pipeline does are documented differently. Creating a post is reachable both ways;
 * uploading media is documented for OAuth 2.0 with `media.write`, and the OAuth 1.0a route
 * to it — the v1.1 endpoint — was retired in June 2025. Reading that and believing it are
 * not the same thing, and the cheapest way to find out is to send a one-pixel PNG's INIT
 * and read the reply.
 *
 * Nothing is appended, nothing is finalized, and no post is created. An initialized upload
 * that is never finished expires on its own.
 */
function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] !== "--access-token-file" || !argumentsList[index + 1]) {
      throw new Error(`Unknown or incomplete option: ${argumentsList[index]}`);
    }
    options.accessTokenPath = argumentsList[index + 1];
    index += 1;
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const token = options.accessTokenPath
  ? (await readFile(options.accessTokenPath, "utf8")).trim()
  : process.env.X_OAUTH2_ACCESS_TOKEN;
if (!token) {
  throw new Error("Pass --access-token-file, or set X_OAUTH2_ACCESS_TOKEN.");
}

const imagePath = join(tmpdir(), `x-media-check-${process.pid}.png`);
await writeFile(imagePath, tinyPng());

try {
  const client = createXClient({ token });
  const { mediaId } = await client.initializeUpload(imagePath, "image/png", "tweet_image");
  console.log("The upload endpoint accepted these credentials.");
  console.log(`Media id ${mediaId}: never appended to, never finalized, no post created.`);
} catch (error) {
  console.error("The upload endpoint refused these credentials.");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rm(imagePath, { force: true });
}

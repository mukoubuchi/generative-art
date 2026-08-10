#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { loadCatalog, repositoryPath } from "../lib/catalog.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import { renderArtwork } from "../lib/render.mjs";
import { dateInZone, loadSchedule, scheduledPost } from "../lib/schedule.mjs";
import { selectTarget } from "../lib/selection.mjs";
import { assertPublishingEnabled, createXClient } from "../lib/x-client.mjs";

function parseArguments(argumentsList) {
  const options = { publish: false, skipRender: false, all: false };
  const flags = new Map([
    ["--publish", "publish"],
    ["--skip-render", "skipRender"],
    ["--all", "all"]
  ]);
  const valueOptions = new Map([
    ["--artwork", "artworkId"],
    ["--quote", "quoteId"],
    ["--date", "date"],
    ["--base-url", "interactiveBaseUrl"],
    ["--max-weighted-chars", "maximumWeight"]
  ]);

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const flag = flags.get(argument);
    if (flag) {
      options[flag] = true;
      continue;
    }
    const optionName = valueOptions.get(argument);
    if (!optionName || !argumentsList[index + 1]) {
      throw new Error(`Unknown or incomplete option: ${argument}`);
    }
    options[optionName] = argumentsList[index + 1];
    index += 1;
  }
  if (options.all && options.publish) {
    throw new Error("--all is a rehearsal of the whole schedule and cannot publish.");
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const { manifest, quoteCatalog } = await loadCatalog();
const schedule = await loadSchedule(manifest);
const maximumWeight = options.maximumWeight === undefined
  ? manifest.defaults.maxWeightedCharacters
  : Number(options.maximumWeight);
if (!Number.isInteger(maximumWeight) || maximumWeight <= 0) {
  throw new Error("--max-weighted-chars must be a positive integer.");
}
const interactiveBaseUrl = options.interactiveBaseUrl ?? manifest.defaults.interactiveBaseUrl;

/** Everything about a day's post that can be decided without touching the network. */
function prepare(post) {
  const { artwork, quote } = selectTarget(manifest, quoteCatalog, {
    artworkId: post.artwork,
    quoteId: post.quote
  });
  const body = buildPostBody(artwork, quote, interactiveBaseUrl);
  return {
    artwork,
    quote,
    body,
    weightedCharacters: validatePostBody(body, maximumWeight),
    artifactPath: repositoryPath(artwork.render.artifact),
    mediaType: artwork.render.kind === "video" ? "video/mp4" : "image/png",
    mediaCategory: artwork.render.kind === "video" ? "tweet_video" : "tweet_image"
  };
}

/*
 * The whole schedule, rehearsed in one pass: every body built and weighed, every artifact
 * confirmed to exist. It is the only way to find out that the thirtieth day's quotation is
 * two characters too long before the thirtieth day, and it is what the run is reviewed from.
 */
if (options.all) {
  console.log("| Date | Artwork | Media | Weight | Post URL |");
  console.log("| --- | --- | --- | --- | --- |");
  const failures = [];
  for (const post of schedule.posts) {
    try {
      const prepared = prepare(post);
      await stat(prepared.artifactPath);
      const url = prepared.body.slice(prepared.body.lastIndexOf("https://"));
      console.log(
        `| ${post.date} | ${prepared.artwork.id} | ${prepared.mediaType} `
        + `| ${prepared.weightedCharacters}/${maximumWeight} | ${url} |`
      );
    } catch (error) {
      failures.push(`${post.date} ${post.artwork}: ${error.message}`);
    }
  }
  if (failures.length > 0) {
    console.error("\nThe rehearsal failed for:");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${schedule.posts.length} scheduled posts are within ${maximumWeight} characters and have their media.`);
  }
  process.exit();
}

const date = options.date ?? dateInZone(schedule.timeZone);
const post = options.artworkId
  ? { date, artwork: options.artworkId, quote: options.quoteId }
  : scheduledPost(schedule, date);

// A day with nothing on it is the ordinary end of the run, not a fault: when the schedule
// is exhausted the cron keeps firing and should keep finding nothing until it is refilled.
if (!post) {
  console.log(`Nothing is scheduled for ${date} (${schedule.timeZone}).`);
  process.exit(0);
}

const prepared = prepare({ ...post, quote: options.quoteId ?? post.quote });

if (options.skipRender) {
  await stat(prepared.artifactPath);
} else {
  await renderArtwork(manifest, prepared.artwork);
}

console.log(`Mode: ${options.publish ? "PUBLISH" : "DRY RUN"}`);
console.log(`Date: ${date} (${schedule.timeZone})`);
console.log(`Artwork: ${prepared.artwork.id}`);
console.log(`Quote: ${prepared.quote.id}`);
console.log(`Artifact: ${prepared.artifactPath}`);
console.log(`Weighted characters: ${prepared.weightedCharacters}/${maximumWeight}`);
console.log("Body:\n---");
console.log(prepared.body);
console.log("---");

if (options.publish) {
  const token = assertPublishingEnabled();
  const client = createXClient({ token });
  const mediaId = await client.uploadMedia(
    prepared.artifactPath,
    prepared.mediaType,
    prepared.mediaCategory
  );
  const response = await client.createPost(prepared.body, mediaId);
  console.log(`Published post: ${response?.data?.id ?? "unknown id"}`);
}

#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadCatalog } from "../lib/catalog.mjs";

/**
 * Says whether a release actually reached its readers, and refuses to answer when it
 * cannot tell.
 *
 * A release is not one act but six, and any of them can be the one that did not happen: a
 * tag can point at a commit that was never pushed, a push can be green while the site
 * keeps serving the commit before it, a deploy can succeed against a build that a stale
 * CDN then hides. Each of the six is read from a different place, and they are only a
 * release if they name one commit between them.
 *
 * The sixth is the only one that speaks for what a reader receives, so it is taken from
 * the served page itself, with a unique query and a no-store header: the build stamp on
 * the page being measured, not on some other file the CDN happened to refresh.
 *
 * The catalogue's size is counted three ways -- the anchors to artwork pages, the
 * thumbnail URLs, and the card titles -- against the manifest. Three counts of one thing
 * exist so that a disagreement is visible; a single count can be wrong without looking
 * wrong. The first version of this check counted matching *lines* and reported 697 works
 * for a gallery of 50, which no comparison would have caught.
 *
 * Usage: npm run verify:release -- <tag> [<workflow run id>]
 * With no run id, the newest deploying run of pages.yml on the tag's commit is used.
 */

const run = promisify(execFile);

const SITE = "https://mukoubuchi.github.io/generative-art";
const REPOSITORY = "mukoubuchi/generative-art";
const REMOTE_BRANCH = "refs/heads/main";
// Wikimedia and other hosts refuse an unnamed agent; a fetch that returns an error page is
// worse than one that fails, because the error page reads as content.
const USER_AGENT = "generative-art-release-verification";

async function git(...args) {
  const { stdout } = await run("git", args);
  return stdout.trim();
}

async function gh(...args) {
  const { stdout } = await run("gh", args);
  return stdout.trim();
}

/** The commit an annotated tag points at, through the tag object rather than at it. */
async function taggedCommit(tag) {
  return git("rev-parse", `${tag}^{}`);
}

async function remoteHead() {
  const line = await git("ls-remote", "origin", REMOTE_BRANCH);
  return line.split(/\s+/u)[0] ?? "";
}

/**
 * The newest run of pages.yml that could have deployed this commit. A push run builds
 * without publishing -- deploying is a separate decision, taken by dispatching the
 * workflow with deploy=true -- so a push run's success says nothing about the site.
 */
async function deployingRun(commit) {
  const runs = JSON.parse(await gh(
    "run", "list", "-R", REPOSITORY, "--workflow", "pages.yml", "-L", "20",
    "--json", "databaseId,event,headSha,conclusion"
  ));
  const match = runs.find((candidate) =>
    candidate.headSha === commit && candidate.event === "workflow_dispatch");
  if (!match) {
    throw new Error(`No workflow_dispatch run of pages.yml found on ${commit.slice(0, 7)}.`);
  }
  return String(match.databaseId);
}

async function runCommit(runId) {
  return gh("run", "view", runId, "-R", REPOSITORY, "--json", "headSha", "-q", ".headSha");
}

async function deploymentCommit() {
  return gh("api", `repos/${REPOSITORY}/deployments`, "--jq", ".[0].sha");
}

/** The served page, fetched past every cache the request can reach. */
async function fetchLive(path) {
  const url = `${SITE}${path}${path.includes("?") ? "&" : "?"}nocache=${Date.now()}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "Cache-Control": "no-store", "User-Agent": USER_AGENT }
  });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}.`);
  }
  return response.text();
}

/** The build stamp the served page carries, which is the only one that speaks for it. */
function buildStamp(html) {
  return html.match(/<meta name="build" content="([^"]*)"/u)?.[1] ?? "";
}

/** How many times a pattern occurs -- not how many lines contain one. */
function occurrences(html, pattern, unique = false) {
  const found = [...html.matchAll(pattern)].map((match) => match[0]);
  return unique ? new Set(found).size : found.length;
}

const [tag, givenRunId] = process.argv.slice(2);
if (!tag) {
  console.error("Usage: npm run verify:release -- <tag> [<workflow run id>]");
  process.exit(2);
}

const tagged = await taggedCommit(tag);
const runId = givenRunId ?? await deployingRun(tagged);
const index = await fetchLive("/");

const points = [
  [`annotated tag ${tag}^{}`, tagged],
  ["remote refs/heads/main", await remoteHead()],
  ["local HEAD", await git("rev-parse", "HEAD")],
  [`workflow headSha (${runId})`, await runCommit(runId)],
  ["Pages deployment sha", await deploymentCommit()],
  ["live index build meta", buildStamp(index)]
];

for (const [name, commit] of points) {
  console.log(`${name.padEnd(32)} ${commit || "(missing)"}`);
}
const distinct = new Set(points.map(([, commit]) => commit));
const commitsAgree = distinct.size === 1 && !distinct.has("");
console.log(`\n${commitsAgree ? "ALL SIX MATCH" : `MISMATCH: ${distinct.size} distinct values`}`);

const { manifest } = await loadCatalog();
const counts = [
  ["local manifest", manifest.artworks.length],
  ["live anchors", occurrences(index, /href="p5js\/artworks\/[a-z0-9-]+\/"/gu, true)],
  ["live thumbnails", occurrences(index, /thumbnails\/[a-z0-9-]+\.jpg/gu, true)],
  ["live card titles", occurrences(index, /class="card__title"/gu)]
];
console.log(`\nworks: ${counts.map(([name, value]) => `${name} ${value}`).join(" | ")}`);
const countsAgree = new Set(counts.map(([, value]) => value)).size === 1;
console.log(countsAgree
  ? "WORK COUNTS AGREE"
  : "WORK COUNTS DISAGREE -- report no number until this is resolved");

process.exit(commitsAgree && countsAgree ? 0 : 1);
